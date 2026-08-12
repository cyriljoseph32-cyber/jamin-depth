import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import {
  createWhatsAppMessaging,
  eventsFromWebhook,
  verificationChallenge,
  verifySignature,
} from "./whatsapp";
import type { MessageDraft } from "../types";

const SECRET = "meta_app_secret_value";

function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

describe("verifySignature", () => {
  const body = JSON.stringify({ entry: [{ changes: [] }] });

  it("accepts a correctly signed body", () => {
    expect(verifySignature(body, sign(body), SECRET)).toBe(true);
  });

  it("refuses a missing or malformed header", () => {
    expect(verifySignature(body, null, SECRET)).toBe(false);
    expect(verifySignature(body, "sha256=", SECRET)).toBe(false);
    expect(verifySignature(body, "deadbeef", SECRET)).toBe(false);
    // Right digest, wrong algorithm label.
    expect(verifySignature(body, sign(body).replace("sha256=", "sha1="), SECRET)).toBe(false);
  });

  it("refuses a signature made with another secret", () => {
    expect(verifySignature(body, sign(body, "someone_elses_secret"), SECRET)).toBe(false);
  });

  it("refuses a body that changed after signing", () => {
    // This is the attack the raw-body rule exists for.
    const signature = sign(body);
    expect(verifySignature(`${body} `, signature, SECRET)).toBe(false);
  });

  it("refuses a truncated digest of the right prefix", () => {
    const full = sign(body).slice("sha256=".length);
    expect(verifySignature(body, `sha256=${full.slice(0, 32)}`, SECRET)).toBe(false);
  });
});

describe("verificationChallenge", () => {
  it("answers Meta's handshake when the token matches", () => {
    const params = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "expected",
      "hub.challenge": "12345",
    });
    expect(verificationChallenge(params, "expected")).toEqual({ ok: true, challenge: "12345" });
  });

  it("refuses a wrong token or a wrong mode", () => {
    const base = { "hub.verify_token": "expected", "hub.challenge": "12345" };
    expect(verificationChallenge(new URLSearchParams({ ...base, "hub.mode": "subscribe" }), "other").ok).toBe(false);
    expect(verificationChallenge(new URLSearchParams({ ...base, "hub.mode": "delete" }), "expected").ok).toBe(false);
  });
});

describe("eventsFromWebhook", () => {
  const message = (over: Record<string, unknown> = {}) => ({
    entry: [
      {
        changes: [
          {
            field: "messages",
            value: {
              contacts: [{ wa_id: "66812345678", profile: { name: "Marie" } }],
              messages: [
                {
                  id: "wamid.ABC",
                  from: "66812345678",
                  timestamp: "1773216000",
                  type: "text",
                  text: { body: "Bonjour, un baptême pour 2 ?" },
                  ...over,
                },
              ],
            },
          },
        ],
      },
    ],
  });

  it("maps a text message", () => {
    const [event] = eventsFromWebhook(message());
    expect(event).toMatchObject({
      id: "wa:wamid.ABC",
      channel: "whatsapp",
      text: "Bonjour, un baptême pour 2 ?",
      threadId: "wa:66812345678",
    });
    expect(event?.from).toEqual({ name: "Marie", phone: "+66812345678" });
    expect(event?.receivedAt).toBe(new Date(1773216000 * 1000).toISOString());
  });

  it("ignores delivery and read receipts", () => {
    expect(
      eventsFromWebhook({ entry: [{ changes: [{ value: { statuses: [{ status: "delivered" }] } }] }] }),
    ).toEqual([]);
  });

  it("ignores a message with no readable text rather than inventing a blank lead", () => {
    expect(eventsFromWebhook(message({ type: "image", text: undefined }))).toEqual([]);
    expect(eventsFromWebhook(message({ text: { body: "   " } }))).toEqual([]);
  });

  it("reads a button or list reply as its title", () => {
    const [event] = eventsFromWebhook(
      message({ type: "interactive", text: undefined, interactive: { button_reply: { title: "Baptême" } } }),
    );
    expect(event?.text).toBe("Baptême");
  });

  it("survives a payload shaped nothing like the docs", () => {
    expect(eventsFromWebhook({})).toEqual([]);
    expect(eventsFromWebhook(null)).toEqual([]);
    expect(eventsFromWebhook({ entry: [{}] })).toEqual([]);
  });
});

describe("createWhatsAppMessaging", () => {
  const draft: MessageDraft = {
    channel: "whatsapp",
    to: { name: "Marie", phone: "+66 81 234 5678" },
    locale: "fr",
    body: "Bonjour Marie.",
    templateId: "test",
  };

  const config = (fetchImpl: typeof fetch) => ({
    token: "t",
    phoneNumberId: "123",
    appSecret: SECRET,
    verifyToken: "v",
    fetchImpl,
  });

  it("posts to the Graph API and returns the provider id", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ messages: [{ id: "wamid.OUT" }] }), { status: 200 }),
    ) as unknown as typeof fetch;

    const result = await createWhatsAppMessaging(config(fetchImpl)).send(draft);
    expect(result).toEqual({ ok: true, externalId: "wamid.OUT" });

    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/123/messages");
    // The number is normalised — Meta rejects spaces and a leading +.
    expect(JSON.parse(String(init.body)).to).toBe("66812345678");
  });

  it("names the 24-hour window instead of reporting a generic failure", async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { code: 131047, message: "Re-engagement message" } }), {
        status: 400,
      })) as unknown as typeof fetch;

    const result = await createWhatsAppMessaging(config(fetchImpl)).send(draft);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/outside-24h-window/);
  });

  it("refuses a draft for another channel and one with no number", async () => {
    const fetchImpl = (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const port = createWhatsAppMessaging(config(fetchImpl));
    expect((await port.send({ ...draft, channel: "instagram" })).reason).toMatch(/wrong-channel/);
    expect((await port.send({ ...draft, to: { name: "Marie" } })).reason).toBe("missing-recipient-phone");
  });
});
