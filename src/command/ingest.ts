import { eventStatuses, eventTypes, isVenture, type CommandEventInput } from "./types";
import { levelForIngested } from "./levels";

/**
 * La validation des événements poussés de l'extérieur.
 *
 * À la main, sans zod : le dépôt n'a pas cette dépendance et quatre enums plus
 * six chaînes ne la justifient pas. Le contrat est strict par choix — un
 * événement mal formé rejeté avec un message précis coûte une correction ; un
 * événement accepté à moitié pollue le journal pour toujours.
 */

export const priorities = ["P0", "P1", "P2", "P3"] as const;

export type IngestResult =
  | { ok: true; event: CommandEventInput }
  | { ok: false; problems: string[] };

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function readIngestEvent(body: unknown): IngestResult {
  const problems: string[] = [];
  if (typeof body !== "object" || body === null) {
    return { ok: false, problems: ["le corps doit être un objet JSON"] };
  }
  const raw = body as Record<string, unknown>;

  const venture = str(raw.venture)?.toUpperCase() ?? "";
  if (!isVenture(venture)) problems.push("venture : COCO | DIVING | RUGBY | GLOBAL");

  const agent = str(raw.agent);
  if (!agent) problems.push("agent : nom de l'agent émetteur, obligatoire");

  const type = str(raw.type)?.toUpperCase() ?? "";
  if (!(eventTypes as readonly string[]).includes(type)) {
    problems.push(`type : ${eventTypes.join(" | ")}`);
  }

  const priority = str(raw.priority)?.toUpperCase() ?? "";
  if (!(priorities as readonly string[]).includes(priority)) problems.push("priority : P0 | P1 | P2 | P3");

  const status = str(raw.status)?.toUpperCase() ?? "";
  if (!(eventStatuses as readonly string[]).includes(status)) {
    problems.push(`status : ${eventStatuses.join(" | ")}`);
  }

  const summary = str(raw.summary);
  if (!summary) problems.push("summary : une phrase, obligatoire");
  if (summary && summary.length > 300) problems.push("summary : 300 caractères maximum");

  if (raw.needs_owner !== undefined && typeof raw.needs_owner !== "boolean") {
    problems.push("needs_owner : booléen");
  }

  const timestamp = str(raw.timestamp);
  if (timestamp && Number.isNaN(new Date(timestamp).getTime())) problems.push("timestamp : ISO-8601");

  const links = raw.links;
  if (links !== undefined && (!Array.isArray(links) || links.some((l) => typeof l !== "string"))) {
    problems.push("links : tableau de chaînes");
  }

  if (problems.length > 0) return { ok: false, problems };

  const needsOwner = raw.needs_owner === true;
  return {
    ok: true,
    event: {
      venture: venture as CommandEventInput["venture"],
      agent: agent as string,
      type: type as CommandEventInput["type"],
      priority: priority as CommandEventInput["priority"],
      // Une demande de décision est en attente, quoi que le projet ait déclaré.
      status: needsOwner ? "WAITING_APPROVAL" : (status as CommandEventInput["status"]),
      summary: summary as string,
      details: str(raw.details) ?? "",
      links: Array.isArray(links) ? (links as string[]) : [],
      next_action: str(raw.next_action) ?? "",
      needs_owner: needsOwner,
      // Borné et relevé ici : un projet tiers ne choisit pas son propre niveau
      // de liberté (`levelForIngested` force 3 dès que `needs_owner` est vrai).
      level: levelForIngested({ level: typeof raw.level === "number" ? raw.level : undefined, needs_owner: needsOwner }),
      event_id: str(raw.event_id) ?? undefined,
      timestamp: timestamp ?? undefined,
    },
  };
}
