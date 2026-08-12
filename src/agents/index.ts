/**
 * Public surface of the Jammin's Depths agent system.
 *
 * Server-side only: nothing here belongs in a React component. The site keeps
 * working with none of this imported — the agents run beside it, not inside it.
 *
 * Start here:
 *   const bus = createOrchestrator();
 *   const run = await bus.handle(event);
 *   bus.queue.pending();   // what a human must look at
 *   bus.log.format();      // why it decided that
 */

export type {
  Activity,
  Agent,
  AgentName,
  AgentOutcome,
  ApproverRole,
  ApprovalVerdict,
  AuditEntry,
  Channel,
  Contact,
  Escalation,
  EventKind,
  InboundEvent,
  LeadSignals,
  MessageDraft,
  Priority,
  ProposedAction,
  Risk,
  SensitiveTopic,
} from "./types";

export { createOrchestrator, classify, readSignals, release, fingerprint } from "./orchestrator";
export type {
  Orchestrator,
  OrchestratorDeps,
  RunResult,
  BlockedAction,
  ReleaseDeps,
  ReleaseResult,
} from "./orchestrator";

export { executeAction, stageFor } from "./execute";
export type { ExecuteContext, ExecuteResult } from "./execute";

export { createRuntime, describeRuntime } from "./runtime";
export type { Runtime } from "./runtime";

export { runJob, isJob, jobs, dueFollowUps, tomorrowInBangkok, weekStartInBangkok } from "./schedule";
export type { Job, JobDeps, JobResult } from "./schedule";

export {
  OPS,
  CHANNELS,
  APPROVERS,
  AVAILABILITY,
  POLICIES,
  FOLLOW_UP,
  SLA_MINUTES,
  TODO,
  isTodo,
  verified,
  requireVerified,
  openGaps,
  approverFor,
  CLOSED_DATES,
  isClosed,
  staffSpeaks,
  languageName,
} from "./config";
export type { Verified, ChannelConfig, Approver } from "./config";

export { OFFERS, findOffer, offersFor, quotablePrices, formatTHB, PRICE_CAVEAT } from "./catalog";
export type { Offer } from "./catalog";

export {
  auditDraft,
  isDraftSafe,
  detectSensitiveTopics,
  requiresHumanApproval,
  actionRisk,
  hasHardStop,
  HARD_STOP_TOPICS,
} from "./policy";
export type { DraftViolation, ApprovalContext } from "./policy";

export { knowledgeBase, findAnswer, normalise } from "./knowledge";
export type { KnowledgeEntry, KnowledgeMatch } from "./knowledge";

export { detectLanguage } from "./language";
export type { LanguageVerdict } from "./language";

export { extract, extractDates, extractPartySize, extractCertification, extractActivity, detectPolicyQuestions } from "./extract";
export type { Extraction } from "./extract";

export { TEMPLATES, render, compose, slotsOf } from "./templates";
export type { Template, RenderResult } from "./templates";

export { createApprovalQueue, formatPending } from "./queue";
export type { ApprovalQueue, QueuedItem, QueueStatus, EnqueueInput } from "./queue";

export { createAuditLog, systemClock, note } from "./audit";
export type { AuditLog, AuditStep, Clock } from "./audit";

export { createNoopLlm, createStubLlm, withCallBudget, polish, LLM_BUDGET } from "./llm";
export type { LlmClient, LlmRequest } from "./llm";

export {
  createMockPorts,
  createMockCrm,
  createMockCalendar,
  createMockMessaging,
  createMockSeenStore,
  createRoutedMessaging,
  createPartnerMessageAvailability,
  contactKey,
  mergeLead,
  missingPorts,
} from "./adapters";
export type { SeenStore, SendResult } from "./adapters";

export {
  createSupabaseCrm,
  createSupabaseQueue,
  createSupabaseSeenStore,
  createSupabaseAuditSink,
  supabaseFromEnv,
} from "./adapters/supabase";
export type { SupabaseConfig } from "./adapters/supabase";

export {
  createWhatsAppMessaging,
  whatsappFromEnv,
  verifySignature,
  verificationChallenge,
  eventsFromWebhook,
} from "./adapters/whatsapp";
export type { WhatsAppConfig } from "./adapters/whatsapp";

export {
  createTelegramMessaging,
  telegramFromEnv,
  sendApprovalCard,
  formatCard,
  callbackData,
  parseCallbackData,
  readCallback,
  isAllowed,
  verifyWebhookSecret,
} from "./adapters/telegram";
export type { TelegramConfig } from "./adapters/telegram";
export type {
  AvailabilityAnswer,
  AvailabilityPort,
  CalendarPort,
  CrmPort,
  Lead,
  LeadStage,
  MessagingPort,
  Port,
  PortStatus,
  Ports,
} from "./adapters";

export { receptionAgent } from "./roles/reception";
export { bookingAgent, nextDayBrief } from "./roles/booking";
export type { DailyBriefInput } from "./roles/booking";
export { safetyAgent, preArrivalMessage, documentsReminder } from "./roles/safety";
export type { PreArrivalInput } from "./roles/safety";
export { contentAgent, CONTENT_PILLARS } from "./roles/content";
export type { ContentPillar } from "./roles/content";
export { reputationAgent } from "./roles/reputation";
export { opsAgent, weeklyReport, partnerPolicyQuestions } from "./roles/ops";
export type { WeeklyReportInput } from "./roles/ops";
