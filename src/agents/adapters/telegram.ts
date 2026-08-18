import { timingSafeEqual } from "node:crypto";
import type { QueuedItem } from "../queue";
import { SLA_MINUTES } from "../config";
import type { MessagingPort, SendResult } from "./index";

/**
 * Telegram — the owner's validation surface.
 *
 * Every queued action arrives as one card: priority, the rules that put it
 * there, the draft in full, and two buttons. Approving is a thumb press, which
 * is the point — the typing work disappears while the human stays in the loop.
 *
 * Internal traffic (escalations, briefs, reports) rides the same channel, so
 * there is one place to look.
 */

/**
 * The four operating chats of COCO COMMAND. All optional: an unset chat falls
 * back to `chatId`, so a single-chat setup keeps working — the hashtags carry
 * the routing information instead.
 */
export interface TelegramChats {
  /** Cyril's private commands (`/today`, `/approve`…). */
  command?: string;
  /** Urgencies, failures, anomalies, validations. */
  alerts?: string;
  /** Morning brief, evening report, 30-minute digest. */
  daily?: string;
  /** Per-activity follow-up, keyed by venture name (`DIVING`, `RUGBY`…). */
  project?: Readonly<Record<string, string>>;
}

export type TelegramChatKind = "command" | "alerts" | "daily" | "project";

export interface TelegramConfig {
  botToken: string;
  /** Where cards and escalations are sent by default. */
  chatId: string;
  /** Chats allowed to DECIDE. Authenticating the webhook does not say who may approve. */
  allowedChatIds: readonly string[];
  /** Shared secret Telegram echoes in `X-Telegram-Bot-Api-Secret-Token`. */
  webhookSecret?: string;
  /** Optional per-purpose chats. Anything missing falls back to `chatId`. */
  chats?: TelegramChats;
  fetchImpl?: typeof fetch;
}

/**
 * Which chat a message belongs in.
 *
 * Never throws and never returns an empty string: a misrouted notification is
 * an annoyance, a swallowed one is a failure. `chatId` is always the floor.
 */
export function chatFor(cfg: TelegramConfig, kind: TelegramChatKind, project?: string): string {
  const chats = cfg.chats;
  if (!chats) return cfg.chatId;
  if (kind === "project") {
    return (project ? chats.project?.[project.toUpperCase()] : undefined) ?? cfg.chatId;
  }
  return chats[kind] ?? cfg.chatId;
}

export function telegramFromEnv(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!botToken || !chatId) return null;
  const allowed = (process.env.TELEGRAM_ALLOWED_CHAT_IDS ?? chatId)
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return {
    botToken,
    chatId,
    // Falling back to the notification chat is the safe default: without an
    // explicit list, only the chat we already trust may approve.
    allowedChatIds: allowed.length > 0 ? allowed : [chatId],
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || undefined,
    chats: {
      command: process.env.TELEGRAM_CHAT_COMMAND?.trim() || undefined,
      alerts: process.env.TELEGRAM_CHAT_ALERTS?.trim() || undefined,
      daily: process.env.TELEGRAM_CHAT_DAILY?.trim() || undefined,
      project: {
        ...(process.env.TELEGRAM_CHAT_PROJECT_COCO?.trim()
          ? { COCO: process.env.TELEGRAM_CHAT_PROJECT_COCO.trim() }
          : {}),
        ...(process.env.TELEGRAM_CHAT_PROJECT_DIVING?.trim()
          ? { DIVING: process.env.TELEGRAM_CHAT_PROJECT_DIVING.trim() }
          : {}),
        ...(process.env.TELEGRAM_CHAT_PROJECT_RUGBY?.trim()
          ? { RUGBY: process.env.TELEGRAM_CHAT_PROJECT_RUGBY.trim() }
          : {}),
      },
    },
  };
}

function api(cfg: TelegramConfig, method: string): string {
  return `https://api.telegram.org/bot${cfg.botToken}/${method}`;
}

async function call(cfg: TelegramConfig, method: string, body: unknown): Promise<{ ok: boolean; detail?: string }> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const res = await doFetch(api(cfg, method), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true };
  const detail = await res.text().catch(() => "<no body>");
  return { ok: false, detail: `telegram-${res.status}: ${detail}` };
}

/* ------------------------------------------------------------------ *
 * Outbound: internal messaging port
 * ------------------------------------------------------------------ */

/**
 * Serves the `internal` channel: escalations, staff notices, briefs, reports.
 * Client-facing channels are never routed here.
 */
export function createTelegramMessaging(cfg: TelegramConfig): MessagingPort {
  return {
    name: "messaging:telegram",
    status: "connected",
    async send(draft): Promise<SendResult> {
      if (draft.channel !== "internal") return { ok: false, reason: `wrong-channel:${draft.channel}` };
      const result = await call(cfg, "sendMessage", {
        chat_id: cfg.chatId,
        text: draft.body.slice(0, 4000),
        disable_web_page_preview: true,
      });
      return result.ok ? { ok: true } : { ok: false, reason: result.detail };
    },
  };
}

/* ------------------------------------------------------------------ *
 * Outbound: the approval card
 * ------------------------------------------------------------------ */

const PRIORITY_LABEL: Record<string, string> = {
  P0: "🔴 P0 — santé / sécurité, maintenant",
  P1: "🟠 P1",
  P2: "🟡 P2",
  P3: "⚪ P3",
};

/** Telegram limits `callback_data` to 64 bytes — `q:<uuid>:approve` fits. */
export function callbackData(id: string, decision: "approve" | "reject"): string {
  return `q:${id}:${decision}`;
}

export function parseCallbackData(
  data: string | undefined,
): { id: string; decision: "approve" | "reject" } | null {
  if (!data) return null;
  const parts = data.split(":");
  if (parts.length !== 3 || parts[0] !== "q") return null;
  const [, id, decision] = parts;
  if (!id || (decision !== "approve" && decision !== "reject")) return null;
  return { id, decision };
}

/**
 * The card text. Deliberately shows the draft in full: approving something you
 * cannot read is not approving.
 */
export function formatCard(item: QueuedItem): string {
  const lines: string[] = [
    PRIORITY_LABEL[item.priority] ?? item.priority,
    `${item.action.type} — ${item.summary}`,
    "",
    `Pourquoi vous : ${item.reasons.join(", ")}`,
    `Objectif de réponse : ${SLA_MINUTES[item.priority]} min`,
  ];

  if (item.action.draft) {
    lines.push(
      "",
      `Message (${item.action.draft.locale.toUpperCase()} → ${
        item.action.draft.to.name ?? item.action.draft.to.phone ?? item.action.draft.channel
      })`,
      "———",
      item.action.draft.body,
      "———",
    );
  }

  // Actions this system must never perform: say so on the card, so approving is
  // understood as recording a decision, not as doing the thing.
  const humanOnly = new Set([
    "confirm_booking",
    "modify_booking",
    "cancel_booking",
    "send_payment_link",
    "record_payment",
    "refund",
    "publish_content",
    "report_incident",
  ]);
  if (humanOnly.has(item.action.type)) {
    lines.push("", "⚠️ Approuver enregistre la décision : l'acte se fait dans l'outil concerné.");
  }

  return lines.join("\n");
}

/** Plain text to one chat. Used by COCO COMMAND for briefs, digests and command replies. */
export async function sendText(
  cfg: TelegramConfig,
  chatId: string,
  text: string,
): Promise<{ ok: boolean; detail?: string }> {
  return call(cfg, "sendMessage", {
    chat_id: chatId,
    text: text.slice(0, 4000),
    disable_web_page_preview: true,
  });
}

export async function sendApprovalCard(
  cfg: TelegramConfig,
  item: QueuedItem,
  chatId: string = cfg.chatId,
): Promise<{ ok: boolean; detail?: string }> {
  return call(cfg, "sendMessage", {
    chat_id: chatId,
    text: formatCard(item).slice(0, 4000),
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approuver", callback_data: callbackData(item.id, "approve") },
          { text: "✖️ Rejeter", callback_data: callbackData(item.id, "reject") },
        ],
      ],
    },
  });
}

/* ------------------------------------------------------------------ *
 * Inbound: the button press
 * ------------------------------------------------------------------ */

/** Constant-time comparison of the webhook secret header. */
export function verifyWebhookSecret(header: string | null, expected: string | undefined): boolean {
  if (!expected) return true; // No secret configured: nothing to check.
  if (!header) return false;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface TelegramCallback {
  callbackQueryId: string;
  chatId: string;
  messageId?: number;
  from: string;
  data?: string;
}

/** Pull the parts we need out of an update; returns `null` for anything else. */
export function readCallback(update: unknown): TelegramCallback | null {
  const q = (update as { callback_query?: Record<string, unknown> }).callback_query;
  if (!q) return null;
  const id = typeof q.id === "string" ? q.id : undefined;
  const message = q.message as { chat?: { id?: number | string }; message_id?: number } | undefined;
  const chatId = message?.chat?.id;
  const from = q.from as { username?: string; first_name?: string; id?: number } | undefined;
  if (!id || chatId === undefined) return null;
  return {
    callbackQueryId: id,
    chatId: String(chatId),
    messageId: message?.message_id,
    from: from?.username ?? from?.first_name ?? String(from?.id ?? "inconnu"),
    data: typeof q.data === "string" ? q.data : undefined,
  };
}

export interface TelegramMessage {
  chatId: string;
  messageId?: number;
  from: string;
  text: string;
}

/**
 * Pull a plain text message out of an update — how COCO COMMAND receives
 * `/today`, `/approve`, `/status`. Returns `null` for anything else (a photo, a
 * join event, a button press), so the caller never has to guess.
 */
export function readMessage(update: unknown): TelegramMessage | null {
  const message = (update as { message?: Record<string, unknown> }).message;
  if (!message) return null;
  const chat = message.chat as { id?: number | string } | undefined;
  const text = typeof message.text === "string" ? message.text.trim() : "";
  if (chat?.id === undefined || text.length === 0) return null;
  const from = message.from as { username?: string; first_name?: string; id?: number } | undefined;
  return {
    chatId: String(chat.id),
    messageId: typeof message.message_id === "number" ? message.message_id : undefined,
    from: from?.username ?? from?.first_name ?? String(from?.id ?? "inconnu"),
    text,
  };
}

export function isAllowed(cfg: TelegramConfig, chatId: string): boolean {
  return cfg.allowedChatIds.includes(chatId);
}

/** Dismiss the spinner on the button, with a short toast. */
export async function answerCallback(cfg: TelegramConfig, callbackQueryId: string, text: string): Promise<void> {
  await call(cfg, "answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text: text.slice(0, 200),
  });
}

/**
 * Rewrite the card once decided, and drop the buttons — a card that still offers
 * to approve something already approved invites a second tap.
 */
export async function settleCard(
  cfg: TelegramConfig,
  messageId: number | undefined,
  original: string,
  verdict: string,
  /** The chat the card lives in — with several chats, `cfg.chatId` is a guess. */
  chatId: string = cfg.chatId,
): Promise<void> {
  if (messageId === undefined) return;
  await call(cfg, "editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: `${original}\n\n${verdict}`.slice(0, 4000),
    disable_web_page_preview: true,
    reply_markup: { inline_keyboard: [] },
  });
}
