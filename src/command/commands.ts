import { release, type ReleaseDeps } from "@/agents/orchestrator";
import type { ApprovalQueue } from "@/agents/queue";
import { PRIORITY_ORDER } from "@/agents/queue";
import type { Lead } from "@/agents/adapters";
import { buildEveningReport, buildMorningBrief, buildWeeklyReport } from "./brief";
import { formatEveningReport, formatMorningBrief, formatWeeklyReport } from "./format";
import type { Journal } from "./journal";
import { kpiMetrics, METRIC_LABEL, parseKpi, type KpiStore } from "./kpi";
import { agentFor, guessCategory, resolveSpecRole, UNASSIGNED } from "./routing";
import { isPaused, pause, resume, type StateStore } from "./state";
import { openTask, VagueTaskError, type TaskStore } from "./tasks";
import {
  CALENDAR_HORIZON_MS,
  silentVentures,
  type ContentStore,
} from "./content";
import { bangkokClock, isVenture, ventures, type CommandEvent, type Venture } from "./types";

/**
 * Les commandes Telegram.
 *
 * Aucune I/O réseau ici : tout arrive par `deps`, donc chaque commande se teste
 * sans bot. `runCommand` renvoie du texte ; c'est l'appelant (la route) qui le
 * poste, et c'est ce qui permet à `/approve` de suivre exactement le même
 * chemin que le bouton ✅ de la carte — un seul chemin d'exécution, pas deux.
 */

export const commandNames = [
  "today",
  "brief",
  "report",
  "status",
  "tasks",
  "approve",
  "reject",
  "delegate",
  "focus",
  "priority",
  "pause",
  "resume",
  "audit",
  "kpi",
  "week",
  "contenu",
  "silence",
  "help",
] as const;
export type CommandName = (typeof commandNames)[number];

export interface ParsedCommand {
  name: CommandName;
  /** Tout ce qui suit la commande, brut. */
  args: string;
}

export function isCommandName(value: string): value is CommandName {
  return (commandNames as readonly string[]).includes(value);
}

/** `/status DIVING@mon_bot` → `{ name: "status", args: "DIVING" }`. `null` si ce n'en est pas une. */
export function parseCommand(text: string): ParsedCommand | null {
  const m = /^\/([a-zA-Z_]+)(?:@\S+)?\s*([\s\S]*)$/.exec(text.trim());
  if (!m) return null;
  const name = (m[1] ?? "").toLowerCase();
  if (!isCommandName(name)) return null;
  return { name, args: (m[2] ?? "").trim() };
}

export interface CommandDeps {
  journal: Journal;
  queue: ApprovalQueue;
  state: StateStore;
  tasks: TaskStore;
  kpis: KpiStore;
  content: ContentStore;
  /** Ce qu'il faut à `release()` pour exécuter une action approuvée. */
  release: ReleaseDeps;
  leads: () => Promise<readonly Lead[]>;
  /** Qui a tapé la commande — inscrit dans le journal et dans la file. */
  by: string;
  now: string;
}

export async function runCommand(cmd: ParsedCommand, deps: CommandDeps): Promise<string> {
  switch (cmd.name) {
    case "today":
    case "brief":
      return formatMorningBrief(await briefDeps(deps).then(buildMorningBrief));
    case "report":
      return formatEveningReport(await briefDeps(deps).then(buildEveningReport));
    case "status":
      return status(cmd.args, deps);
    case "tasks":
      return tasks(deps);
    case "contenu":
      return contentCalendar(cmd.args, deps);
    case "silence":
      return silence(deps);
    case "approve":
    case "reject":
      return decide(cmd, deps);
    case "delegate":
      return delegate(cmd.args, deps);
    case "focus":
      return focus(cmd.args, deps);
    case "priority":
      return priority(cmd.args, deps);
    case "pause":
    case "resume":
      return togglePause(cmd, deps);
    case "audit":
      return audit(deps);
    case "kpi":
      return kpi(cmd.args, deps);
    case "week":
      return formatWeeklyReport(await briefDeps(deps).then(buildWeeklyReport));
    case "help":
      return help();
  }
}

async function briefDeps(deps: CommandDeps) {
  return {
    journal: deps.journal,
    pending: await deps.queue.pending(),
    leads: await deps.leads(),
    tasks: await deps.tasks.list({ openOnly: true, limit: 200 }),
    kpis: await deps.kpis.list({ limit: 500 }),
    content: await deps.content.list({ limit: 300 }),
    now: deps.now,
  };
}

/* ------------------------------------------------------------------ *
 * Lecture
 * ------------------------------------------------------------------ */

async function status(args: string, deps: CommandDeps): Promise<string> {
  const target = args.trim().toUpperCase();
  const wanted: readonly Venture[] = isVenture(target) ? [target] : ventures;
  const state = await deps.state.read();
  const lines: string[] = [];

  for (const venture of wanted) {
    const events = await deps.journal.list({ venture, limit: 50 });
    const open = events.filter((e) => e.status !== "DONE");
    const paused = isPaused(state, { venture, agent: "", priority: "P2" });
    lines.push(
      `#${venture}${state.focus === venture ? " ⭐ focus" : ""}${paused ? " ⏸ en pause" : ""}`,
      `· événements 24 h : ${events.length} · ouverts : ${open.length}`,
    );
    const blocked = open.filter((e) => e.status === "BLOCKED" || e.status === "FAILED");
    if (blocked.length > 0) lines.push(`· blocages : ${blocked.map((e) => e.summary).join(" ; ")}`);
    const next = open[0];
    lines.push(`· prochaine étape : ${next ? next.next_action || next.summary : "—"}`, "");
  }

  return lines.join("\n").trim();
}

async function tasks(deps: CommandDeps): Promise<string> {
  const open = await deps.tasks.list({ openOnly: true, limit: 100 });
  const events = await deps.journal.list({ limit: 200 });

  // Les événements ouverts qui ne sont adossés à aucune tâche : cartes de
  // validation de la plongée, événements poussés par un autre dépôt.
  const loose = events
    .filter((e) => e.status === "PLANNED" || e.status === "RUNNING" || e.status === "WAITING_APPROVAL")
    .filter((e) => !e.task_id)
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.timestamp.localeCompare(b.timestamp));

  if (open.length === 0 && loose.length === 0) return "Aucune tâche ouverte.";

  const lines = [`[📌 TÂCHES OUVERTES] ${open.length + loose.length}`];
  for (const task of open) {
    const due = task.deadline ? ` · échéance ${task.deadline.slice(0, 10)}` : "";
    lines.push(
      `${task.priority} · #${task.venture} ${task.objective} — ${task.assigned_agent}${due} (${task.task_id})`,
    );
  }
  for (const e of loose) {
    lines.push(
      `${e.priority} · #${e.venture} ${e.summary}${e.needs_owner ? ` — /approve ${e.event_id}` : ` (${e.event_id})`}`,
    );
  }
  return lines.join("\n");
}

/**
 * `/kpi diving bookings 3 [note]` — la saisie des chiffres.
 *
 * Le système ne voit ni les paiements, ni les réservations prises au comptoir,
 * ni les inscriptions signées sur le bord du terrain. Il peut soit inventer,
 * soit demander. Il demande.
 */
async function kpi(args: string, deps: CommandDeps): Promise<string> {
  if (args) {
    const parsed = parseKpi(args);
    if (!parsed.ok) return parsed.message;
    const entry = await deps.kpis.record({ ...parsed.draft, by: deps.by }, deps.now);
    return `📈 Enregistré — #${entry.venture} ${METRIC_LABEL[entry.metric]} : ${entry.value}${entry.note ? ` (${entry.note})` : ""}`;
  }

  // Sans argument : ce qui a été saisi aujourd'hui, ou le mode d'emploi.
  const since = new Date(new Date(deps.now).getTime() - 86_400_000).toISOString();
  const today = await deps.kpis.list({ since });
  if (today.length === 0) return usage;

  return [
    "[📈 SAISIES 24 h]",
    ...today.map((e) => `· #${e.venture} ${METRIC_LABEL[e.metric]} : ${e.value}${e.note ? ` — ${e.note}` : ""}`),
  ].join("\n");
}

const usage = [
  "Utilisation : /kpi [projet] [métrique] [valeur] [note]",
  `Projets : ${ventures.join(", ")}`,
  `Métriques : ${kpiMetrics.join(", ")}`,
  "Ex. /kpi DIVING bookings 3 deux Open Water",
].join("\n");

async function audit(deps: CommandDeps): Promise<string> {
  const since = new Date(new Date(deps.now).getTime() - 86_400_000).toISOString();
  const events = await deps.journal.list({ since, limit: 300 });
  const count = (predicate: (e: CommandEvent) => boolean) => events.filter(predicate).length;

  const errors = events.filter((e) => e.type === "ERROR" || e.status === "FAILED");
  const approvals = events.filter((e) => e.type === "APPROVAL" || e.status === "WAITING_APPROVAL");
  const spend = events.filter((e) => e.level === 4);

  return [
    `[🧾 AUDIT 24 h — ${bangkokClock(deps.now)}]`,
    `Actions : ${count((e) => e.type === "ACTION")} · faites ${count((e) => e.status === "DONE")}`,
    `Validations : ${approvals.length} · en attente ${(await deps.queue.pending()).length}`,
    `Erreurs / échecs : ${errors.length}`,
    ...errors.slice(0, 5).map((e) => `· ${e.venture} ${e.summary} (${e.event_id})`),
    `Niveau 4 (argent, contrats, accès) : ${spend.length}`,
    ...spend.slice(0, 5).map((e) => `· ${e.venture} ${e.summary} — ${e.status} (${e.event_id})`),
  ].join("\n");
}

function help(): string {
  return [
    "[🧭 COCO COMMAND]",
    "/today · /brief — priorités du jour",
    "/report — bilan depuis le dernier rapport",
    "/status [projet] — état, blocages, prochaine étape",
    "/tasks — tâches ouvertes par priorité",
    "/approve ID · /reject ID [raison]",
    "/delegate [tâche] · /priority [sujet]",
    "/focus [projet] · /pause [cible] · /resume [cible]",
    "/audit — 24 dernières heures",
    "/kpi [projet] [métrique] [valeur] — saisir un chiffre",
    "/week — bilan de la semaine",
  ].join("\n");
}

/* ------------------------------------------------------------------ *
 * Décisions
 * ------------------------------------------------------------------ */

/**
 * `/approve evt_…` et `/reject evt_… raison`.
 *
 * L'identifiant doit désigner exactement l'événement en attente : pas de
 * « dernier en date », pas de correspondance approximative. C'est la garantie
 * qu'une validation ne peut pas glisser d'une action à une autre.
 */
async function decide(cmd: ParsedCommand, deps: CommandDeps): Promise<string> {
  const [id, ...rest] = cmd.args.split(/\s+/).filter((s) => s.length > 0);
  const reason = rest.join(" ");
  if (!id) return `Identifiant manquant. Utilisation : /${cmd.name} evt_20260818_0930_ab12cd34`;

  const event = await deps.journal.get(id);
  if (!event) return `Introuvable : ${id}. /tasks liste ce qui attend.`;
  if (event.status !== "WAITING_APPROVAL") {
    return `${id} n'attend pas de décision (statut : ${event.status}).`;
  }

  const approving = cmd.name === "approve";

  // Un événement adossé à une action de la file suit le chemin normal
  // d'exécution — le même que le bouton de la carte Telegram.
  if (event.queue_item_id) {
    const result = await release(event.queue_item_id, approving ? "approve" : "reject", deps.by, deps.release);
    switch (result.status) {
      case "sent":
        await deps.journal.setStatus(id, "DONE", `Approuvé par ${deps.by} — envoyé.`);
        return `✅ ${id} approuvé et exécuté.`;
      case "recorded":
        await deps.journal.setStatus(id, "DONE", `Approuvé par ${deps.by} — décision enregistrée.`);
        return `✅ ${id} approuvé. L'acte reste à faire dans l'outil concerné.`;
      case "rejected":
        await deps.journal.setStatus(id, "BLOCKED", `Rejeté par ${deps.by}${reason ? ` — ${reason}` : ""}.`);
        return `✖️ ${id} rejeté.`;
      case "blocked":
        await deps.journal.setStatus(id, "BLOCKED", `Approuvé mais non exécuté — ${result.detail ?? "garde-fou"}.`);
        return `⛔ ${id} approuvé mais NON exécuté — ${result.detail ?? "bloqué par le garde-fou"}. À relire.`;
      case "already_decided":
        return `${id} a déjà été traité.`;
      case "not_found":
        return `L'action liée à ${id} est introuvable dans la file.`;
    }
  }

  // Événement poussé par un autre projet : il n'y a rien à exécuter ici, la
  // décision est enregistrée et le projet d'origine la relit sur l'API.
  const status = approving ? "DONE" : "BLOCKED";
  const verb = approving ? "Approuvé" : "Rejeté";
  await deps.journal.setStatus(id, status, `${verb} par ${deps.by}${reason ? ` — ${reason}` : ""}.`);
  return `${approving ? "✅" : "✖️"} ${id} ${approving ? "approuvé" : "rejeté"} — décision enregistrée pour ${event.venture}.`;
}

/* ------------------------------------------------------------------ *
 * Pilotage
 * ------------------------------------------------------------------ */

/**
 * `/delegate [projet|rôle] objectif [| fini quand …] [| avant AAAA-MM-JJ]`
 *
 * Trois formes acceptées, de la plus rapide à la plus complète :
 *   /delegate RUGBY relancer les écoles de Lamai
 *   /delegate diving_sales_agent répondre aux deux Français du 26
 *   /delegate COCO démarcher 5 hôtels | fini quand 5 fiches créées | avant 2026-09-01
 *
 * Sans condition de fin explicite, une condition par défaut est écrite — et la
 * réponse le dit. Ce qui n'est pas inventé, c'est le contenu : la condition par
 * défaut renvoie à la preuve exigée du journal, elle ne prétend rien savoir de
 * l'objectif.
 */
async function delegate(args: string, deps: CommandDeps): Promise<string> {
  if (!args) {
    return [
      "Utilisation : /delegate [projet|rôle] objectif",
      "Options : | fini quand … | avant AAAA-MM-JJ",
      "Ex. /delegate RUGBY relancer les écoles de Lamai | avant 2026-09-01",
    ].join("\n");
  }

  const [head, ...options] = args.split("|").map((part) => part.trim());
  const [first, ...rest] = (head ?? "").split(/\s+/);
  const token = (first ?? "").toUpperCase();

  // Un rôle du mandat (`diving_sales_agent`) ou une venture — les deux se
  // ramènent au même triplet (venture, catégorie, agent).
  const role = resolveSpecRole(first ?? "");
  const explicitVenture = isVenture(token);
  const objective = (role || explicitVenture ? rest.join(" ") : head) || head || "";

  const venture: Venture = role ? role.venture : explicitVenture ? (token as Venture) : "GLOBAL";
  const category = role ? role.category : guessCategory(objective);
  const agent = role ? role.agent : agentFor(venture, category);

  const done = option(options, /^fini quand\s+/i) ?? DEFAULT_DONE;
  const deadline = deadlineFrom(option(options, /^avant\s+/i));

  try {
    const { task, event } = await openTask(
      {
        venture,
        assigned_agent: agent,
        category,
        priority: "P2",
        level: 1,
        objective,
        context: `Délégué par ${deps.by}.`,
        constraints: "",
        definition_of_done: done,
        deadline,
        requires_approval: false,
        next_step_if_success: "",
        next_step_if_failure: `remonter à ${deps.by}`,
      },
      { tasks: deps.tasks, journal: deps.journal, by: deps.by, now: deps.now },
    );

    return [
      `📨 ${agent === UNASSIGNED ? "Aucun agent titulaire" : `Délégué à ${agent}`} — #${venture} · ${category}`,
      `Objectif : ${task.objective}`,
      `Fini quand : ${task.definition_of_done}`,
      task.deadline ? `Échéance : ${task.deadline.slice(0, 10)}` : "Échéance : aucune",
      `Tâche : ${task.task_id} · Événement : ${event.event_id}`,
      agent === UNASSIGNED
        ? "⚠️ Personne ne couvre cette catégorie — la tâche est ouverte mais sans titulaire."
        : "",
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  } catch (err) {
    if (err instanceof VagueTaskError) {
      return [`⚠️ Tâche refusée — elle ne pourrait pas être close :`, ...err.problems.map((p) => `· ${p}`)].join("\n");
    }
    throw err;
  }
}

/**
 * La condition de fin par défaut.
 *
 * Elle ne devine rien de l'objectif : elle exige la preuve. C'est la seule
 * chose qu'on puisse affirmer sans connaître la tâche.
 */
const DEFAULT_DONE = "objectif atteint et résultat journalisé avec une référence vérifiable";

function option(options: readonly string[], prefix: RegExp): string | undefined {
  const found = options.find((o) => prefix.test(o));
  return found ? found.replace(prefix, "").trim() || undefined : undefined;
}

/** `2026-09-01` → fin de journée à Bangkok. Une date sans heure veut dire « ce jour-là ». */
function deadlineFrom(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const day = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59+07:00` : value;
  const parsed = new Date(day);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

async function priority(args: string, deps: CommandDeps): Promise<string> {
  if (!args) return "Utilisation : /priority [sujet] — ex. /priority relancer Six Senses";
  const event = await deps.journal.append(
    {
      venture: "GLOBAL",
      agent: "coco-command",
      type: "ACTION",
      priority: "P1",
      status: "PLANNED",
      summary: args,
      details: `Priorité fixée par ${deps.by}.`,
      links: [],
      next_action: "à traiter aujourd'hui",
      needs_owner: false,
      level: 1,
    },
    deps.now,
  );
  return `🎯 Priorité enregistrée : ${args}\nID : ${event.event_id}`;
}

async function focus(args: string, deps: CommandDeps): Promise<string> {
  const target = args.trim().toUpperCase();
  if (!isVenture(target)) return `Projet inconnu. Au choix : ${ventures.join(", ")}.`;
  const state = await deps.state.read();
  await deps.state.write({ ...state, focus: target, updatedAt: deps.now });
  return `⭐ Focus sur #${target}.`;
}

async function togglePause(cmd: ParsedCommand, deps: CommandDeps): Promise<string> {
  const target = cmd.args.trim();
  if (!target) return `Utilisation : /${cmd.name} [projet ou agent]`;
  const state = await deps.state.read();
  const next = cmd.name === "pause" ? pause(state, target, deps.now) : resume(state, target, deps.now);
  await deps.state.write(next);
  return cmd.name === "pause"
    ? `⏸ ${target} en pause — les automatisations non critiques s'arrêtent. Les P0 continuent de remonter.`
    : `▶️ ${target} reprend.`;
}

/* ------------------------------------------------------------------ *
 * Calendrier éditorial
 * ------------------------------------------------------------------ */

/** `/contenu [activité]` — ce qui doit sortir dans les 7 jours. */
async function contentCalendar(args: string, deps: CommandDeps): Promise<string> {
  const wanted = args.trim().toUpperCase();
  const venture = isVenture(wanted) ? wanted : undefined;
  if (wanted.length > 0 && !venture) {
    return `Activité inconnue : ${args.trim()}. Attendu : ${ventures.join(", ")}.`;
  }

  const horizon = new Date(new Date(deps.now).getTime() + CALENDAR_HORIZON_MS).toISOString();
  const planned = await deps.content.list({ venture, openOnly: true, limit: 100 });
  const soon = planned.filter((i) => i.scheduled_at !== undefined && i.scheduled_at <= horizon);
  // Un contenu prêt mais sans date ne sortira jamais tout seul : il mérite
  // autant d'être vu que celui qui est programmé.
  const undated = planned.filter((i) => i.scheduled_at === undefined);

  if (soon.length === 0 && undated.length === 0) {
    return venture
      ? `Rien de prévu pour #${venture} dans les 7 jours.`
      : "Rien de prévu dans les 7 jours, aucune activité.";
  }

  const lines = [`[📅 CALENDRIER — 7 JOURS] ${soon.length + undated.length} contenu(s)`];
  if (soon.length > 0) {
    lines.push("", "Programmés :");
    for (const i of soon) {
      lines.push(
        `· ${i.scheduled_at?.slice(0, 10)} #${i.venture} ${i.format}/${i.channel} — ${i.hook} [${i.status}]`,
      );
    }
  }
  if (undated.length > 0) {
    lines.push("", "Prêts, sans date :");
    for (const i of undated) {
      const missing = i.asset_needed ? ` — manque ${i.asset_needed}` : "";
      lines.push(`· #${i.venture} ${i.format}/${i.channel} — ${i.hook} [${i.status}]${missing}`);
    }
  }
  return lines.join("\n");
}

/** `/silence` — les activités muettes depuis plus de 72 heures. */
async function silence(deps: CommandDeps): Promise<string> {
  const all = await deps.content.list({ limit: 300 });
  const silent = silentVentures(all, ventures, deps.now);
  if (silent.length === 0) return "Aucune activité silencieuse — toutes ont publié sous 72 h.";

  const lines = [`[🔇 SILENCE] ${silent.length} activité(s) muette(s) depuis plus de 72 h`];
  for (const s of silent) {
    const last = s.lastPublishedAt
      ? `dernière publication ${s.lastPublishedAt.slice(0, 10)}`
      : "aucune publication enregistrée";
    // Distinction qui change l'action : produire, ou publier ce qui attend.
    const ready =
      s.readyToPublish > 0
        ? ` — ${s.readyToPublish} contenu(s) prêt(s), il manque la publication`
        : " — rien de prêt, il manque la production";
    lines.push(`· #${s.venture} : ${last}${ready}`);
  }
  return lines.join("\n");
}
