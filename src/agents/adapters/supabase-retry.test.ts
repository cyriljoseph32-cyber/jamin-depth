import { describe, expect, it, vi } from "vitest";
import { request, type SupabaseConfig } from "./supabase";

/**
 * Les 504 de la passerelle PostgREST ont gelé le journal pendant ~10 h le 12/09 :
 * 16 crons sur 75 sont morts sur un `Supabase 504: Gateway Timeout` alors que la
 * base répondait normalement. Ces tests fixent le contrat du réessai pour que
 * personne ne le retire par inadvertance.
 */

const cfg = (fetchImpl: typeof fetch): SupabaseConfig => ({
  url: "https://exemple.supabase.co",
  serviceRoleKey: "cle-de-test",
  fetchImpl,
});

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const gateway = (status: number) => new Response('{"message":"Gateway Timeout"}', { status });

describe("request — réessai sur passerelle indisponible", () => {
  it("rejoue une lecture après un 504 et rend le résultat", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(gateway(504))
      .mockResolvedValueOnce(ok([{ id: "evt_1" }]));

    const rows = await request<Array<{ id: string }>>(cfg(fetchImpl), { path: "/command_events" });

    expect(rows).toEqual([{ id: "evt_1" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("réessaie aussi sur 502 et 503", async () => {
    for (const status of [502, 503]) {
      const fetchImpl = vi.fn<typeof fetch>()
        .mockResolvedValueOnce(gateway(status))
        .mockResolvedValueOnce(ok([]));
      await expect(request(cfg(fetchImpl), { path: "/leads" })).resolves.toEqual([]);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    }
  });

  it("abandonne après 3 tentatives et remonte la PostgrestError", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(gateway(504));

    await expect(request(cfg(fetchImpl), { path: "/command_events" })).rejects.toThrow(/Supabase 504/);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("ne réessaie jamais une 4xx — insister ne la corrigera pas", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValue(new Response('{"message":"invalid"}', { status: 400 }));

    await expect(request(cfg(fetchImpl), { path: "/command_events" })).rejects.toThrow(/Supabase 400/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("ne rejoue PAS une écriture simple — un doublon coûte plus cher qu'un échec", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(gateway(504));

    await expect(
      request(cfg(fetchImpl), { method: "POST", path: "/command_events", body: { summary: "x" } }),
    ).rejects.toThrow(/Supabase 504/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejoue un upsert : merge-duplicates est idempotent par construction", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(gateway(504))
      .mockResolvedValueOnce(ok([{ key: "lead_1" }]));

    const rows = await request(cfg(fetchImpl), {
      method: "POST",
      path: "/leads",
      body: { key: "lead_1" },
      prefer: "resolution=merge-duplicates,return=representation",
    });

    expect(rows).toEqual([{ key: "lead_1" }]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("traite une coupure réseau comme une passerelle indisponible", async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(ok([]));

    await expect(request(cfg(fetchImpl), { path: "/leads" })).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("rend undefined sur 204 sans tenter de lire un corps vide", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    await expect(request(cfg(fetchImpl), { method: "PATCH", path: "/leads" })).resolves.toBeUndefined();
  });
});
