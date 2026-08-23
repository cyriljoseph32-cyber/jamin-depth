import { afterEach, describe, expect, it, vi } from "vitest";
import {
  instagramFromEnv,
  lastPublishedAt,
  mediaComments,
  publishImage,
  recentMedia,
  replyToComment,
  type InstagramConfig,
} from "./instagram";

/** Un `fetch` qui répond dans l'ordre des réponses fournies. */
function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const impl = (async (input: string | URL, init?: RequestInit) => {
    const next = responses.shift() ?? { status: 500, body: { error: { message: "à court" } } };
    calls.push({
      url: input.toString(),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    return {
      ok: (next.status ?? 200) < 400,
      status: next.status ?? 200,
      json: async () => next.body,
    } as Response;
  }) as unknown as typeof fetch;
  return { impl, calls };
}

function cfg(fetchImpl: typeof fetch): InstagramConfig {
  return { igUserId: "17841400000000000", accessToken: "TOKEN", fetchImpl };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("instagramFromEnv", () => {
  it("rend null quand rien n'est configuré — l'état normal, pas une erreur", () => {
    vi.stubEnv("IG_USER_ID", "");
    vi.stubEnv("IG_ACCESS_TOKEN", "");
    expect(instagramFromEnv()).toBeNull();
  });

  it("rend null si le jeton manque, même avec un identifiant", () => {
    vi.stubEnv("IG_USER_ID", "17841400000000000");
    vi.stubEnv("IG_ACCESS_TOKEN", "");
    expect(instagramFromEnv()).toBeNull();
  });

  it("assemble la configuration quand les deux sont là", () => {
    vi.stubEnv("IG_USER_ID", "17841400000000000");
    vi.stubEnv("IG_ACCESS_TOKEN", "TOKEN");
    expect(instagramFromEnv()).toEqual({
      igUserId: "17841400000000000",
      accessToken: "TOKEN",
    });
  });
});

describe("recentMedia", () => {
  it("normalise les publications, légende et compteur absents compris", async () => {
    const { impl } = fakeFetch([
      {
        body: {
          data: [
            { id: "1", permalink: "https://instagram.com/p/1", timestamp: "2026-08-20T10:00:00+0000" },
          ],
        },
      },
    ]);
    const result = await recentMedia(cfg(impl));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.media[0]).toEqual({
      id: "1",
      permalink: "https://instagram.com/p/1",
      timestamp: "2026-08-20T10:00:00+0000",
      caption: "",
      commentsCount: 0,
    });
  });

  it("remonte le message de Meta mot pour mot", async () => {
    const { impl } = fakeFetch([
      {
        status: 403,
        body: { error: { message: "(#10) Application does not have permission for this action" } },
      },
    ]);
    const result = await recentMedia(cfg(impl));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.detail).toContain("does not have permission");
  });

  it("n'expose jamais le jeton dans le détail d'erreur", async () => {
    const { impl } = fakeFetch([{ status: 400, body: { error: { message: "Bad token" } } }]);
    const result = await recentMedia(cfg(impl));
    if (result.ok) return;
    expect(result.detail).not.toContain("TOKEN");
  });
});

describe("lastPublishedAt", () => {
  it("rend undefined sur erreur d'API — « je ne sais pas », pas « rien publié »", async () => {
    const { impl } = fakeFetch([{ status: 500, body: { error: { message: "panne" } } }]);
    expect(await lastPublishedAt(cfg(impl))).toBeUndefined();
  });

  it("rend la date de la dernière publication", async () => {
    const { impl } = fakeFetch([
      { body: { data: [{ id: "1", permalink: "p", timestamp: "2026-08-21T04:00:00+0000" }] } },
    ]);
    expect(await lastPublishedAt(cfg(impl))).toBe("2026-08-21T04:00:00+0000");
  });
});

describe("mediaComments", () => {
  it("normalise les commentaires", async () => {
    const { impl } = fakeFetch([
      { body: { data: [{ id: "c1", text: "Super !", username: "kim", timestamp: "2026-08-20T11:00:00+0000" }] } },
    ]);
    const result = await mediaComments(cfg(impl), "1");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.comments[0]?.username).toBe("kim");
  });
});

describe("publishImage", () => {
  it("crée le conteneur puis le publie, et rend l'identifiant comme preuve", async () => {
    const { impl, calls } = fakeFetch([{ body: { id: "CONTAINER" } }, { body: { id: "MEDIA" } }]);
    const result = await publishImage(cfg(impl), {
      imageUrl: "https://cdn/photo.jpg",
      caption: "Baptême de plongée",
    });

    expect(result).toEqual({ ok: true, id: "MEDIA" });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.url).toContain("/media");
    expect(calls[1]?.url).toContain("/media_publish");
    expect(calls[1]?.body).toContain("creation_id=CONTAINER");
  });

  it("s'arrête après le conteneur si la publication échoue — rien n'est montré", async () => {
    const { impl, calls } = fakeFetch([
      { body: { id: "CONTAINER" } },
      { status: 400, body: { error: { message: "Media not ready" } } },
    ]);
    const result = await publishImage(cfg(impl), { imageUrl: "https://cdn/x.jpg", caption: "" });

    expect(result.ok).toBe(false);
    expect(result.detail).toContain("Media not ready");
    expect(calls).toHaveLength(2);
  });

  it("ne publie pas si le conteneur échoue", async () => {
    const { impl, calls } = fakeFetch([{ status: 400, body: { error: { message: "Bad image_url" } } }]);
    const result = await publishImage(cfg(impl), { imageUrl: "nope", caption: "" });

    expect(result.ok).toBe(false);
    // Un seul appel : on n'enchaîne jamais sur un conteneur qui n'existe pas.
    expect(calls).toHaveLength(1);
  });

  it("refuse une publication sans identifiant retourné — sans preuve, pas de succès", async () => {
    const { impl } = fakeFetch([{ body: { id: "CONTAINER" } }, { body: {} }]);
    const result = await publishImage(cfg(impl), { imageUrl: "https://cdn/x.jpg", caption: "" });
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("sans identifiant");
  });
});

describe("replyToComment", () => {
  it("rend l'identifiant de la réponse", async () => {
    const { impl, calls } = fakeFetch([{ body: { id: "REPLY" } }]);
    const result = await replyToComment(cfg(impl), "c1", "Merci !");
    expect(result).toEqual({ ok: true, id: "REPLY" });
    expect(calls[0]?.url).toContain("/c1/replies");
  });

  it("remonte une erreur réseau au lieu de la laisser remonter en exception", async () => {
    const impl = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    const result = await replyToComment(cfg(impl), "c1", "Merci !");
    expect(result.ok).toBe(false);
    expect(result.detail).toContain("ECONNRESET");
  });
});
