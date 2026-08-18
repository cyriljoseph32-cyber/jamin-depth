import { createOrchestrator, type Orchestrator } from "./orchestrator";
import { createApprovalQueue, type ApprovalQueue, type QueuedItem } from "./queue";
import { createAuditLog, systemClock, type AuditEntry, type AuditLog } from "./audit";
import {
  createMockCalendar,
  createMockCrm,
  createMockMessaging,
  createMockSeenStore,
  createPartnerMessageAvailability,
  createRoutedMessaging,
  type Ports,
} from "./adapters";
import {
  createSupabaseAuditSink,
  createSupabaseCrm,
  createSupabaseQueue,
  createSupabaseSeenStore,
  supabaseFromEnv,
  type SupabaseConfig,
} from "./adapters/supabase";
import { createWhatsAppMessaging, whatsappFromEnv, type WhatsAppConfig } from "./adapters/whatsapp";
import {
  chatFor,
  createTelegramMessaging,
  sendApprovalCard,
  telegramFromEnv,
  type TelegramConfig,
} from "./adapters/telegram";

/**
 * Wiring — the one place environment variables are read.
 *
 * Everything degrades independently. No Supabase means the run works but is not
 * remembered; no WhatsApp credentials means drafts are recorded but not sent; no
 * Telegram means the queue fills up with nobody notified. Each gap is visible in
 * `describeRuntime()` and in the weekly report, and none of them crashes a
 * deployment — the site must never fail to build because a key is absent.
 *
 * Server-side only: the service-role key and the Meta token must never reach a
 * browser bundle.
 */

export interface Runtime {
  bus: Orchestrator;
  ports: Ports;
  queue: ApprovalQueue;
  log: AuditLog;
  persistAudit?: (entries: readonly AuditEntry[]) => Promise<void>;
  supabase: SupabaseConfig | null;
  whatsapp: WhatsAppConfig | null;
  telegram: TelegramConfig | null;
}

/**
 * Hooks the layer above can add without this file having to know about it.
 *
 * COCO COMMAND (`src/command/`) uses `onQueued` to mirror every queued action
 * into its journal. The dependency stays one-way — `command` imports `agents`,
 * never the reverse — which is what keeps the dive system able to run alone.
 */
export interface RuntimeHooks {
  onQueued?: (item: QueuedItem) => Promise<void>;
}

export function createRuntime(hooks: RuntimeHooks = {}): Runtime {
  const clock = systemClock;
  const supabase = supabaseFromEnv();
  const whatsapp = whatsappFromEnv();
  const telegram = telegramFromEnv();

  const log = createAuditLog(clock);
  const persistAudit = supabase ? createSupabaseAuditSink(supabase) : undefined;
  const queue = supabase ? createSupabaseQueue(supabase, clock) : createApprovalQueue(clock);

  const fallbackMessaging = createMockMessaging();
  const ports: Ports = {
    crm: supabase ? createSupabaseCrm(supabase, clock) : createMockCrm(clock),
    seen: supabase ? createSupabaseSeenStore(supabase) : createMockSeenStore(),
    availability: createPartnerMessageAvailability(),
    calendar: createMockCalendar(clock),
    messaging: createRoutedMessaging(
      {
        whatsapp: whatsapp ? createWhatsAppMessaging(whatsapp) : undefined,
        internal: telegram ? createTelegramMessaging(telegram) : undefined,
      },
      fallbackMessaging,
    ),
  };

  const bus = createOrchestrator({
    ports,
    queue,
    log,
    clock,
    persistAudit,
    // Every queued action becomes a card with two buttons. If Telegram is not
    // configured the item still sits in the queue — silent, but not lost.
    onQueued:
      telegram || hooks.onQueued
        ? async (item) => {
            if (telegram) {
              const result = await sendApprovalCard(telegram, item, chatFor(telegram, "alerts"));
              if (!result.ok) console.error("telegram card failed:", result.detail);
            }
            // A failed card must not stop the journal entry: the queue item is
            // the thing that matters, and the digest can still surface it.
            if (hooks.onQueued) await hooks.onQueued(item);
          }
        : undefined,
  });

  return { bus, ports, queue, log, persistAudit, supabase, whatsapp, telegram };
}

/** Human-readable wiring state — used by the health route and the weekly report. */
export function describeRuntime(runtime: Runtime): Record<string, string> {
  return {
    persistence: runtime.supabase ? "supabase" : "mémoire (non persistant)",
    whatsapp: runtime.whatsapp ? "cloud api" : "non configuré",
    telegram: runtime.telegram ? "configuré" : "non configuré",
    crm: runtime.ports.crm.name,
    queue: runtime.supabase ? "queue:supabase" : "queue:memory",
    messaging: runtime.ports.messaging.name,
    seen: runtime.ports.seen.name,
  };
}
