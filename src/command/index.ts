/**
 * COCO COMMAND — la couche chef d'état-major.
 *
 * Le système d'agents (`src/agents/`) fait tourner la plongée. Celui-ci pilote
 * l'ensemble des activités de Cyril et n'a qu'un seul interlocuteur humain, sur
 * Telegram.
 *
 * Point d'entrée :
 *   const rt = createCommandRuntime();
 *   await rt.journal.append({ … });        // toute action laisse une trace
 *   await rt.notifier.announce(event, now); // puis part si elle l'exige
 *   await runCommand(parseCommand("/tasks")!, commandDeps(rt, "cyril", now));
 *
 * Serveur uniquement.
 */

export type {
  ActionLevel,
  CommandEvent,
  CommandEventInput,
  CommandEventType,
  CommandStatus,
  Venture,
} from "./types";
export {
  bangkokClock,
  bangkokDate,
  bangkokTime,
  eventStatuses,
  eventTypes,
  fingerprintOf,
  isVenture,
  newEventId,
  ventures,
} from "./types";

export { levelFor, levelForActionType, levelForIngested, needsOwnerApproval, LEVEL_LABEL } from "./levels";
export { agentTag, tagsFor } from "./tags";

export { buildEvent, byRecency, createJournal, matches, DEDUPE_WINDOW_MS } from "./journal";
export type { Journal, JournalFilter } from "./journal";

export { createStateStore, emptyState, isPaused, pause, resume } from "./state";
export type { CommandState, StateStore } from "./state";

export {
  facets,
  formatAction,
  formatAlert,
  formatApproval,
  formatDigest,
  formatEvent,
  formatEveningReport,
  formatMorningBrief,
  plainDetails,
} from "./format";
export type { EveningReport, MorningBrief } from "./format";

export { chatForEvent, createNotifier, isImmediate, isStuck, STUCK_AFTER_MS } from "./notify";
export type { Notifier, NotifierDeps } from "./notify";

export { buildEveningReport, buildMorningBrief } from "./brief";
export type { BriefDeps } from "./brief";

export { commandNames, DELEGATION, isCommandName, parseCommand, runCommand } from "./commands";
export type { CommandDeps, CommandName, ParsedCommand } from "./commands";

export { commandDeps, createCommandRuntime, queuedItemEvent, settleJournalForQueueItem } from "./runtime";
export type { CommandRuntime } from "./runtime";

export { commandJobs, isCommandJob, runCommandJob } from "./jobs";
export type { CommandJob, CommandJobResult } from "./jobs";

export { priorities, readIngestEvent } from "./ingest";
export type { IngestResult } from "./ingest";

export { createSupabaseJournal, createSupabaseStateStore } from "./adapters/journal-supabase";
