/**
 * Instagram, via l'API Graph de Meta.
 *
 * Trois usages, et un seul est autonome : **lire**. Savoir ce qui a été publié
 * et quand est ce qui permet à `/silence` de dire la vérité au lieu de deviner.
 *
 * Publier et répondre, en revanche, sortent de la maison : ce sont des actions
 * de niveau A3. Ce module ne fait que les *exécuter* — la décision reste à
 * `policy.ts` et à `release()`, comme pour tout le reste. Aucun appel d'ici ne
 * doit court-circuiter la file de validation.
 *
 * **Les messages privés ne sont pas couverts.** Ils exigent la permission
 * `instagram_manage_messages`, soumise à revue d'application par Meta : ce
 * n'est pas une question de code, et prétendre les traiter serait mentir sur
 * ce que le système surveille.
 *
 * Serveur uniquement — le jeton donne le droit de publier.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

/**
 * Le résultat d'une écriture. Même forme que `sendText` de l'adaptateur
 * Telegram : `detail` porte le message de Meta mot pour mot, et `id`
 * l'identifiant qui sert de preuve d'exécution.
 */
export interface InstagramWriteResult {
  ok: boolean;
  id?: string;
  detail?: string;
}

export interface InstagramConfig {
  /** L'identifiant du compte Instagram Business. */
  igUserId: string;
  /** Jeton longue durée. Jamais journalisé. */
  accessToken: string;
  fetchImpl?: typeof fetch;
}

/**
 * Configuration lue depuis l'environnement, ou `null`.
 *
 * `null` n'est pas une erreur : c'est l'état normal tant que Cyril n'a pas
 * créé l'app Meta. Tout ce qui dépend d'Instagram doit continuer à tourner
 * sans lui, exactement comme le système tourne sans Telegram.
 */
export function instagramFromEnv(): InstagramConfig | null {
  const igUserId = process.env.IG_USER_ID?.trim();
  const accessToken = process.env.IG_ACCESS_TOKEN?.trim();
  if (!igUserId || !accessToken) return null;
  return { igUserId, accessToken };
}

export interface InstagramMedia {
  id: string;
  permalink: string;
  /** ISO-8601. */
  timestamp: string;
  caption: string;
  commentsCount: number;
}

export interface InstagramComment {
  id: string;
  text: string;
  username: string;
  timestamp: string;
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

/**
 * Un appel Graph.
 *
 * Les erreurs remontent telles quelles dans `detail` : « (#10) Application does
 * not have permission for this action » dit exactement quoi corriger, là où un
 * « échec Instagram » générique enverrait chercher au mauvais endroit.
 */
async function call<T>(
  cfg: InstagramConfig,
  path: string,
  init?: { method?: string; body?: Record<string, string> },
): Promise<{ ok: true; data: T } | { ok: false; detail: string }> {
  const doFetch = cfg.fetchImpl ?? fetch;
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", cfg.accessToken);

  try {
    const res = await doFetch(url, {
      method: init?.method ?? "GET",
      ...(init?.body
        ? {
            method: init.method ?? "POST",
            headers: { "content-type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams(init.body).toString(),
          }
        : {}),
    });
    const payload = (await res.json()) as T & GraphError;
    if (!res.ok || payload.error) {
      const err = payload.error;
      return {
        ok: false,
        detail: `instagram-${res.status}: ${err?.message ?? "réponse illisible"}`,
      };
    }
    return { ok: true, data: payload };
  } catch (err) {
    return { ok: false, detail: `instagram-réseau: ${(err as Error).message}` };
  }
}

/* ------------------------------------------------------------------ *
 * Lecture — autonome (A0)
 * ------------------------------------------------------------------ */

/** Les publications récentes. Alimente `/silence` et le suivi d'engagement. */
export async function recentMedia(
  cfg: InstagramConfig,
  limit = 25,
): Promise<{ ok: true; media: InstagramMedia[] } | { ok: false; detail: string }> {
  const fields = "id,permalink,timestamp,caption,comments_count";
  const result = await call<{
    data?: { id: string; permalink: string; timestamp: string; caption?: string; comments_count?: number }[];
  }>(cfg, `/${cfg.igUserId}/media?fields=${fields}&limit=${limit}`);

  if (!result.ok) return result;
  return {
    ok: true,
    media: (result.data.data ?? []).map((m) => ({
      id: m.id,
      permalink: m.permalink,
      timestamp: m.timestamp,
      caption: m.caption ?? "",
      commentsCount: m.comments_count ?? 0,
    })),
  };
}

/** Les commentaires d'une publication. */
export async function mediaComments(
  cfg: InstagramConfig,
  mediaId: string,
): Promise<{ ok: true; comments: InstagramComment[] } | { ok: false; detail: string }> {
  const result = await call<{
    data?: { id: string; text?: string; username?: string; timestamp: string }[];
  }>(cfg, `/${mediaId}/comments?fields=id,text,username,timestamp`);

  if (!result.ok) return result;
  return {
    ok: true,
    comments: (result.data.data ?? []).map((c) => ({
      id: c.id,
      text: c.text ?? "",
      username: c.username ?? "",
      timestamp: c.timestamp,
    })),
  };
}

/**
 * L'instant de la dernière publication, ou `undefined`.
 *
 * `undefined` veut dire « je ne sais pas », pas « rien n'a été publié » — et
 * les deux ne se traitent pas pareil : sur une erreur d'API, le silence
 * rapporté serait une fausse alerte.
 */
export async function lastPublishedAt(cfg: InstagramConfig): Promise<string | undefined> {
  const result = await recentMedia(cfg, 1);
  if (!result.ok) return undefined;
  return result.media[0]?.timestamp;
}

/* ------------------------------------------------------------------ *
 * Publication — A3, jamais sans validation
 * ------------------------------------------------------------------ */

/**
 * Publie une image avec sa légende.
 *
 * Deux temps, imposés par Meta : créer le conteneur, puis le publier. Si le
 * second échoue, le conteneur reste en suspens sans rien montrer publiquement —
 * l'échec est donc silencieux côté audience, ce qui est le bon sens de l'échec
 * pour une action non validée jusqu'au bout.
 *
 * N'appeler que depuis `release()`, après un `/approve`.
 */
export async function publishImage(
  cfg: InstagramConfig,
  input: { imageUrl: string; caption: string },
): Promise<InstagramWriteResult> {
  const container = await call<{ id?: string }>(cfg, `/${cfg.igUserId}/media`, {
    body: { image_url: input.imageUrl, caption: input.caption },
  });
  if (!container.ok) return { ok: false, detail: container.detail };

  const creationId = container.data.id;
  if (!creationId) return { ok: false, detail: "instagram: conteneur sans identifiant" };

  const published = await call<{ id?: string }>(cfg, `/${cfg.igUserId}/media_publish`, {
    body: { creation_id: creationId },
  });
  if (!published.ok) return { ok: false, detail: published.detail };

  const id = published.data.id;
  // L'identifiant du média EST la preuve de publication : il remonte dans
  // `reference_id`, faute de quoi l'événement ressortira « non vérifié ».
  return id ? { ok: true, id } : { ok: false, detail: "instagram: publication sans identifiant" };
}

/**
 * Répond à un commentaire public. A3 également — c'est la marque qui parle.
 */
export async function replyToComment(
  cfg: InstagramConfig,
  commentId: string,
  message: string,
): Promise<InstagramWriteResult> {
  const result = await call<{ id?: string }>(cfg, `/${commentId}/replies`, {
    body: { message },
  });
  if (!result.ok) return { ok: false, detail: result.detail };
  const id = result.data.id;
  return id ? { ok: true, id } : { ok: false, detail: "instagram: réponse sans identifiant" };
}
