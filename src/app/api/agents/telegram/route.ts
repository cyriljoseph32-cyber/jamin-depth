import { release } from "@/agents/orchestrator";
import { createRuntime } from "@/agents/runtime";
import {
  answerCallback,
  isAllowed,
  parseCallbackData,
  readCallback,
  settleCard,
  verifyWebhookSecret,
} from "@/agents/adapters/telegram";

/**
 * Telegram webhook — where an approval actually happens.
 *
 * Two distinct checks, and conflating them would be the bug:
 *
 * 1. `verifyWebhookSecret` proves the request came from Telegram.
 * 2. `isAllowed` proves the chat is allowed to DECIDE. A verified webhook only
 *    means Telegram sent it — it says nothing about who pressed the button.
 *
 * The response is always 200 once authenticated: Telegram retries otherwise, and
 * a retried approval is exactly what we do not want. The queue's conditional
 * update makes a double tap safe anyway.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: Request) {
  const rt = createRuntime();
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

  const callback = readCallback(update);
  // Anything that is not a button press (a plain message to the bot, a join
  // event) is acknowledged and ignored.
  if (!callback) return new Response("ok", { status: 200 });

  if (!isAllowed(telegram, callback.chatId)) {
    console.error(`telegram webhook: chat ${callback.chatId} is not allowed to decide`);
    await answerCallback(telegram, callback.callbackQueryId, "Ce compte n'est pas autorisé à valider.");
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

  await answerCallback(telegram, callback.callbackQueryId, verdict[result.status]);
  if (result.status !== "not_found" && result.status !== "already_decided") {
    await settleCard(telegram, callback.messageId, original, verdict[result.status]);
  }

  return new Response("ok", { status: 200 });
}
