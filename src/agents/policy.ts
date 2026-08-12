import type {
  ActionType,
  ApproverRole,
  ApprovalVerdict,
  LeadSignals,
  ProposedAction,
  Risk,
  SensitiveTopic,
} from "./types";
import { AVAILABILITY, CHANNELS, POLICIES, approverFor, verified } from "./config";
import { quotablePrices } from "./catalog";
import { words } from "./regex";

/**
 * The safety layer. Nothing in this file talks to the outside world — it only
 * decides what a human must see first, and it refuses drafts that promise
 * things Jammin's Depths cannot promise.
 *
 * Two independent gates, deliberately not merged:
 *  - `requiresHumanApproval()` looks at the *kind* of action (money, medical,
 *    a booking confirmation, a publication…).
 *  - `auditDraft()` looks at the *words* of an outgoing message, because a
 *    perfectly harmless action type can still carry "your spot is confirmed".
 *
 * An action passes only if both gates are happy.
 */

/* ------------------------------------------------------------------ *
 * Sensitive topics
 * ------------------------------------------------------------------ */

/**
 * FR + EN patterns. Written to over-trigger rather than under-trigger: a
 * false positive costs one human glance, a false negative can put someone
 * unfit in the water.
 */
const TOPIC_PATTERNS: Readonly<Record<SensitiveTopic, RegExp>> = {
  medical: words(
    "asthm\\w*|diab[èe]t\\w*|diabet\\w*|c(?:œ|oe)ur|cardiaque|heart\\s+(?:condition|problem|surgery)|[ée]pileps\\w*|epileps\\w*|op[ée]ration|op[ée]r[ée]e?s?|surgery|maladie|illness|hypertension|tension\\s+art[ée]rielle|blood\\s+pressure|probl[èe]me\\s+(?:d'oreille|de\\s+sinus|respiratoire|pulmonaire)|ear\\s+(?:problem|infection)|sinus\\s+problem|inhalateur|inhaler|apn[ée]e\\s+du\\s+sommeil|sleep\\s+apnea|certificat\\s+m[ée]dical|medical\\s+certificate|puis[- ]je\\s+plonger\\s+(?:avec|si)|can\\s+i\\s+dive\\s+(?:with|if)",
  ),
  pregnancy: words("enceinte|grossesse|pregnan\\w*|expecting\\s+a\\s+baby"),
  medication: words(
    "m[ée]dicament\\w*|medication|traitement\\s+(?:m[ée]dical|contre)|antibiotique\\w*|antibiotics?|b[êe]ta[- ]bloquant\\w*|beta[- ]blocker\\w*|antid[ée]presseur\\w*|antidepressant\\w*|insuline|insulin|cortisone|pills?",
  ),
  panic_anxiety: words(
    "panique|panic|crise\\s+d'angoisse|anxi[ée]t[ée]|anxious|anxiety|claustrophob\\w*|peur\\s+(?:de\\s+l'eau|du\\s+vide|de\\s+la\\s+profondeur)|afraid\\s+of\\s+(?:water|depth|the\\s+sea)|stress[ée]e?\\s+sous\\s+l'eau",
  ),
  cannot_swim: words(
    "ne\\s+sais\\s+pas\\s+nager|ne\\s+nage\\s+pas|sais\\s+[àa]\\s+peine\\s+nager|nage\\s+mal|non[- ]swimmer|can'?t\\s+swim|cannot\\s+swim|not\\s+a\\s+(?:good|strong)\\s+swimmer|weak\\s+swimmer",
  ),
  certification_problem: words(
    "brevet\\s+(?:perdu|expir[ée]e?)|carte\\s+(?:de\\s+plong[ée]e\\s+)?perdue|perdu\\s+ma\\s+(?:carte|certification)|certification\\s+(?:lost|expired)|lost\\s+my\\s+(?:card|certification)|pas\\s+plong[ée]e?\\s+depuis\\s+\\d+\\s+ans?|haven'?t\\s+dived\\s+(?:in|for)\\s+\\d+\\s+years?|remise\\s+[àa]\\s+niveau|refresher",
  ),
  incident: words(
    "accident|bless[ée]e?s?|urgence|emergency|noyade|drowning|secours|ambulance|h[ôo]pital|hospital|d[ée]compression|decompression\\s+sickness|DCS|barotrauma|disparu|missing\\s+diver|coast\\s?guard",
  ),
  complaint: words(
    "plainte|complaint|inacceptable|unacceptable|scandaleux|honteux|d[ée][çc]u\\w*|disappointed|tr[èe]s\\s+mauvaise\\s+exp[ée]rience|terrible\\s+experience|worst|arnaque|scam|avis\\s+n[ée]gatif",
  ),
  refund_request: words("rembours\\w+|refund\\w*|money\\s+back|chargeback"),
  price_negotiation: words(
    "r[ée]duction|remise|rabais|discount|moins\\s+cher|cheaper|best\\s+price|meilleur\\s+prix|n[ée]goci\\w*|negotiat\\w*|code\\s+promo|promo\\s+code|deal",
  ),
  legal: words(
    "avocat|lawyer|attorney|poursuiv\\w*|sue\\s+you|tribunal|court|police|autorit[ée]s|authorities|contrat|contract|litige|dispute|responsabilit[ée]\\s+civile|liability\\s+claim|d[ée]claration\\s+de\\s+sinistre|insurance\\s+claim",
  ),
  minor: words(
    "mon\\s+fils|ma\\s+fille|mes\\s+enfants|enfant\\s+de\\s+\\d+|\\d+\\s+ans\\s(?=[^.]{0,30}(?:peut|plonger|bapt[êe]me))|my\\s+son|my\\s+daughter|my\\s+kids?|child\\s+of\\s+\\d+|\\d+\\s+years?\\s+old|mineur|minor|under\\s+18",
  ),
};

export function detectSensitiveTopics(text: string): SensitiveTopic[] {
  return (Object.entries(TOPIC_PATTERNS) as [SensitiveTopic, RegExp][])
    .filter(([, re]) => re.test(text))
    .map(([topic]) => topic);
}

/** Topics that stop automation dead and go to a human immediately (P0). */
export const HARD_STOP_TOPICS: readonly SensitiveTopic[] = [
  "medical",
  "pregnancy",
  "medication",
  "panic_anxiety",
  "cannot_swim",
  "incident",
];

export function hasHardStop(topics: readonly SensitiveTopic[]): boolean {
  return topics.some((t) => HARD_STOP_TOPICS.includes(t));
}

/* ------------------------------------------------------------------ *
 * Action approval matrix
 * ------------------------------------------------------------------ */

type ActionClass = "money" | "medical" | "booking" | "publishing" | "legal" | "ops" | "messaging";

interface ActionRule {
  klass: ActionClass;
  risk: Risk;
  /** True when no configuration and no context can ever make this unattended. */
  alwaysApproval: boolean;
  /** Rule id recorded on the verdict. */
  reason?: string;
}

/**
 * The whole mandate in one table. Read it as: "what could this action break if
 * it were wrong?" Money, medical, published words and anything irreversible
 * always wait for a human.
 */
const ACTION_RULES: Readonly<Record<ActionType, ActionRule>> = {
  // Reversible, internal, or purely preparatory.
  create_lead: { klass: "ops", risk: "none", alwaysApproval: false },
  update_lead: { klass: "ops", risk: "none", alwaysApproval: false },
  draft_booking_recap: { klass: "ops", risk: "none", alwaysApproval: false },
  notify_staff: { klass: "ops", risk: "none", alwaysApproval: false },
  internal_report: { klass: "ops", risk: "none", alwaysApproval: false },
  schedule_followup: { klass: "ops", risk: "low", alwaysApproval: false },
  request_documents: { klass: "ops", risk: "low", alwaysApproval: false },

  // Outbound to a customer: depends on the channel's automation setting.
  send_message: { klass: "messaging", risk: "low", alwaysApproval: false },

  // Money — never, under any configuration.
  send_payment_link: { klass: "money", risk: "critical", alwaysApproval: true, reason: "rule:payment" },
  record_payment: { klass: "money", risk: "high", alwaysApproval: true, reason: "rule:payment" },
  refund: { klass: "money", risk: "critical", alwaysApproval: true, reason: "rule:refund" },

  // Seats and calendars — a wrong confirmation puts someone on a boat that is full.
  confirm_booking: { klass: "booking", risk: "critical", alwaysApproval: true, reason: "rule:booking-confirmation" },
  modify_booking: { klass: "booking", risk: "high", alwaysApproval: true, reason: "rule:booking-change" },
  cancel_booking: { klass: "booking", risk: "critical", alwaysApproval: true, reason: "rule:booking-change" },
  create_calendar_event: { klass: "booking", risk: "high", alwaysApproval: true, reason: "rule:calendar-write" },
  update_calendar_event: { klass: "booking", risk: "high", alwaysApproval: true, reason: "rule:calendar-write" },

  // Public words.
  publish_content: { klass: "publishing", risk: "high", alwaysApproval: true, reason: "rule:publication" },
  reply_review: { klass: "publishing", risk: "high", alwaysApproval: true, reason: "rule:review-reply" },

  // Safety and third parties.
  report_incident: { klass: "legal", risk: "critical", alwaysApproval: true, reason: "rule:incident" },
  supplier_message: { klass: "ops", risk: "low", alwaysApproval: true, reason: "rule:external-commitment" },
};

export function actionRisk(type: ActionType): Risk {
  return ACTION_RULES[type].risk;
}

export interface ApprovalContext {
  signals?: Pick<LeadSignals, "sensitiveTopics" | "foreignLanguage">;
  /** Set when the agent could not verify a fact the action depends on. */
  unverified?: readonly string[];
}

/**
 * The verdict for one proposed action.
 *
 * `reasons` is the audit trail: every id here explains, in machine-readable
 * form, why a human is (or is not) in the loop.
 */
export function requiresHumanApproval(action: ProposedAction, ctx: ApprovalContext = {}): ApprovalVerdict {
  const rule = ACTION_RULES[action.type];
  const reasons: string[] = [];

  if (rule.alwaysApproval) reasons.push(rule.reason ?? "rule:irreversible");

  /**
   * Which actions the *contextual* rules apply to.
   *
   * A missing cancellation policy or a mention of asthma must stop anything the
   * client would read, and anything touching money, seats, public words or the
   * law. It must NOT stop the system from writing the lead down or from paging
   * the owner — gating those would mean a safety flag makes the alert slower,
   * which is precisely backwards.
   */
  const clientFacing = action.draft !== undefined && action.draft.channel !== "internal";
  const highStakes = rule.klass === "money" || rule.klass === "booking" || rule.klass === "publishing" || rule.klass === "legal";
  const contextApplies = clientFacing || highStakes;

  // No machine here can know a seat is free (audit: seats live with the partner).
  if (!AVAILABILITY.canSystemHold && (rule.klass === "booking" || action.type === "draft_booking_recap")) {
    reasons.push("rule:unverified-availability");
  }

  // A customer-facing message on a channel we only draft for.
  if (action.draft) {
    const channel = CHANNELS[action.draft.channel];
    if (!channel.enabled) reasons.push("rule:channel-disabled");
    else if (channel.automation !== "auto_reply") reasons.push("rule:channel-draft-only");
  }

  const topics = ctx.signals?.sensitiveTopics ?? [];
  if (contextApplies) {
    if (hasHardStop(topics)) reasons.push("rule:safety-topic");
    else if (topics.length > 0) reasons.push("rule:sensitive-topic");
  }

  // We never answer in a language we have not confirmed a human speaks.
  if (clientFacing && ctx.signals?.foreignLanguage) reasons.push("rule:foreign-language");

  if (contextApplies && ctx.unverified && ctx.unverified.length > 0) reasons.push("rule:unverified-fact");

  const approver: ApproverRole =
    reasons.length === 0
      ? "none"
      : approverFor(rule.klass === "messaging" ? "ops" : rule.klass);

  return { required: reasons.length > 0, reasons: [...new Set(reasons)], approver };
}

/* ------------------------------------------------------------------ *
 * Outgoing draft guard
 * ------------------------------------------------------------------ */

export interface DraftViolation {
  rule: string;
  /** The offending fragment, so a reviewer sees it without hunting. */
  excerpt: string;
  /** Why it cannot go out, in the team's language. */
  message: string;
}

interface GuardRule {
  rule: string;
  re: RegExp;
  message: string;
}

/**
 * Claims Jammin's Depths must never make. These are not style preferences:
 * each one has burned a dive operator somewhere.
 */
const GUARD_RULES: readonly GuardRule[] = [
  {
    rule: "guard:availability",
    re: words(
      "c'est\\s+confirm[ée]e?|je\\s+vous\\s+confirme|votre\\s+place\\s+est\\s+(?:r[ée]serv[ée]e|garantie|bloqu[ée]e)|place\\s+r[ée]serv[ée]e|vous\\s+[êe]tes\\s+inscrit\\w*|your\\s+(?:spot|place|seat)\\s+is\\s+(?:confirmed|booked|reserved|guaranteed)|you'?re\\s+(?:booked|confirmed)|we'?ve\\s+booked\\s+you|confirmed\\s+for",
    ),
    message: "Aucune place ne peut être confirmée : les disponibilités sont détenues par le centre partenaire.",
  },
  {
    rule: "guard:weather",
    re: words(
      "il\\s+fera\\s+beau|la\\s+m[ée]t[ée]o\\s+sera|mer\\s+sera\\s+calme|visibilit[ée]\\s+sera|conditions\\s+seront\\s+(?:bonnes|parfaites)|weather\\s+will\\s+be|seas?\\s+will\\s+be\\s+calm|visibility\\s+will\\s+be|conditions\\s+will\\s+be\\s+(?:good|perfect)",
    ),
    message: "La météo, l'état de la mer et la visibilité ne se promettent pas.",
  },
  {
    rule: "guard:wildlife",
    re: words(
      "vous\\s+verrez|on\\s+verra\\s+(?:des|un)|garanti\\w*\\s+de\\s+voir|you\\s+will\\s+see|you'?ll\\s+definitely\\s+see|guaranteed\\s+to\\s+see|sure\\s+to\\s+see",
    ),
    message: "Aucune espèce ne peut être garantie — la faune ne se réserve pas.",
  },
  {
    rule: "guard:response-time",
    re: words(
      "r[ée]ponse\\s+(?:sous|en\\s+moins\\s+de|imm[ée]diate|garantie)|nous\\s+r[ée]pondons\\s+en\\s+moins\\s+de|d[ée]lai\\s+de\\s+r[ée]ponse|we\\s+(?:reply|respond|answer)\\s+within|response\\s+within|guaranteed\\s+response",
    ),
    message: "Aucun délai de réponse n'est publié ni promis.",
  },
  {
    rule: "guard:medical-advice",
    re: words(
      "vous\\s+pouvez\\s+plonger\\s+sans|aucun\\s+probl[èe]me\\s+pour\\s+plonger|c'est\\s+sans\\s+danger|vous\\s+[êe]tes\\s+apte\\s+[àa]\\s+plonger|pas\\s+de\\s+contre[- ]indication|you'?re\\s+fit\\s+to\\s+dive|it'?s\\s+safe\\s+(?:for\\s+you\\s+)?to\\s+dive|you\\s+can\\s+dive\\s+with\\s+(?:asthma|diabetes)",
    ),
    message: "Aucun avis médical ni jugement d'aptitude ne sort du système.",
  },
  {
    rule: "guard:padi-school-claim",
    re: words(
      "notre\\s+[ée]cole\\s+padi|nous\\s+sommes\\s+(?:un\\s+)?(?:centre|[ée]cole)\\s+padi|we\\s+are\\s+a\\s+padi\\s+(?:school|centre|center|dive\\s+cent(?:er|re))",
    ),
    message:
      "Jammin's Depths n'est pas une école PADI : les formations sont assurées avec le centre partenaire.",
  },
  {
    rule: "guard:recovery-guarantee",
    re: words(
      "nous\\s+(?:le\\s+)?retrouverons|on\\s+(?:le\\s+)?retrouvera|r[ée]cup[ée]ration\\s+garantie|we\\s+will\\s+find\\s+it|we'?ll\\s+recover\\s+it|guaranteed\\s+recovery",
    ),
    message: "Aucune récupération n'est garantie.",
  },
];

/** Accent-free, lowercase, trimmed of filler, for comparing language names. */
function normaliseLanguage(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(a|au|aux|le|la|les|du|de|des|couramment|fluent|also|aussi|in|en)\b/g, "")
    .replace(/[^a-z]/g, "")
    .trim();
}

/**
 * Language names the guard recognises, normalised → canonical.
 * Not exhaustive by design: it covers the languages a Koh Samui dive centre is
 * actually asked about, and an unrecognised word is simply not treated as a
 * language claim.
 */
const LANGUAGE_NAMES = new Map<string, string>([
  ["francais", "francais"], ["french", "francais"],
  ["anglais", "anglais"], ["english", "anglais"],
  ["thai", "thai"], ["thailandais", "thai"],
  ["allemand", "allemand"], ["german", "allemand"], ["deutsch", "allemand"],
  ["espagnol", "espagnol"], ["spanish", "espagnol"],
  ["italien", "italien"], ["italian", "italien"],
  ["russe", "russe"], ["russian", "russe"],
  ["hindi", "hindi"],
  ["chinois", "chinois"], ["chinese", "chinois"], ["mandarin", "chinois"],
  ["japonais", "japonais"], ["japanese", "japonais"],
  ["neerlandais", "neerlandais"], ["dutch", "neerlandais"],
  ["portugais", "portugais"], ["portuguese", "portugais"],
  ["arabe", "arabe"], ["arabic", "arabe"],
  ["coreen", "coreen"], ["korean", "coreen"],
  ["norvegien", "norvegien"], ["norwegian", "norvegien"], ["norsk", "norvegien"],
]);

/** Digits used as a price: `฿5,850`, `5850 THB`, `5 850 bahts`. */
function pricesIn(text: string): number[] {
  const found: number[] = [];
  const patterns = [/฿\s*([\d.,\s]{3,})/g, /([\d.,\s]{3,})\s*(?:THB|bahts?)\b/gi];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const digits = (m[1] ?? "").replace(/[^\d]/g, "");
      if (digits.length >= 3) found.push(Number(digits));
    }
  }
  return found;
}

/**
 * Read an outgoing message the way a cautious owner would. Returns every
 * violation found; the orchestrator turns a non-empty result into a blocked
 * action, never a softened one.
 */
export function auditDraft(body: string): DraftViolation[] {
  const violations: DraftViolation[] = [];

  for (const { rule, re, message } of GUARD_RULES) {
    const hit = re.exec(body);
    if (hit) violations.push({ rule, excerpt: hit[0], message });
  }

  const allowed = new Set(quotablePrices());
  for (const price of pricesIn(body)) {
    if (!allowed.has(price)) {
      violations.push({
        rule: "guard:price",
        excerpt: String(price),
        message: "Tarif absent du catalogue vérifié (src/agents/catalog.ts).",
      });
    }
  }

  /**
   * Claiming a spoken language.
   *
   * With `staffLanguages` unconfirmed, any such claim is refused. With it
   * confirmed, the claim is checked against the list — because "nous parlons
   * français" being true does not make "we speak Thai" true, and a diver who
   * books believing they will be briefed in their own language has been misled
   * about the thing that matters most underwater.
   */
  const claim = /\b(nous\s+parlons|on\s+parle|notre\s+[ée]quipe\s+parle|we\s+speak|our\s+team\s+speaks)\b([^.!?]*)/i.exec(
    body,
  );
  if (claim) {
    const confirmed = verified(POLICIES.staffLanguages);
    if (confirmed === null) {
      violations.push({
        rule: "guard:staff-languages",
        excerpt: claim[0],
        message: "Les langues parlées par l'équipe ne sont pas confirmées (POLICIES.staffLanguages).",
      });
    } else {
      // Match named languages only. Splitting the following prose on commas and
      // treating each fragment as a language name flags "donc on peut tout
      // expliquer tranquillement" — a guard that cries wolf gets switched off.
      const allowed = confirmed.map((l) => normaliseLanguage(l));
      const following = normaliseLanguage(claim[2] ?? "");
      const unclaimable = [...LANGUAGE_NAMES.entries()]
        .filter(([name]) => following.includes(name))
        .map(([, canonical]) => canonical)
        .filter((canonical) => !allowed.some((a) => canonical.includes(a) || a.includes(canonical)));

      if (unclaimable.length > 0) {
        violations.push({
          rule: "guard:staff-languages",
          excerpt: claim[0] + (claim[2] ?? ""),
          message: `Langue revendiquée hors de la liste confirmée (${confirmed.join(", ")}) : ${unclaimable.join(", ")}.`,
        });
      }
    }
  }

  return violations;
}

/** Convenience for tests and callers that only need a yes/no. */
export function isDraftSafe(body: string): boolean {
  return auditDraft(body).length === 0;
}
