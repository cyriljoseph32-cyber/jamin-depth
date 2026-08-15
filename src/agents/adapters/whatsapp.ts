import { createHmac, timingSafeEqual } from "node:crypto";
import type { InboundEvent } from "../types";
import type { MessagingPort, SendResult } from "./index";
import { CHANNELS } from "../config";

/**
 * WhatsApp Cloud API — inbound verification and outbound sending.
 *
 * The security-critical half is `verifySignature`. Without it the webhook is an
 * open endpoint where anyone can impersonate a customer: invent a medical
 * disclosure, a booking, a complaint. Meta signs every delivery with the app
 * secret, so we check it on the raw body and compare in constant time.
 */

export interface WhatsAppConfig {
  token: string;
  phoneNumberId: string;
  appSecret: string;
  verifyToken: string;
  fetchImpl?: typeof fetch;
  apiVersion?: string;
}

export function whatsappFromEnv(): WhatsAppConfig | null {
  const token = process.env.WHATSAPP_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const appSecret = process.env.WHATSAPP_APP_SECRET?.trim();
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN?.trim();
  if (!token || !phoneNumberId || !appSecret || !verifyToken) return null;
  return { token, phoneNumberId, appSecret, verifyToken };
}

/* ------------------------------------------------------------------ *
 * Inbound
 * ------------------------------------------------------------------ */

/**
 * Constant-time check of Meta's `X-Hub-Signature-256` over the RAW body.
 *
 * Must be given the exact bytes Meta sent — re-serialising a parsed object
 * changes key order and whitespace and the signature stops matching, which is
 * why the route reads `await req.text()` and parses afterwards.
 */
export function verifySignature(rawBody: string, header: string | null, appSecret: string): boolean {
  if (!header) return false;
  const [algorithm, provided] = header.split("=");
  if (algorithm !== "sha256" || !provided) return false;

  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  // timingSafeEqual throws on length mismatch, so check that first.
  if (a.length === 0 || a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** The subscription handshake Meta performs when the webhook URL is saved. */
export function verificationChallenge(
  params: URLSearchParams,
  verifyToken: string,
): { ok: true; challenge: string } | { ok: false } {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token === verifyToken && challenge) return { ok: true, challenge };
  return { ok: false };
}

/** The slice of Meta's payload we rely on. Everything else is ignored. */
interface MetaWebhook {
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: {
          id?: string;
          from?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }[];
        statuses?: unknown[];
      };
    }[];
  }[];
}

/**
 * Turn a delivery into `InboundEvent`s.
 *
 * Only messages carrying text a human wrote are returned. Status callbacks
 * (delivered/read receipts) and unsupported types are dropped: an image with no
 * caption is not something the rule engine can qualify, and inventing an empty
 * enquiry would create a phantom lead.
 */
export function eventsFromWebhook(payload: unknown): InboundEvent[] {
  // A signed payload can still be `null`, a string, or a shape Meta changed
  // last week. Anything unreadable yields no events — throwing here would make
  // the route return 500 and Meta would replay the delivery indefinitely.
  if (typeof payload !== "object" || payload === null) return [];

  const body = payload as MetaWebhook;
  const events: InboundEvent[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value || !value.messages) continue;

      const profileName = value.contacts?.[0]?.profile?.name;

      for (const message of value.messages) {
        const text =
          message.text?.body ??
          message.button?.text ??
          message.interactive?.button_reply?.title ??
          message.interactive?.list_reply?.title;

        if (!message.id || !message.from || !text || text.trim().length === 0) continue;

        events.push({
          id: `wa:${message.id}`,
          channel: "whatsapp",
          receivedAt: message.timestamp
            ? new Date(Number(message.timestamp) * 1000).toISOString()
            : new Date().toISOString(),
          from: { name: profileName, phone: `+${message.from}` },
          text: text.trim(),
          // One thread per person: their number. Keeps de-duplication and the
          // 24-hour window aligned with how WhatsApp actually works.
          threadId: `wa:${message.from}`,
          meta: { waId: message.from },
        });
      }
    }
  }

  return events;
}

/* ------------------------------------------------------------------ *
 * Outbound
 * ------------------------------------------------------------------ */

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number };
}

/**
 * Meta only allows free-form text within 24 hours of the customer's last
 * message; outside it, a pre-approved template is required. Error code 131047
 * is that refusal, and it is reported as such rather than as a generic failure —
 * "message sent" when nothing arrived is the worst outcome for a lead.
 */
const OUTSIDE_WINDOW_CODES = new Set([131047, 131026]);

export function createWhatsAppMessaging(cfg: WhatsAppConfig): MessagingPort {
  const doFetch = cfg.fetchImpl ?? fetch;
  const version = cfg.apiVersion ?? "v21.0";

  return {
    name: "messaging:whatsapp",
    status: "connected",

    async send(draft): Promise<SendResult> {
      if (draft.channel !== "whatsapp") return { ok: false, reason: `wrong-channel:${draft.channel}` };

      // The channel gate still applies: this adapter does not get to override
      // the operating configuration.
      const channel = CHANNELS.whatsapp;
      if (!channel.enabled) return { ok: false, reason: "channel-disabled:whatsapp" };

      const to = draft.to.phone?.replace(/[^\d]/g, "");
      if (!to) return { ok: false, reason: "missing-recipient-phone" };

      const res = await doFetch(`https://graph.facebook.com/${version}/${cfg.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: draft.body },
        }),
      });

      if (res.ok) {
        const json = (await res.json().catch(() => ({}))) as { messages?: { id?: string }[] };
        return { ok: true, externalId: json.messages?.[0]?.id };
      }

      const json = (await res.json().catch(() => ({}))) as GraphError;
      const code = json.error?.code;
      if (code !== undefined && OUTSIDE_WINDOW_CODES.has(code)) {
        return {
          ok: false,
          reason: "outside-24h-window: réponse libre refusée par Meta, un gabarit approuvé est requis",
        };
      }
      return { ok: false, reason: `whatsapp-${res.status}: ${json.error?.message ?? "erreur inconnue"}` };
    },
  };
}
