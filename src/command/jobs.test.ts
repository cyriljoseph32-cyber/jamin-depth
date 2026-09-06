import { describe, expect, it, vi } from "vitest";
import type { TelegramConfig } from "@/agents/adapters/telegram";
import type { Runtime } from "@/agents/runtime";
import { createJournal } from "./journal";
import { createContentStore } from "./content";
import { createNotifier } from "./notify";
import { runCommandJob } from "./jobs";
import type { CommandRuntime } from "./runtime";

/**
 * `coco-contenu` is the one job that used to leave its own approval waiting up
 * to 30 minutes for the next `command-digest` — every other WAITING_APPROVAL
 * path goes out the moment it is created. These tests lock in that it no
 * longer does, and that the card it sends carries the two buttons rather than
 * a bare `/approve evt_…` a human has to retype on a phone.
 */

const NOW = "2026-08-24T01:15:00.000Z";

function harness() {
  const clock = () => NOW;
  const journal = createJournal(clock);
  const content = createContentStore(clock);

  const calls: { chat: string; text: string; hasButtons: boolean }[] = [];
  const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as {
      chat_id: string;
      text: string;
      reply_markup?: unknown;
    };
    calls.push({ chat: body.chat_id, text: body.text, hasButtons: body.reply_markup !== undefined });
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;

  const telegram: TelegramConfig = {
    botToken: "bot123",
    chatId: "1000",
    allowedChatIds: ["1000"],
    fetchImpl,
  };

  const notifier = createNotifier({ telegram, journal });

  const rt: CommandRuntime = {
    agents: {} as unknown as Runtime, // untouched by coco-contenu
    journal,
    state: {} as unknown as CommandRuntime["state"],
    tasks: {} as unknown as CommandRuntime["tasks"],
    kpis: {} as unknown as CommandRuntime["kpis"],
    content,
    notifier,
    persistent: false,
  };

  return { rt, content, journal, calls };
}

describe("runCommandJob('coco-contenu')", () => {
  it("sends the approval card immediately, with buttons, instead of waiting for the digest", async () => {
    const { rt, calls } = harness();
    const result = await runCommandJob("coco-contenu", rt, NOW);

    expect(result.job).toBe("coco-contenu");
    expect(result.sent).toBe(1);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.hasButtons).toBe(true);
    expect(result.details.join(" ")).toMatch(/carte envoyée/);
  });

  it("creates the content item in WAITING_APPROVAL, ready for the button or /approve", async () => {
    const { rt, content } = harness();
    await runCommandJob("coco-contenu", rt, NOW);

    const items = await content.list({ status: "WAITING_APPROVAL" });
    expect(items).toHaveLength(1);
    expect(items[0]?.channel).toBe("instagram");
  });

  it("still creates the draft even when Telegram cannot be reached — nothing is lost", async () => {
    const clock = () => NOW;
    const journal = createJournal(clock);
    const content = createContentStore(clock);
    const notifier = createNotifier({ telegram: null, journal });
    const rt: CommandRuntime = {
      agents: {} as unknown as Runtime,
      journal,
      state: {} as unknown as CommandRuntime["state"],
      tasks: {} as unknown as CommandRuntime["tasks"],
      kpis: {} as unknown as CommandRuntime["kpis"],
      content,
      notifier,
      persistent: false,
    };

    const result = await runCommandJob("coco-contenu", rt, NOW);
    expect(result.sent).toBe(0);
    expect(result.details.join(" ")).toMatch(/reste au digest/);
    expect(await content.list({ status: "WAITING_APPROVAL" })).toHaveLength(1);
  });
});
