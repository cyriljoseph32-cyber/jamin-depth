import { describe, expect, it } from "vitest";
import { createJournal } from "./journal";
import {
  createContentStore,
  draftContent,
  EmptyContentError,
  silentVentures,
  validateContent,
  type ContentDraft,
} from "./content";
import { ventures } from "./types";

const T0 = "2026-08-18T02:00:00.000Z"; // 09:00 Bangkok

function draft(over: Partial<ContentDraft> = {}): ContentDraft {
  return {
    venture: "DIVING",
    channel: "instagram",
    format: "reel",
    goal: "lead_generation",
    target_audience: "Voyageurs français arrivant à Koh Samui sous 30 jours",
    hook: "Tu n'as jamais plongé et ça te fait peur ?",
    key_message: "Le baptême se fait à trois mètres, avec un moniteur à portée de main.",
    cta: "Demande ton créneau en message",
    asset_needed: "",
    caption_draft: "Le premier souffle sous l'eau, filmé du début à la fin.",
    ...over,
  };
}

describe("validateContent", () => {
  it("refuse un contenu sans légende", () => {
    const problems = validateContent(draft({ caption_draft: "   " }));
    expect(problems.some((p) => p.startsWith("caption_draft"))).toBe(true);
  });

  it("refuse un contenu sans appel à l'action", () => {
    expect(validateContent(draft({ cta: "" })).some((p) => p.startsWith("cta"))).toBe(true);
  });

  it("refuse une audience vide", () => {
    const problems = validateContent(draft({ target_audience: "" }));
    expect(problems.some((p) => p.startsWith("target_audience"))).toBe(true);
  });

  it("accepte un brouillon complet", () => {
    expect(validateContent(draft())).toEqual([]);
  });
});

describe("createContentStore", () => {
  it("refuse d'enregistrer un contenu creux, et n'en garde aucune trace", async () => {
    const store = createContentStore(() => T0);
    await expect(store.create(draft({ caption_draft: "" }), T0)).rejects.toBeInstanceOf(
      EmptyContentError,
    );
    expect(await store.list()).toHaveLength(0);
  });

  it("programmer un contenu le passe en SCHEDULED", async () => {
    const store = createContentStore(() => T0);
    const item = await store.create(draft(), T0);
    const at = "2026-08-20T03:00:00.000Z";
    const scheduled = await store.schedule(item.content_id, at, T0);
    expect(scheduled?.status).toBe("SCHEDULED");
    expect(scheduled?.scheduled_at).toBe(at);
  });

  it("publier exige une URL, qui devient la preuve", async () => {
    const store = createContentStore(() => T0);
    const item = await store.create(draft(), T0);
    const published = await store.publish(item.content_id, "https://instagram.com/p/abc", T0);
    expect(published?.status).toBe("PUBLISHED");
    expect(published?.published_url).toBe("https://instagram.com/p/abc");
  });

  it("filtre la fenêtre du calendrier par date de programmation", async () => {
    const store = createContentStore(() => T0);
    const soon = await store.create(draft(), T0);
    const later = await store.create(draft({ hook: "Autre accroche pour un autre jour" }), T0);
    await store.schedule(soon.content_id, "2026-08-19T03:00:00.000Z", T0);
    await store.schedule(later.content_id, "2026-09-30T03:00:00.000Z", T0);

    const week = await store.list({ scheduledBefore: "2026-08-25T00:00:00.000Z" });
    expect(week.map((i) => i.content_id)).toEqual([soon.content_id]);
  });
});

describe("silentVentures", () => {
  it("signale une activité sans publication depuis plus de 72 h", async () => {
    const store = createContentStore(() => T0);
    const item = await store.create(draft(), "2026-08-10T02:00:00.000Z");
    await store.publish(item.content_id, "https://x", "2026-08-10T02:00:00.000Z");

    const silent = silentVentures(await store.list(), ["DIVING"], T0);
    expect(silent).toHaveLength(1);
    expect(silent[0]?.venture).toBe("DIVING");
  });

  it("ne signale pas une activité qui vient de publier", async () => {
    const store = createContentStore(() => T0);
    const item = await store.create(draft(), T0);
    await store.publish(item.content_id, "https://x", T0);

    expect(silentVentures(await store.list(), ["DIVING"], T0)).toEqual([]);
  });

  it("compte les contenus prêts : le silence n'a pas la même cause", async () => {
    const store = createContentStore(() => T0);
    const ready = await store.create(draft(), T0);
    await store.setStatus(ready.content_id, "APPROVED", T0);

    const silent = silentVentures(await store.list(), ["DIVING"], T0);
    expect(silent[0]?.readyToPublish).toBe(1);
    expect(silent[0]?.lastPublishedAt).toBeUndefined();
  });

  it("une activité sans aucun contenu est silencieuse", () => {
    const silent = silentVentures([], ventures, T0);
    expect(silent).toHaveLength(ventures.length);
  });
});

describe("draftContent", () => {
  it("écrit le contenu ET l'événement, liés, en attente de validation", async () => {
    const journal = createJournal(() => T0);
    const store = createContentStore(() => T0);

    const { item, event } = await draftContent(draft(), {
      content: store,
      journal,
      agent: "marketing",
      now: T0,
    });

    expect(item.status).toBe("WAITING_APPROVAL");
    expect(event.status).toBe("WAITING_APPROVAL");
    expect(event.needs_owner).toBe(true);
    // Publier sort de la maison : jamais en dessous de A3.
    expect(event.level).toBe(3);
    expect(event.links).toContain(item.content_id);
    expect(event.category).toBe("content");
  });

  it("remonte l'asset manquant comme prochaine action", async () => {
    const journal = createJournal(() => T0);
    const store = createContentStore(() => T0);

    const { event } = await draftContent(draft({ asset_needed: "une vidéo du baptême" }), {
      content: store,
      journal,
      agent: "marketing",
      now: T0,
    });

    expect(event.next_action).toContain("une vidéo du baptême");
  });
});
