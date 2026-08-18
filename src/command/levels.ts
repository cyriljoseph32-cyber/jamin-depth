import type { ActionType, ApprovalVerdict, ProposedAction } from "@/agents/types";
import { actionRisk } from "@/agents/policy";
import type { ActionLevel } from "./types";

/**
 * Le niveau d'une action.
 *
 * Ce fichier NE crée PAS un second garde-fou. `src/agents/policy.ts` décide
 * seul de ce qui peut sortir ; ici on ne fait que *nommer* le geste (0→4) pour
 * le router vers le bon canal Telegram et le bon vocabulaire.
 *
 * Le seul pouvoir que ce module ajoute est un durcissement : à partir du niveau
 * 3, la validation est exigée même quand la policy aurait laissé passer. On peut
 * rendre le système plus prudent, jamais plus permissif.
 */

/**
 * Niveau par type d'action. Lecture : « qu'est-ce que ça casse si c'est faux ? »
 *
 * Un brouillon se jette, une écriture interne se corrige, un message parti ne
 * se rattrape pas, un paiement encore moins.
 */
const LEVEL_BY_ACTION: Readonly<Record<ActionType, ActionLevel>> = {
  // 1 — préparer
  draft_booking_recap: 1,

  // 2 — réversible, interne
  create_lead: 2,
  update_lead: 2,
  schedule_followup: 2,
  notify_staff: 2,
  internal_report: 2,

  // 3 — sort de la maison
  send_message: 3,
  request_documents: 3,
  publish_content: 3,
  reply_review: 3,
  modify_booking: 3,
  supplier_message: 3,
  create_calendar_event: 3,
  update_calendar_event: 3,

  // 4 — argent, sièges, incidents : irréversible
  send_payment_link: 4,
  record_payment: 4,
  refund: 4,
  confirm_booking: 4,
  cancel_booking: 4,
  report_incident: 4,
};

export function levelForActionType(type: ActionType): ActionLevel {
  return LEVEL_BY_ACTION[type];
}

/**
 * Niveau d'une action proposée.
 *
 * Deux relèvements par rapport à la table : un brouillon adressé à un client
 * sort de la maison quel que soit le type qui le porte, et un risque
 * `critical` est critique même si la table est plus douce — la table peut
 * vieillir, `actionRisk()` vient de la policy.
 */
export function levelFor(action: Pick<ProposedAction, "type" | "draft">): ActionLevel {
  let level = LEVEL_BY_ACTION[action.type];
  if (action.draft && action.draft.channel !== "internal") level = max(level, 3);
  if (actionRisk(action.type) === "critical") level = max(level, 4);
  return level;
}

function max(a: ActionLevel, b: ActionLevel): ActionLevel {
  return (a > b ? a : b) as ActionLevel;
}

/**
 * Faut-il un `/approve` ?
 *
 * L'union des deux avis : celui de la policy (mot à mot, canal, sujet
 * sensible…) et celui du niveau. Ni l'un ni l'autre ne peut annuler l'autre.
 */
export function needsOwnerApproval(level: ActionLevel, verdict?: ApprovalVerdict): boolean {
  return level >= 3 || verdict?.required === true;
}

/** Étiquette lisible, pour les cartes et le journal. */
export const LEVEL_LABEL: Readonly<Record<ActionLevel, string>> = {
  0: "N0 · observer",
  1: "N1 · préparer",
  2: "N2 · réversible",
  3: "N3 · externe/sensible",
  4: "N4 · critique",
};

/**
 * Niveau d'un événement poussé par un autre dépôt, qui ne connaît pas nos types
 * d'action. Un projet qui déclare `needs_owner` demande une décision : c'est du
 * niveau 3 au minimum, quoi qu'il ait écrit dans son champ `level`.
 */
export function levelForIngested(input: { level?: number; needs_owner: boolean }): ActionLevel {
  const declared = clamp(input.level);
  if (input.needs_owner) return declared >= 4 ? 4 : 3;
  return declared;
}

function clamp(value: number | undefined): ActionLevel {
  if (typeof value !== "number" || !Number.isInteger(value)) return 0;
  if (value < 0) return 0;
  if (value > 4) return 4;
  return value as ActionLevel;
}
