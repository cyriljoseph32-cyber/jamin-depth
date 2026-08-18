import { timingSafeEqual } from "node:crypto";
import { priorities, readIngestEvent } from "@/command/ingest";
import { createCommandRuntime } from "@/command/runtime";
import { isVenture } from "@/command/types";

/**
 * L'entrée du journal pour les autres projets.
 *
 * `assistant-ai`, `coco2`, CSRA, `bot-trading-US` poussent ici un événement au
 * format imposé ; COCO COMMAND le journalise, le classe et le notifie. Aucune
 * lecture croisée de leurs bases : chaque projet reste maître de ses données et
 * n'envoie que ce qu'il veut voir remonter.
 *
 * Un événement de niveau ≥ 3 arrive en `WAITING_APPROVAL`. Un dépôt tiers ne
 * peut donc pas se faire auto-approuver : le jeton donne le droit d'écrire dans
 * le journal, jamais celui de décider à la place de Cyril.
 *
 * `GET` renvoie les décisions récentes, pour que le projet d'origine sache ce
 * qui a été approuvé sans qu'on ait à le rappeler.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function authorised(req: Request): boolean {
  const secret = process.env.COMMAND_INGEST_TOKEN?.trim();
  // Pas de jeton configuré = porte fermée, pas porte ouverte.
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(header, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req)) return new Response("unauthorized", { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "corps JSON illisible" }, { status: 400 });
  }

  const parsed = readIngestEvent(body);
  if (!parsed.ok) return Response.json({ error: "événement invalide", problems: parsed.problems }, { status: 400 });

  const rt = createCommandRuntime();
  const now = new Date().toISOString();

  try {
    const event = await rt.journal.append(parsed.event, now);
    const notified = await rt.notifier.announce(event, now);
    return Response.json(
      {
        event_id: event.event_id,
        status: event.status,
        level: event.level,
        notified,
        persistent: rt.persistent,
      },
      { status: 202 },
    );
  } catch (err) {
    console.error("coco-command: ingestion échouée:", err);
    return Response.json({ error: "journalisation impossible" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!authorised(req)) return new Response("unauthorized", { status: 401 });

  const url = new URL(req.url);
  const since = url.searchParams.get("since") ?? undefined;
  const venture = url.searchParams.get("venture") ?? undefined;
  const priority = url.searchParams.get("priority") ?? undefined;

  const rt = createCommandRuntime();
  const events = await rt.journal.list({
    since,
    venture: venture && isVenture(venture.toUpperCase()) ? (venture.toUpperCase() as never) : undefined,
    priority: priority && (priorities as readonly string[]).includes(priority) ? (priority as never) : undefined,
    limit: 100,
  });

  // Le contrat public est le format de l'événement, pas notre plomberie : les
  // champs internes (empreinte, notification, lien vers la file) ne sortent pas.
  return Response.json({
    events: events.map((e) => ({
      event_id: e.event_id,
      timestamp: e.timestamp,
      venture: e.venture,
      agent: e.agent,
      type: e.type,
      priority: e.priority,
      status: e.status,
      summary: e.summary,
      details: e.details,
      links: e.links,
      next_action: e.next_action,
      needs_owner: e.needs_owner,
    })),
  });
}
