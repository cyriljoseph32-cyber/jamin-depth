import { describe, expect, it, vi } from "vitest";
import {
  createSupabaseAuditSink,
  createSupabaseCrm,
  createSupabaseQueue,
  createSupabaseSeenStore,
  type SupabaseConfig,
} from "./supabase";
import type { ProposedAction } from "../types";

/**
 * The Supabase adapters against a fake `fetch`.
 *
 * What matters here is not that PostgREST works — it does — but that we call it
 * the way the correctness argument assumes: an upsert that cannot lose a
 * concurrent write, a decision that cannot be applied twice, and a duplicate
 * delivery that is refused by the primary key.
 */

const NOW = "2026-03-11T09:00:00.000Z";

interface Call {
  url: string;
  method: string;
  body: unknown;
  prefer?: string;
}

function fake(responses: (Response | (() => Response))[]) {
  const calls: Call[] = [];
  let i = 0;
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    calls.push({
      url: String(url),
      method: init?.method ?? "GET",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      prefer: headers.get("Prefer") ?? undefined,
    });
    const next = responses[Math.min(i, responses.length - 1)];
    i += 1;
    return typeof next === "function" ? next() : (next ?? new Response("[]", { status: 200 }));
  }) as unknown as typeof fetch;

  const cfg: SupabaseConfig = { url: "https://x.supabase.co", serviceRoleKey: "svc-key", fetchImpl };
  return { cfg, calls };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });

const leadRow = {
  id: "11111111-1111-1111-1111-111111111111",
  key: "phone:33612345678",
  contact: { name: "Marie", phone: "+33612345678" },
  channel: "whatsapp",
  locale: "fr",
  activity: "discover_scuba",
  dates: ["2026-03-14"],
  party_size: 2,
  certified: false,
  stage: "qualified",
  sensitive_topics: [],
  follow_ups: 0,
  last_follow_up_at: null,
  notes: [],
  created_at: NOW,
  updated_at: NOW,
};

describe("createSupabaseCrm", () => {
  const upsert = {
    contact: { name: "Marie", phone: "+33612345678" },
    channel: "whatsapp" as const,
    locale: "fr",
    activity: "discover_scuba" as const,
    dates: ["2026-03-14"],
    partySize: 2,
    certified: false,
    stage: "qualified" as const,
    sensitiveTopics: [],
  };

  it("sends the service-role key on both headers", async () => {
    const { cfg } = fake([json([])]);
    const fetchImpl = cfg.fetchImpl as unknown as ReturnType<typeof vi.fn>;
    await createSupabaseCrm(cfg, () => NOW).find("phone:1");
    const headers = new Headers((fetchImpl.mock.calls[0] as [string, RequestInit])[1].headers);
    expect(headers.get("apikey")).toBe("svc-key");
    expect(headers.get("Authorization")).toBe("Bearer svc-key");
  });

  it("inserts a new lead with merge-duplicates, so a concurrent webhook cannot 409", async () => {
    const { cfg, calls } = fake([json([]), json([leadRow])]);
    const lead = await createSupabaseCrm(cfg, () => NOW).upsert(upsert);

    expect(calls[1]?.method).toBe("POST");
    expect(calls[1]?.prefer).toContain("resolution=merge-duplicates");
    expect(lead.key).toBe("phone:33612345678");
    expect(lead.partySize).toBe(2);
  });

  it("merges over an existing lead instead of replacing it", async () => {
    const existing = { ...leadRow, notes: ["appel du 9 mars"], follow_ups: 1, party_size: 2 };
    const { cfg, calls } = fake([json([existing]), json([existing])]);

    // The new message says nothing about party size — the known value must survive.
    await createSupabaseCrm(cfg, () => NOW).upsert({ ...upsert, partySize: undefined, dates: [] });

    expect(calls[1]?.method).toBe("PATCH");
    const body = calls[1]?.body as Record<string, unknown>;
    expect(body.party_size).toBe(2);
    expect(body.dates).toEqual(["2026-03-14"]);
    expect(body.follow_ups).toBe(1);
    expect(body.notes).toEqual(["appel du 9 mars"]);
  });

  it("raises a readable error when PostgREST refuses", async () => {
    const { cfg } = fake([json({ message: 'relation "public.leads" does not exist' }, 404)]);
    await expect(createSupabaseCrm(cfg, () => NOW).find("phone:1")).rejects.toThrow(/Supabase 404/);
  });
});

describe("createSupabaseQueue", () => {
  const action: ProposedAction = {
    id: "a1",
    type: "send_message",
    summary: "Réponse FR",
    risk: "low",
    approval: { required: true, reasons: ["rule:channel-draft-only"], approver: "owner" },
  };

  it("stores the full action so the card can show the draft", async () => {
    const { cfg, calls } = fake([json([])]);
    const item = await createSupabaseQueue(cfg, () => NOW).enqueue({
      eventId: "wa:1",
      agent: "reception",
      action,
      priority: "P1",
    });

    const row = (calls[0]?.body as Record<string, unknown>[])[0];
    expect(row?.action).toMatchObject({ type: "send_message" });
    expect(row?.reasons).toEqual(["rule:channel-draft-only"]);
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("makes the decision conditional on still being pending", async () => {
    // This filter is what stops two simultaneous taps from both approving.
    const { cfg, calls } = fake([json([])]);
    await createSupabaseQueue(cfg, () => NOW).approve("q1", "cyril");
    expect(calls[0]?.url).toContain("status=eq.pending");
    expect(calls[0]?.method).toBe("PATCH");
  });

  it("returns undefined when the row was already decided", async () => {
    // PostgREST returns an empty set when the filter matched nothing.
    const { cfg } = fake([json([])]);
    expect(await createSupabaseQueue(cfg, () => NOW).approve("q1", "cyril")).toBeUndefined();
  });

  it("orders pending items P0 first", async () => {
    const base = {
      event_id: "e",
      agent: "reception",
      action,
      approver: "owner",
      reasons: [],
      summary: "s",
      status: "pending",
      decided_by: null,
      decided_at: null,
      decision_note: null,
      executed_at: null,
    };
    const { cfg } = fake([
      json([
        { ...base, id: "b", priority: "P3", queued_at: "2026-03-11T08:00:00.000Z" },
        { ...base, id: "a", priority: "P0", queued_at: "2026-03-11T09:00:00.000Z" },
      ]),
    ]);
    const pending = await createSupabaseQueue(cfg, () => NOW).pending();
    expect(pending.map((p) => p.id)).toEqual(["a", "b"]);
  });
});

describe("createSupabaseSeenStore", () => {
  it("claims a first delivery", async () => {
    const { cfg } = fake([new Response(null, { status: 201 }), json([{ event_id: "wa:1" }])]);
    expect(await createSupabaseSeenStore(cfg).claim("wa:1", "print", NOW)).toBe(true);
  });

  it("refuses a replayed delivery on the primary key", async () => {
    // Meta retries; the 409 is the guard.
    const { cfg } = fake([json({ code: "23505", message: "duplicate key" }, 409)]);
    expect(await createSupabaseSeenStore(cfg).claim("wa:1", "print", NOW)).toBe(false);
  });

  it("refuses the same text sent twice in the window", async () => {
    const { cfg, calls } = fake([
      new Response(null, { status: 201 }),
      json([{ event_id: "wa:0" }, { event_id: "wa:1" }]),
    ]);
    expect(await createSupabaseSeenStore(cfg).claim("wa:1", "print", NOW)).toBe(false);
    expect(calls[1]?.url).toContain("fingerprint=eq.print");
  });

  it("propagates a real failure instead of silently reprocessing", async () => {
    const { cfg } = fake([json({ message: "boom" }, 500)]);
    await expect(createSupabaseSeenStore(cfg).claim("wa:1", "print", NOW)).rejects.toThrow(/Supabase 500/);
  });
});

describe("createSupabaseAuditSink", () => {
  it("writes the journal in one insert", async () => {
    const { cfg, calls } = fake([new Response(null, { status: 201 })]);
    await createSupabaseAuditSink(cfg)([
      { at: NOW, eventId: "wa:1", agent: "orchestrator", step: "received", detail: "whatsapp" },
      { at: NOW, eventId: "wa:1", agent: "reception", step: "queued", detail: "q-1" },
    ]);
    expect(calls).toHaveLength(1);
    expect((calls[0]?.body as unknown[]).length).toBe(2);
  });

  it("does nothing when there is nothing to write", async () => {
    const { cfg, calls } = fake([new Response(null, { status: 201 })]);
    await createSupabaseAuditSink(cfg)([]);
    expect(calls).toEqual([]);
  });
});
