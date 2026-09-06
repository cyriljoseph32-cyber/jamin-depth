import { release } from "@/agents/orchestrator";
import {
  answerCallback,
  isAllowed,
  parseCallbackData,
  parseEventCallbackData,
  readCallback,
  readMessage,
  sendText,
  settleCard,
  verifyWebhookSecret,
} from "@/agents/adapters/telegram";
import { commandDeps, createCommandRuntime, settleJournalForQueueItem } from "@/command/runtime";
import { parseCommand, runCommand } from "@/command/commands";
import { formatEvent } from "@/command/format";

/**
 * Telegram webhook — where an approval actually happens.
 *
 * Two distinct checks, and conflating them would be the bug:
 *
 * 1. `verifyWebhookSecret` proves the request came from Telegram.
 * 2. `isAllowed` proves the chat is allowed to DECIDE. A verified webhook only
 *    means Telegram sent it — it says nothing about who pressed the button.
 *
 * Three kinds of update land here: a button press on an agents' queue card
 * (`q:…`), a button press on a COCO COMMAND journal card (`e:…` — a content
 * draft, a task needing approval, anything `needs_owner`), and a plain text
 * command (`/today`, `/approve evt_…`). All three go through the same two
 * checks, and a button press ends in exactly the code a human typing the
 * equivalent `/approve` or `/reject` would run — one execution path per kind,
 * never a shortcut that skips it. The point of the button is to remove the
 * typing, not to open a second door.
 *
 * The response is always 200 once authenticated: Telegram retries otherwise, and
 * a retried approval is exactly what we do not want. The queue's conditional
 * update makes a double tap safe anyway.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const command = createCommandRuntime();
  const rt = command.agents;
  const telegram = rt.telegram;
  if (!telegram) return new Response("not configured", { status: 503 });

  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"), telegram.webhookSecret)) {
    console.error("telegram webhook: bad secret token");
    return new Response("unauthorized", { status: 401 });
  }

  let update: unknown;
  try {
    update = await req.json();
  } catch {
    return new Response("ok", { status: 200 });
  }

  const message = readMessage(update);
  if (message) {
    // A command from a chat that may not decide is refused out loud: silence
    // here reads as a broken bot and invites a retry.
    if (!isAllowed(telegram, message.chatId)) {
      await sendText(telegram, message.chatId, "Ce compte n'est pas autorisé à piloter COCO COMMAND.");
      return new Response("ok", { status: 200 });
    }

    const parsed = parseCommand(message.text);
    if (!parsed) return new Response("ok", { status: 200 });

    try {
      const reply = await runCommand(parsed, commandDeps(command, `telegram:${message.from}`, new Date().toISOString()));
      await sendText(telegram, message.chatId, reply);
    } catch (err) {
      console.error(`coco-command: /${parsed.name} a échoué:`, err);
      await sendText(telegram, message.chatId, `⛔ /${parsed.name} a échoué. Rien n'a été exécuté.`);
    }
    return new Response("ok", { status: 200 });
  }

  const callback = readCallback(update);
  // Anything that is neither a command nor a button press (a photo, a join
  // event) is acknowledged and ignored.
  if (!callback) return new Response("ok", { status: 200 });

  if (!isAllowed(telegram, callback.chatId)) {
    console.error(`telegram webhook: chat ${callback.chatId} is not allowed to decide`);
    await answerCallback(telegram, callback.callbackQueryId, "Ce compte n'est pas autorisé à valider.");
    return new Response("ok", { status: 200 });
  }

  // `e:` first: a journal event card (content, tasks…) — the same path as
  // typing `/approve evt_…`, just without the typing.
  const parsedEvent = parseEventCallbackData(callback.data);
  if (parsedEvent) {
    const eventBefore = await command.journal.get(parsedEvent.id);
    const originalText = eventBefore ? formatEvent(eventBefore) : parsedEvent.id;

    let reply: string;
    try {
      reply = await runCommand(
        { name: parsedEvent.decision === "approve" ? "approve" : "reject", args: parsedEvent.id },
        commandDeps(command, `telegram:${callback.from}`, new Date().toISOString()),
      );
    } catch (err) {
      console.error(`coco-command: /${parsedEvent.decision} (bouton) a échoué:`, err);
      reply = `⛔ ${parsedEvent.decision === "approve" ? "/approve" : "/reject"} a échoué. Rien n'a été exécuté.`;
    }

    await answerCallback(telegram, callback.callbackQueryId, reply.slice(0, 200));
    await settleCard(telegram, callback.messageId, originalText, reply, callback.chatId);
    return new Response("ok", { status: 200 });
  }

  const parsed = parseCallbackData(callback.data);
  if (!parsed) {
    await answerCallback(telegram, callback.callbackQueryId, "Action illisible.");
    return new Response("ok", { status: 200 });
  }

  const item = await rt.queue.get(parsed.id);
  const original = item ? `${item.action.type} — ${item.summary}` : parsed.id;

  const result = await release(parsed.id, parsed.decision, `telegram:${callback.from}`, {
    queue: rt.queue,
    ports: rt.ports,
    log: rt.log,
    persistAudit: rt.persistAudit,
  });

  const verdict: Record<typeof result.status, string> = {
    sent: `✅ Approuvé par ${callback.from} — envoyé.`,
    recorded: `✅ Approuvé par ${callback.from} — décision enregistrée. L'acte reste à faire dans l'outil concerné.`,
    rejected: `✖️ Rejeté par ${callback.from}.`,
    blocked: `⛔ Approuvé mais NON envoyé — ${result.detail ?? "bloqué par le garde-fou"}. À relire.`,
    already_decided: "Déjà traité.",
    not_found: "Introuvable (file vidée ou identifiant expiré).",
  };

  if (result.status === "sent" || result.status === "recorded" || result.status === "rejected" || result.status === "blocked") {
    await settleJournalForQueueItem(
      command.journal,
      parsed.id,
      result.status === "sent" || result.status === "recorded" ? "DONE" : "BLOCKED",
      verdict[result.status],
    );
  }

  await answerCallback(telegram, callback.callbackQueryId, verdict[result.status]);
  if (result.status !== "not_found" && result.status !== "already_decided") {
    await settleCard(telegram, callback.messageId, original, verdict[result.status], callback.chatId);
  }

  return new Response("ok", { status: 200 });
}
