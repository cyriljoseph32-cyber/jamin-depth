import type { Activity } from "./types";
import { words } from "./regex";

/**
 * Deterministic extraction from a free-text enquiry: dates, party size, level,
 * activity, and which unconfirmed policy the visitor is asking about.
 *
 * Rules, not a model. Three reasons: it costs nothing per message, it is
 * testable, and — most importantly — a rule that fails to parse "sometime in
 * March" leaves the field empty, whereas a model happily invents 15 March. A
 * guessed date reaches a real boat with real people on it, so anything not
 * unambiguous lands in `vagueDates` for a human to read.
 */

export interface Extraction {
  /** Resolved ISO dates (YYYY-MM-DD), in order of appearance, de-duplicated. */
  dates: string[];
  /** Date-ish phrases deliberately NOT resolved. */
  vagueDates: string[];
  partySize?: number;
  certified?: boolean;
  certificationHint?: string;
  activity?: Activity;
  /** Keys of `POLICIES` the visitor asked about, e.g. `cancellation`. */
  policyQuestions: string[];
}

const FR_MONTHS = [
  "janvier", "février", "fevrier", "mars", "avril", "mai", "juin", "juillet",
  "août", "aout", "septembre", "octobre", "novembre", "décembre", "decembre",
];
const EN_MONTHS = [
  "january", "february", "march", "april", "may", "june", "july",
  "august", "september", "october", "november", "december",
];

/** Month name (any spelling above) → 1-based month number. */
const MONTH_INDEX: Record<string, number> = (() => {
  const map: Record<string, number> = {};
  const fr: [string, number][] = [
    ["janvier", 1], ["février", 2], ["fevrier", 2], ["mars", 3], ["avril", 4], ["mai", 5],
    ["juin", 6], ["juillet", 7], ["août", 8], ["aout", 8], ["septembre", 9],
    ["octobre", 10], ["novembre", 11], ["décembre", 12], ["decembre", 12],
  ];
  for (const [name, n] of fr) map[name] = n;
  EN_MONTHS.forEach((name, i) => {
    map[name] = i + 1;
  });
  // Common short forms, English only — "mar" is unambiguous, "jui" is not.
  const short: [string, number][] = [
    ["jan", 1], ["feb", 2], ["mar", 3], ["apr", 4], ["jun", 6],
    ["jul", 7], ["aug", 8], ["sep", 9], ["sept", 9], ["oct", 10], ["nov", 11], ["dec", 12],
  ];
  for (const [name, n] of short) map[name] = n;
  return map;
})();

const WEEKDAYS: Record<string, number> = {
  dimanche: 0, lundi: 1, mardi: 2, mercredi: 3, jeudi: 4, vendredi: 5, samedi: 6,
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

/**
 * Phrases that look like a date but are not one. Matched before anything else
 * and removed from the working text, so "la semaine prochaine" can never be
 * turned into a Monday.
 */
const VAGUE_PATTERNS: readonly RegExp[] = [
  /\b(la\s+)?semaine\s+prochaine\b/gi,
  /\bnext\s+week\b/gi,
  /\ble\s+mois\s+prochain\b/gi,
  /\bnext\s+month\b/gi,
  /\bdans\s+(quelques|\d+)\s+(jours|semaines)\b/gi,
  /\bin\s+(a\s+few|\d+)\s+(days|weeks)\b/gi,
  /\bbient[oô]t\b/gi,
  /\bprochainement\b/gi,
  /\bsoon\b/gi,
  /\bsometime\b/gi,
  /\bfin\s+(du\s+)?mois\b/gi,
  /\bend\s+of\s+(the\s+)?month\b/gi,
  /\bpendant\s+(les\s+|nos\s+)?vacances\b/gi,
  /\bduring\s+(our\s+|the\s+)?holidays?\b/gi,
  // A bare month with no day: "en mars", "in March".
  new RegExp(`\\b(en|in)\\s+(${[...FR_MONTHS, ...EN_MONTHS].join("|")})\\b`, "gi"),
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** UTC-based so the result never shifts with the runner's timezone. */
function isoFrom(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 86_400_000);
}

/** Reference date as a UTC midnight Date. Accepts ISO date or datetime. */
function referenceDate(reference: string): Date {
  const parsed = new Date(reference);
  if (Number.isNaN(parsed.getTime())) return new Date(Date.UTC(1970, 0, 1));
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

/**
 * Resolve a day/month with no year: this year if still ahead of the reference,
 * otherwise next year. Divers book the season in front of them, not behind.
 */
function withInferredYear(ref: Date, month: number, day: number): string | null {
  for (const year of [ref.getUTCFullYear(), ref.getUTCFullYear() + 1]) {
    if (!isRealDate(year, month, day)) continue;
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (candidate.getTime() >= ref.getTime()) return isoFrom(candidate);
  }
  return null;
}

/**
 * Extract dates. `reference` is injected (never `new Date()` inside) so tests
 * are deterministic and a replayed event resolves the same way it did live.
 */
export function extractDates(text: string, reference: string): { dates: string[]; vagueDates: string[] } {
  const ref = referenceDate(reference);
  const vagueDates: string[] = [];
  let work = text;

  for (const re of VAGUE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      const phrase = m[0].trim();
      if (!vagueDates.some((v) => v.toLowerCase() === phrase.toLowerCase())) vagueDates.push(phrase);
    }
    work = work.replace(re, " ");
  }

  const dates: string[] = [];
  const push = (iso: string | null) => {
    if (iso && !dates.includes(iso)) dates.push(iso);
  };

  // today / tomorrow / the day after
  if (/\b(aujourd'?hui|today)\b/i.test(work)) push(isoFrom(ref));
  if (/\b(apr[eè]s[-\s]demain|day\s+after\s+tomorrow)\b/i.test(work)) push(isoFrom(addDays(ref, 2)));
  if (/\b(demain|tomorrow)\b/i.test(work) && !/\bapr[eè]s[-\s]demain\b/i.test(work)) {
    push(isoFrom(addDays(ref, 1)));
  }

  // 12/03, 12/03/2026, 12-03, 12.03  (day first — the audience is francophone)
  for (const m of work.matchAll(/\b(\d{1,2})[/.\-](\d{1,2})(?:[/.\-](\d{2,4}))?\b/g)) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const rawYear = m[3];
    if (rawYear === undefined) {
      push(withInferredYear(ref, month, day));
      continue;
    }
    const year = rawYear.length === 2 ? 2000 + Number(rawYear) : Number(rawYear);
    if (isRealDate(year, month, day)) push(isoFrom(new Date(Date.UTC(year, month - 1, day))));
  }

  // "12 mars", "le 12 mars 2026", "March 12", "12 March"
  const monthNames = Object.keys(MONTH_INDEX).join("|");
  const dayFirst = new RegExp(`\\b(\\d{1,2})(?:er)?\\s+(${monthNames})\\b(?:\\s+(\\d{4}))?`, "gi");
  const monthFirst = new RegExp(`\\b(${monthNames})\\s+(\\d{1,2})\\b(?:,?\\s+(\\d{4}))?`, "gi");

  for (const m of work.matchAll(dayFirst)) {
    const day = Number(m[1]);
    const month = MONTH_INDEX[(m[2] ?? "").toLowerCase()];
    const year = m[3] ? Number(m[3]) : undefined;
    if (month === undefined) continue;
    if (year === undefined) push(withInferredYear(ref, month, day));
    else if (isRealDate(year, month, day)) push(isoFrom(new Date(Date.UTC(year, month - 1, day))));
  }
  for (const m of work.matchAll(monthFirst)) {
    const month = MONTH_INDEX[(m[1] ?? "").toLowerCase()];
    const day = Number(m[2]);
    const year = m[3] ? Number(m[3]) : undefined;
    if (month === undefined) continue;
    if (year === undefined) push(withInferredYear(ref, month, day));
    else if (isRealDate(year, month, day)) push(isoFrom(new Date(Date.UTC(year, month - 1, day))));
  }

  // "lundi", "next Tuesday" → the next occurrence strictly after the reference.
  const weekdayNames = Object.keys(WEEKDAYS).join("|");
  for (const m of work.matchAll(new RegExp(`\\b(${weekdayNames})\\b`, "gi"))) {
    const target = WEEKDAYS[(m[1] ?? "").toLowerCase()];
    if (target === undefined) continue;
    const delta = ((target - ref.getUTCDay() + 7) % 7) || 7;
    push(isoFrom(addDays(ref, delta)));
  }

  return { dates: dates.sort(), vagueDates };
}

const NUMBER_WORDS: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7, eight: 8, nine: 9, ten: 10,
};

/** `six` is shared FR/EN and `4` is `4` — one table covers both. */
function toNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase();
  if (/^\d+$/.test(cleaned)) return Number(cleaned);
  return NUMBER_WORDS[cleaned];
}

const PARTY_PATTERNS: readonly RegExp[] = [
  /\b(\d{1,2}|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|one|two|three|four|five|seven|eight|nine|ten)\s+(personnes?|pers\b|adultes?|plongeurs?|people|persons|adults?|divers|guests?)/i,
  /\b(?:nous\s+sommes|on\s+est|on\s+serait)\s+(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)\b/i,
  /\b(?:we\s+are|we'?re|there\s+(?:are|will\s+be))\s+(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  /\b(?:pour|for)\s+(\d{1,2}|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|two|three|four|five|six|seven|eight|nine|ten)\s+(?:d'entre\s+nous|of\s+us)\b/i,
];

export function extractPartySize(text: string): number | undefined {
  for (const re of PARTY_PATTERNS) {
    const n = toNumber(re.exec(text)?.[1]);
    if (n !== undefined && n >= 1 && n <= 30) return n;
  }
  if (/\b(en\s+couple|a\s+couple|my\s+(wife|husband|partner)|ma\s+(femme|copine)|mon\s+(mari|copain))\b/i.test(text)) {
    return 2;
  }
  if (/\b(je\s+suis\s+seul|tout\s+seul|solo|by\s+myself|just\s+me)\b/i.test(text)) return 1;
  return undefined;
}

/**
 * Wanting to TAKE a course. This matters twice over: it decides the activity,
 * and it stops a course name from being read as a credential — "on veut passer
 * l'Open Water" names a goal, "we are Open Water certified" names a licence.
 */
const COURSE_INTENT = words(
  "formation|cours|course|stage|get\\s+certified|become\\s+certified|passer\\s+(?:mon|ma|le|l')|obtenir\\s+(?:mon|le)|specialit\\w*|specialty|apprendre\\s+[àa]\\s+plonger|learn\\s+to\\s+dive",
);

/**
 * Phrases that state a certification, and the one we echo back to the team.
 * `nameOnly` patterns are just the name of a qualification — evidence of a
 * licence ONLY when the message is not about signing up for that course.
 */
const CERTIFIED_PATTERNS: readonly { re: RegExp; hint: string; nameOnly?: boolean }[] = [
  { re: words("open\\s*water"), hint: "Open Water", nameOnly: true },
  { re: words("advanced"), hint: "Advanced Open Water", nameOnly: true },
  { re: words("rescue|divemaster|dive\\s*master|instructeur|instructor"), hint: "Rescue/pro level", nameOnly: true },
  { re: words("nitrox"), hint: "Nitrox", nameOnly: true },
  { re: words("niveau\\s*([1-4]|i{1,3}v?)"), hint: "Niveau (CMAS/FFESSM)" },
  { re: words("ssi|cmas|ffessm"), hint: "SSI/CMAS/FFESSM" },
  { re: words("certifi[ée]e?s?|brevet[ée]?s?|licenci[ée]s?|certified|qualified"), hint: "Certified (unspecified)" },
  { re: words("(\\d{1,4})\\s*(plong[ée]es?|dives)"), hint: "Logged dives mentioned" },
];

const BEGINNER_PATTERNS: readonly RegExp[] = [
  words("jamais\\s+plong[ée]e?|jamais\\s+fait\\s+de\\s+plong[ée]e"),
  words("never\\s+(dived|dove|been\\s+diving)"),
  words("d[ée]butant\\w*|beginner|first\\s*[-\\s]?time|premi[èe]re\\s+(fois|plong[ée]e)"),
  words("bapt[êe]me|discover\\s+scuba|try\\s+diving"),
  words("pas\\s+de\\s+brevet|no\\s+certification|not\\s+certified|uncertified"),
];

export function extractCertification(text: string): { certified?: boolean; certificationHint?: string } {
  const beginner = BEGINNER_PATTERNS.some((re) => re.test(text));
  const wantsCourse = COURSE_INTENT.test(text);
  const cert = CERTIFIED_PATTERNS.find(({ re, nameOnly }) => (nameOnly && wantsCourse ? false : re.test(text)));

  // "I've never dived but my wife is Open Water" — mixed signals are exactly
  // the case a human must read, so we assert neither.
  if (beginner && cert) return { certificationHint: "Mixed signals — confirm each diver's level" };
  if (beginner) return { certified: false, certificationHint: "Stated beginner / no certification" };
  if (cert) return { certified: true, certificationHint: cert.hint };
  return {};
}

/** Ordered: the first rule that matches wins, so put the specific ones first. */
const ACTIVITY_RULES: readonly { activity: Activity; re: RegExp; skipWhenCertified?: boolean }[] = [
  {
    activity: "recovery",
    re: words(
      "perdu\\w*|tomb[ée]e?|r[ée]cup[ée]r\\w*|retrouver|lost|dropped|recover\\w*|fell\\s+in\\s+the\\s+water",
    ),
  },
  // Stated intent to take a course outranks the site names it may contain.
  { activity: "course", re: COURSE_INTENT },
  {
    activity: "discover_scuba",
    re: words(
      "bapt[êe]me|discover\\s+scuba|dsd|try\\s+diving|premi[èe]re\\s+plong[ée]e|first\\s+dive|jamais\\s+plong[ée]e?",
    ),
  },
  { activity: "snorkeling", re: words("snorkel\\w*|masque\\s+et\\s+tuba|palmes?\\s+tuba|randonn[ée]e\\s+palm[ée]e") },
  {
    activity: "certified_fun_dive",
    re: words(
      "fun\\s*dive|sortie|sail\\s*rock|koh\\s*tao|chumphon|plong[ée]e\\s+exploration|day\\s*trip|deux\\s+plong[ée]es|two\\s+dives",
    ),
  },
  /**
   * A qualification named by someone who has NOT said they hold one reads as
   * "I'd like to do that course". A certified diver naming theirs does not.
   */
  {
    activity: "course",
    re: words("open\\s*water|advanced|rescue|divemaster|dive\\s*master|nitrox|certification|brevet"),
    skipWhenCertified: true,
  },
  // Generic mention of diving, last: only if nothing more precise matched.
  { activity: "other", re: words("plong[ée]e?r?|diving|dive|scuba") },
];

export function extractActivity(text: string, certified?: boolean): Activity | undefined {
  const hit = ACTIVITY_RULES.find(
    ({ re, skipWhenCertified }) => !(skipWhenCertified && certified === true) && re.test(text),
  );
  if (!hit) return undefined;
  // A stated certification turns a vague "I want to dive" into a fun dive, and
  // a stated beginner turns it into a baptism. Nothing else is inferred.
  if (hit.activity === "other") {
    if (certified === true) return "certified_fun_dive";
    if (certified === false) return "discover_scuba";
    return "other";
  }
  return hit.activity;
}

/** Questions whose honest answer lives in `POLICIES` — often still `TODO`. */
const POLICY_QUESTION_RULES: readonly { key: string; re: RegExp }[] = [
  { key: "cancellation", re: words("annul\\w+|rembours\\w+|cancel\\w*|refund\\w*|report\\w+\\s+la\\s+date|reschedul\\w*") },
  {
    key: "paymentMethods",
    re: words("paiement|payer|carte|esp[èe]ces|cash|virement|payment|pay\\s+by|credit\\s+card|promptpay"),
  },
  { key: "deposit", re: words("acompte|arrhes|deposit|advance\\s+payment") },
  {
    key: "pickupIncluded",
    re: words("navette|transport|pickup|pick\\s*up|chercher\\s+[àa]\\s+l'?h[ôo]tel|hotel\\s+transfer"),
  },
  {
    key: "meetingPoint",
    re: words(
      "point\\s+de\\s+(rendez-?vous|rencontre)|(o[ùu]\\s+)?(on\\s+)?se\\s+retrouve\\w*(\\s+o[ùu])?|meeting\\s+point|where\\s+do\\s+we\\s+meet",
    ),
  },
  {
    key: "boatSchedule",
    re: words("quelle\\s+heure|[àa]\\s+quelle\\s+heure|horaires?|what\\s+time|d[ée]part|departure|schedule"),
  },
  { key: "insurance", re: words("assurance|insurance|couvert\\w*|covered") },
  {
    key: "flyingAfterDiving",
    re: words(
      "prendre\\s+l'avion|avion\\s+(?:le\\s+m[êe]me\\s+jour|apr[èe]s|demain)|fly\\w*\\s+(?:after|the\\s+same\\s+day)|flight\\s+after\\s+div\\w*|altitude\\s+apr[èe]s|caisson\\s+hyperbare",
    ),
  },
  {
    key: "minorMinimumAge",
    re: words(
      "[âa]ge\\s+minimum|mon\\s+fils|ma\\s+fille|enfants?|kids?|child|children|ans\\s.{0,12}(peut|plonger)|years?\\s+old",
    ),
  },
  {
    key: "requiredDocuments",
    re: words(
      "documents?|papiers|d[ée]charge|certificat\\s+m[ée]dical|liability|waiver|medical\\s+form|carte\\s+de\\s+plong[ée]e",
    ),
  },
  { key: "staffLanguages", re: words("parlez[- ]vous|vous\\s+parlez|do\\s+you\\s+speak") },
];

export function detectPolicyQuestions(text: string): string[] {
  return POLICY_QUESTION_RULES.filter(({ re }) => re.test(text)).map(({ key }) => key);
}

/** Everything above, in one pass. */
export function extract(text: string, reference: string): Extraction {
  const { dates, vagueDates } = extractDates(text, reference);
  const { certified, certificationHint } = extractCertification(text);
  return {
    dates,
    vagueDates,
    partySize: extractPartySize(text),
    certified,
    certificationHint,
    activity: extractActivity(text, certified),
    policyQuestions: detectPolicyQuestions(text),
  };
}
