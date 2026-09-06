import { describe, expect, it, vi } from "vitest";
import {
  callbackData,
  chatFor,
  createTelegramMessaging,
  eventCallbackData,
  formatCard,
  isAllowed,
  parseCallbackData,
  parseEventCallbackData,
  readCallback,
  readMessage,
  sendApprovalCard,
  sendDecisionCard,
  verifyWebhookSecret,
  type TelegramConfig,
} from "./telegram";
import type { QueuedItem } from "../queue";

function config(over: Partial<TelegramConfig> = {}): TelegramConfig {
  return {
    botToken: "bot123",
    chatId: "1000",
    allowedChatIds: ["1000"],
    webhookSecret: "s3cret",
    fetchImpl: (async () => new Response("{}", { status: 200 })) as unknown as typeof fetch,
    ...over,
  };
}

const item: QueuedItem = {
  id: "11111111-2222-3333-4444-555555555555",
  eventId: "wa:1",
  agent: "reception",
  action: {
    id: "a1",
    type: "send_message",
    summary: "Réponse FR — baptême",
    risk: "low",
    draft: {
      channel: "whatsapp",
      to: { name: "Marie", phone: "+66812345678" },
      locale: "fr",
      body: "Bonjour Marie, le baptême se fait sur une journée.",
      templateId: "lead.ack.discover_scuba",
    },
  },
  priority: "P1",
  approver: "owner",
  reasons: ["rule:channel-draft-only"],
  summary: "Réponse FR — baptême",
  queuedAt: "2026-03-11T09:00:00.000Z",
  status: "pending",
};

describe("verifyWebhookSecret", () => {
  it("accepts the configured secret and refuses anything else", () => {
    expect(verifyWebhookSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyWebhookSecret("wrong!", "s3cret")).toBe(false);
    expect(verifyWebhookSecret(null, "s3cret")).toBe(false);
    // Different length must not throw — timingSafeEqual does.
    expect(verifyWebhookSecret("s3", "s3cret")).toBe(false);
  });

  it("passes when no secret is configured", () => {
    expect(verifyWebhookSecret(null, undefined)).toBe(true);
  });
});

describe("isAllowed", () => {
  it("separates authentication from authorisation", () => {
    // A valid webhook only proves Telegram sent it; this decides who may approve.
    expect(isAllowed(config(), "1000")).toBe(true);
    expect(isAllowed(config(), "999")).toBe(false);
    expect(isAllowed(config({ allowedChatIds: ["1000", "2000"] }), "2000")).toBe(true);
  });
});

describe("callback data", () => {
  it("round-trips and fits Telegram's 64-byte limit", () => {
    const data = callbackData(item.id, "approve");
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
    expect(parseCallbackData(data)).toEqual({ id: item.id, decision: "approve" });
  });

  it("refuses anything malformed rather than guessing an action", () => {
    for (const bad of [undefined, "", "q:only-two", "x:id:approve", "q:id:delete", "q::approve", "q:id:approve:extra"]) {
      expect(parseCallbackData(bad), String(bad)).toBeNull();
    }
  });
});

describe("event callback data", () => {
  it("round-trips a journal event id and fits the 64-byte limit", () => {
    const eventId = "evt_20260824_0115_ab12cd34";
    const data = eventCallbackData(eventId, "approve");
    expect(Buffer.byteLength(data, "utf8")).toBeLessThanOrEqual(64);
    expect(parseEventCallbackData(data)).toEqual({ id: eventId, decision: "approve" });
  });

  it("never gets read as a queue callback, or vice versa — the prefix is the whole disambiguation", () => {
    const eventData = eventCallbackData("evt_1", "reject");
    const queueData = callbackData("q-item-1", "reject");
    expect(parseCallbackData(eventData)).toBeNull();
    expect(parseEventCallbackData(queueData)).toBeNull();
  });

  it("refuses anything malformed", () => {
    for (const bad of [undefined, "", "e:only-two", "q:evt_1:approve", "e:evt_1:delete", "e::approve"]) {
      expect(parseEventCallbackData(bad), String(bad)).toBeNull();
    }
  });
});

describe("sendDecisionCard", () => {
  it("attaches exactly the two callback_data strings it was given", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await sendDecisionCard(
      config({ fetchImpl }),
      "Un brouillon de contenu à valider",
      "e:evt_1:approve",
      "e:evt_1:reject",
    );
    expect(result.ok).toBe(true);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    const [approve, reject] = body.reply_markup.inline_keyboard[0];
    expect(approve.callback_data).toBe("e:evt_1:approve");
    expect(reject.callback_data).toBe("e:evt_1:reject");
  });
});

describe("formatCard", () => {
  it("shows the draft in full — approving unread is not approving", () => {
    const card = formatCard(item);
    expect(card).toContain("Bonjour Marie, le baptême se fait sur une journée.");
    expect(card).toContain("rule:channel-draft-only");
    expect(card).toContain("P1");
  });

  it("warns that approving a money or seat action only records the decision", () => {
    const card = formatCard({ ...item, action: { ...item.action, type: "refund", draft: undefined } });
    expect(card).toMatch(/enregistre la décision/);
  });

  it("marks a P0 unmistakably", () => {
    expect(formatCard({ ...item, priority: "P0" })).toMatch(/P0/);
  });
});

describe("readCallback", () => {
  it("reads a button press", () => {
    const parsed = readCallback({
      callback_query: {
        id: "cb1",
        data: callbackData(item.id, "reject"),
        from: { username: "cyril" },
        message: { message_id: 42, chat: { id: 1000 } },
      },
    });
    expect(parsed).toMatchObject({ callbackQueryId: "cb1", chatId: "1000", messageId: 42, from: "cyril" });
  });

  it("returns null for updates that are not button presses", () => {
    expect(readCallback({ message: { text: "bonjour" } })).toBeNull();
    expect(readCallback({})).toBeNull();
    expect(readCallback({ callback_query: { id: "cb" } })).toBeNull();
  });
});

describe("sendApprovalCard", () => {
  it("sends two buttons to the configured chat", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const result = await sendApprovalCard(config({ fetchImpl }), item);
    expect(result.ok).toBe(true);

    const [, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.chat_id).toBe("1000");
    expect(body.reply_markup.inline_keyboard[0]).toHaveLength(2);
  });

  it("reports a Telegram error instead of pretending it sent", async () => {
    const fetchImpl = (async () => new Response("bad request", { status: 400 })) as unknown as typeof fetch;
    const result = await sendApprovalCard(config({ fetchImpl }), item);
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/telegram-400/);
  });
});

describe("createTelegramMessaging", () => {
  it("serves the internal channel only", async () => {
    const port = createTelegramMessaging(config());
    expect((await port.send({ ...item.action.draft!, channel: "internal" })).ok).toBe(true);
    expect((await port.send({ ...item.action.draft!, channel: "whatsapp" })).reason).toMatch(/wrong-channel/);
  });
});

describe("chatFor", () => {
  it("retombe sur le chat unique quand rien n'est configuré", () => {
    const cfg = config();
    expect(chatFor(cfg, "alerts")).toBe("1000");
    expect(chatFor(cfg, "project", "DIVING")).toBe("1000");
  });

  it("route vers le chat dédié quand il existe", () => {
    const cfg = config({ chats: { alerts: "3000", project: { RUGBY: "5000" } } });
    expect(chatFor(cfg, "alerts")).toBe("3000");
    expect(chatFor(cfg, "project", "rugby")).toBe("5000");
    // Une activité sans chat déclaré ne disparaît pas : elle revient au défaut.
    expect(chatFor(cfg, "project", "COCO")).toBe("1000");
    expect(chatFor(cfg, "daily")).toBe("1000");
  });
});

describe("readMessage", () => {
  it("lit une commande texte", () => {
    const message = readMessage({
      message: { message_id: 7, chat: { id: 1000 }, from: { username: "cyril" }, text: " /tasks " },
    });
    expect(message).toEqual({ chatId: "1000", messageId: 7, from: "cyril", text: "/tasks" });
  });

  it("ignore ce qui n'est pas du texte", () => {
    expect(readMessage({ message: { chat: { id: 1000 }, photo: [] } })).toBeNull();
    expect(readMessage({ callback_query: { id: "1" } })).toBeNull();
    expect(readMessage({})).toBeNull();
  });
});
