import { createRuntime, type Runtime } from "@/agents/runtime";
import { supabaseFromEnv } from "@/agents/adapters/supabase";
import { systemClock } from "@/agents/audit";
import type { QueuedItem } from "@/agents/queue";
import { createJournal, type Journal } from "./journal";
import { createStateStore, type StateStore } from "./state";
import { createTaskStore, type TaskStore } from "./tasks";
import { createContentStore, type ContentStore } from "./content";
import { createKpiStore, type KpiStore } from "./kpi";
import { createSupabaseJournal, createSupabaseStateStore } from "./adapters/journal-supabase";
import { createSupabaseKpiStore, createSupabaseTaskStore } from "./adapters/tasks-supabase";
import { createSupabaseContentStore } from "./adapters/content-supabase";
import { createNotifier, type Notifier } from "./notify";
import type { CommandDeps } from "./commands";
import type { CommandEventInput } from "./types";

/**
 * Le câblage de COCO COMMAND.
 *
 * Même contrat que `agents/runtime.ts` : tout se dégrade séparément et rien ne
 * fait échouer un déploiement. Sans Supabase, le journal vit en mémoire — il
 * disparaît au redéploiement, ce qui est visible dans `/status` plutôt que
 * silencieux. Sans Telegram, les événements s'écrivent quand même : ils sont
 * simplement lus plus tard.
 */

export interface CommandRuntime {
  agents: Runtime;
  journal: Journal;
  state: StateStore;
  tasks: TaskStore;
  kpis: KpiStore;
  content: ContentStore;
  notifier: Notifier;
  /** Vrai quand le journal survit à un redéploiement. */
  persistent: boolean;
}

/**
 * Repli mémoire, partagé par tout le processus.
 *
 * Une route serverless construit son runtime à chaque requête : sans ce
 * partage, un événement écrit par l'API d'ingestion serait invisible pour la
 * commande `/tasks` reçue trois secondes plus tard, et le mode sans Supabase ne
 * servirait qu'aux tests. Il ne survit toujours pas à un redéploiement — c'est
 * ce que dit `persistent: false`.
 */
let memoryJournal: Journal | undefined;
let memoryState: StateStore | undefined;
let memoryTasks: TaskStore | undefined;
let memoryKpis: KpiStore | undefined;
let memoryContent: ContentStore | undefined;

export function createCommandRuntime(): CommandRuntime {
  const supabase = supabaseFromEnv();
  const clock = systemClock;
  if (!supabase) {
    memoryJournal ??= createJournal(clock);
    memoryState ??= createStateStore();
    memoryTasks ??= createTaskStore(clock);
    memoryKpis ??= createKpiStore(clock);
    memoryContent ??= createContentStore(clock);
  }
  const journal = supabase ? createSupabaseJournal(supabase, clock) : (memoryJournal as Journal);
  const state = supabase ? createSupabaseStateStore(supabase) : (memoryState as StateStore);
  const tasks = supabase ? createSupabaseTaskStore(supabase, clock) : (memoryTasks as TaskStore);
  const kpis = supabase ? createSupabaseKpiStore(supabase, clock) : (memoryKpis as KpiStore);
  const content = supabase
    ? createSupabaseContentStore(supabase, clock)
    : (memoryContent as ContentStore);

  // Toute action mise en file par le système plongée devient un événement du
  // journal : c'est ce qui rend `/tasks` et `/approve <event_id>` capables de
  // parler des cartes Telegram déjà existantes.
  const agents = createRuntime({
    onQueued: async (item: QueuedItem) => {
      try {
        const now = clock();
        const event = await journal.append(queuedItemEvent(item), now);
        // La carte vient d'être envoyée par `agents/runtime.ts` : la marquer
        // notifiée évite de la répéter dans le récapitulatif de 30 minutes.
        await journal.markNotified([event.event_id], now);
      } catch (err) {
        console.error("coco-command: journalisation de la file échouée:", err);
      }
    },
  });

  const notifier = createNotifier({ telegram: agents.telegram, journal, tasks });

  return { agents, journal, state, tasks, kpis, content, notifier, persistent: supabase !== null };
}

/** Un item de la file de validation, vu comme un événement du journal. */
export function queuedItemEvent(item: QueuedItem): CommandEventInput {
  const draft = item.action.draft;
  return {
    venture: "DIVING",
    agent: item.agent,
    type: "APPROVAL",
    priority: item.priority,
    status: "WAITING_APPROVAL",
    summary: item.summary,
    details: [
      `Pourquoi : ${item.reasons.join(", ")}`,
      draft ? `Détail : ${draft.locale.toUpperCase()} → ${draft.to.name ?? draft.to.phone ?? draft.channel}` : "",
      draft?.body ?? "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
    links: [item.id],
    next_action: "validation de Cyril sur la carte Telegram",
    needs_owner: true,
    queue_item_id: item.id,
    action_type: item.action.type,
  };
}

/**
 * Aligner le journal sur une décision prise au bouton.
 *
 * Sans ça, une carte approuvée d'un pouce resterait « en attente de
 * validation » dans `/tasks` — et un journal qui ment sur ce qui est en cours
 * est pire qu'un journal absent.
 */
export async function settleJournalForQueueItem(
  journal: Journal,
  queueItemId: string,
  status: "DONE" | "BLOCKED",
  detail: string,
): Promise<void> {
  try {
    const events = await journal.list({ status: "WAITING_APPROVAL", limit: 200 });
    const event = events.find((e) => e.queue_item_id === queueItemId);
    if (event) await journal.setStatus(event.event_id, status, detail);
  } catch (err) {
    console.error("coco-command: mise à jour du journal échouée:", err);
  }
}

/** Ce qu'il faut pour exécuter une commande Telegram, assemblé au même endroit. */
export function commandDeps(rt: CommandRuntime, by: string, now: string): CommandDeps {
  return {
    journal: rt.journal,
    queue: rt.agents.queue,
    state: rt.state,
    tasks: rt.tasks,
    kpis: rt.kpis,
    content: rt.content,
    release: {
      queue: rt.agents.queue,
      ports: rt.agents.ports,
      log: rt.agents.log,
      persistAudit: rt.agents.persistAudit,
    },
    leads: () => rt.agents.ports.crm.all(),
    by,
    now,
  };
}
