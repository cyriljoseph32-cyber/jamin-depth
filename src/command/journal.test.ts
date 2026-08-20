import { describe, expect, it } from "vitest";
import { createJournal, DEDUPE_WINDOW_MS } from "./journal";
import { newEventId, type CommandEventInput } from "./types";

const T0 = "2026-08-18T02:00:00.000Z"; // 09:00 à Bangkok

function input(over: Partial<CommandEventInput> = {}): CommandEventInput {
  return {
    venture: "RUGBY",
    agent: "marketing",
    type: "ACTION",
    priority: "P2",
    status: "DONE",
    summary: "Post Instagram préparé",
    details: "Impact : visibilité",
    links: [],
    next_action: "validation de Cyril",
    needs_owner: false,
    level: 1,
    ...over,
  };
}

describe("newEventId", () => {
  it("horodate à Bangkok, pas en UTC", () => {
    expect(newEventId(T0, () => "abcd1234")).toBe("evt_20260818_0900_abcd1234");
  });
});

describe("createJournal", () => {
  it("écrit un événement complet à partir d'une entrée partielle", async () => {
    const journal = createJournal(() => T0);
    const event = await journal.append(input());
    expect(event.event_id).toMatch(/^evt_20260818_0900_[0-9a-f]{8}$/);
    expect(event.timestamp).toBe(T0);
    expect(event.fingerprint).toBe("RUGBY|marketing|ACTION|post instagram préparé");
    expect(await journal.get(event.event_id)).toEqual(event);
  });

  it("dédoublonne dans la fenêtre, puis laisse repasser au-delà", async () => {
    let now = T0;
    const journal = createJournal(() => now);
    const first = await journal.append(input());
    const again = await journal.append(input());
    expect(again.event_id).toBe(first.event_id);

    now = new Date(new Date(T0).getTime() + DEDUPE_WINDOW_MS + 1000).toISOString();
    const later = await journal.append(input());
    expect(later.event_id).not.toBe(first.event_id);
  });

  it("filtre par activité, statut et date", async () => {
    const journal = createJournal(() => T0);
    await journal.append(input({ venture: "DIVING", summary: "Lead qualifié" }));
    await journal.append(input({ venture: "RUGBY", summary: "Post prêt", status: "PLANNED" }));

    expect(await journal.list({ venture: "DIVING" })).toHaveLength(1);
    expect(await journal.list({ status: "PLANNED" })).toHaveLength(1);
    expect(await journal.list({ since: T0 })).toHaveLength(0);
  });

  it("ajoute le détail de la décision sans écraser l'historique", async () => {
    const journal = createJournal(() => T0);
    const event = await journal.append(input({ status: "WAITING_APPROVAL", needs_owner: true }));
    const settled = await journal.setStatus(event.event_id, "DONE", "Approuvé par cyril.");
    expect(settled?.status).toBe("DONE");
    expect(settled?.details).toContain("Impact : visibilité");
    expect(settled?.details).toContain("Approuvé par cyril.");
  });

  it("ne rend qu'une fois les événements non notifiés", async () => {
    const journal = createJournal(() => T0);
    const event = await journal.append(input());
    expect(await journal.pendingNotification()).toHaveLength(1);
    await journal.markNotified([event.event_id], T0);
    expect(await journal.pendingNotification()).toHaveLength(0);
  });
});
