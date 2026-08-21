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
  TaskCategory,
  Venture,
} from "./types";
export {
  bangkokClock,
  bangkokDate,
  bangkokTime,
  eventStatuses,
  eventTypes,
  fingerprintOf,
  isTaskCategory,
  isVenture,
  newEventId,
  newTaskId,
  taskCategories,
  ventures,
} from "./types";

export { levelFor, levelForActionType, levelForIngested, needsOwnerApproval, LEVEL_LABEL } from "./levels";
export { agentTag, tagsFor } from "./tags";

export { buildEvent, byRecency, createJournal, impactOf, isUnverifiedClaim, matches, DEDUPE_WINDOW_MS, UNVERIFIED } from "./journal";
export type { Journal, JournalFilter } from "./journal";

export {
  buildTask,
  byUrgency,
  createTaskStore,
  isOpenTask,
  matchesTask,
  needsAttention,
  openTask,
  settleTask,
  validateTask,
  VagueTaskError,
  DEADLINE_SOON_MS,
  MIN_OBJECTIVE_CHARS,
  OPEN_STATUSES,
} from "./tasks";
export type { CommandTask, OpenedTask, TaskDeps, TaskDraft, TaskFilter, TaskStore } from "./tasks";

export {
  createKpiStore,
  displayFor,
  isKpiMetric,
  kpiMetrics,
  parseKpi,
  totalFor,
  METRIC_LABEL,
  NOT_PROVIDED,
} from "./kpi";
export type { KpiDraft, KpiEntry, KpiFilter, KpiMetric, KpiStore } from "./kpi";

export { agentFor, guessCategory, isSpecRole, resolveSpecRole, routingTable, SPEC_ROLES, UNASSIGNED } from "./routing";

export { createStateStore, emptyState, isPaused, pause, resume } from "./state";
export type { CommandState, StateStore } from "./state";

export {
  facets,
  formatAction,
  formatAlert,
  formatApproval,
  formatCompleted,
  formatDecision,
  formatDigest,
  formatEvent,
  formatEveningReport,
  formatMorningBrief,
  formatWeeklyReport,
  plainDetails,
  referenceOf,
} from "./format";
export type { Decision, EveningReport, MorningBrief, WeeklyReport } from "./format";

export { chatForEvent, createNotifier, formatDeadlines, isImmediate, isStuck, STUCK_AFTER_MS } from "./notify";
export type { Notifier, NotifierDeps } from "./notify";

export { buildEveningReport, buildMorningBrief, buildWeeklyReport } from "./brief";
export type { BriefDeps } from "./brief";

export { commandNames, isCommandName, parseCommand, runCommand } from "./commands";
export type { CommandDeps, CommandName, ParsedCommand } from "./commands";

export { commandDeps, createCommandRuntime, queuedItemEvent, settleJournalForQueueItem } from "./runtime";
export type { CommandRuntime } from "./runtime";

export { commandJobs, isCommandJob, runCommandJob } from "./jobs";
export type { CommandJob, CommandJobResult } from "./jobs";

export { priorities, readIngestEvent } from "./ingest";
export type { IngestResult } from "./ingest";

export {
  buildContent,
  bySchedule,
  createContentStore,
  draftContent,
  EmptyContentError,
  isOpenContent,
  matchesContent,
  silentVentures,
  validateContent,
  CALENDAR_HORIZON_MS,
  OPEN_CONTENT_STATUSES,
  SILENCE_AFTER_MS,
} from "./content";
export type {
  ContentDeps,
  ContentDraft,
  ContentFilter,
  ContentItem,
  ContentStore,
  DraftedContent,
  SilenceReport,
} from "./content";

export { createSupabaseJournal, createSupabaseStateStore } from "./adapters/journal-supabase";
export { createSupabaseContentStore } from "./adapters/content-supabase";
export { createSupabaseKpiStore, createSupabaseTaskStore } from "./adapters/tasks-supabase";
