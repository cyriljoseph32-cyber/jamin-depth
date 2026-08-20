import { release, type ReleaseDeps } from "@/agents/orchestrator";
import type { ApprovalQueue } from "@/agents/queue";
import { PRIORITY_ORDER } from "@/agents/queue";
import type { Lead } from "@/agents/adapters";
import { buildEveningReport, buildMorningBrief } from "./brief";
import { formatEveningReport, formatMorningBrief } from "./format";
import type { Journal } from "./journal";
import { isPaused, pause, resume, type StateStore } from "./state";
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
  /** Ce qu'il faut à `release()` pour exécuter une action approuvée. */
  release: ReleaseDeps;
  leads: () => Promise<readonly Lead[]>;
  /** Qui a tapé la commande — inscrit dans le journal et dans la file. */
  by: string;
  now: string;
}

/**
 * À qui revient une tâche déléguée. Table volontairement courte et explicite :
 * un routage deviné se trompe en silence, un routage écrit se corrige.
 */
export const DELEGATION: Readonly<Record<Venture, string>> = {
  DIVING: "reception",
  RUGBY: "assistant-cyril",
  COCO: "dev-coco",
  GLOBAL: "coco-command",
};

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
    case "help":
      return help();
  }
}

async function briefDeps(deps: CommandDeps) {
  return {
    journal: deps.journal,
    pending: await deps.queue.pending(),
    leads: await deps.leads(),
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
  const events = await deps.journal.list({ limit: 200 });
  const open = events
    .filter((e) => e.status === "PLANNED" || e.status === "RUNNING" || e.status === "WAITING_APPROVAL")
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.timestamp.localeCompare(b.timestamp));

  if (open.length === 0) return "Aucune tâche ouverte.";
  return [
    `[📌 TÂCHES OUVERTES] ${open.length}`,
    ...open.map(
      (e) =>
        `${e.priority} · #${e.venture} ${e.summary}${e.needs_owner ? " — /approve " + e.event_id : ` (${e.event_id})`}`,
    ),
  ].join("\n");
}

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

async function delegate(args: string, deps: CommandDeps): Promise<string> {
  if (!args) return "Utilisation : /delegate [projet] tâche — ex. /delegate RUGBY relancer les écoles";
  const [first, ...rest] = args.split(/\s+/);
  const venture: Venture = isVenture((first ?? "").toUpperCase()) ? ((first ?? "").toUpperCase() as Venture) : "GLOBAL";
  const task = (venture === "GLOBAL" && !isVenture((first ?? "").toUpperCase()) ? args : rest.join(" ")) || args;
  const agent = DELEGATION[venture];

  const event = await deps.journal.append(
    {
      venture,
      agent,
      type: "ACTION",
      priority: "P2",
      status: "PLANNED",
      summary: task,
      details: `Délégué par ${deps.by}.`,
      links: [],
      next_action: `${agent} prend la tâche`,
      needs_owner: false,
      level: 1,
    },
    deps.now,
  );

  return `📨 Délégué à ${agent} (#${venture}) : ${task}\nID : ${event.event_id}`;
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
