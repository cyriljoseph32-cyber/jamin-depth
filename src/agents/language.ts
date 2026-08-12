import { defaultLocale, isLocale, type Locale } from "@/content/i18n";

/**
 * Deterministic language detection — no model call, no tokens.
 *
 * Two jobs, and the second matters more than the first:
 * 1. FR or EN, so the reply is in the visitor's language.
 * 2. Spot a language we do NOT serve. The brand rule is that we never invent
 *    human language skills, so a message in German or Hindi is not answered in
 *    approximate German: it is flagged, and a human decides.
 *
 * Thai is treated as a supplier/local-operations language, not a customer one.
 */

export interface LanguageVerdict {
  locale: Locale;
  /** ISO code of a detected language we do not serve, if any. */
  foreignLanguage?: string;
  /** `low` means the text was too short or too neutral to tell — reply in the fallback. */
  confidence: "high" | "low";
}

/** Function words are the cheap, reliable signal; content words are not. */
const FR_MARKERS = [
  "je", "nous", "vous", "bonjour", "salut", "merci", "est", "sont", "pour", "avec",
  "une", "des", "les", "que", "qui", "pas", "plus", "mais", "aussi", "peut",
  "voudrais", "souhaite", "aimerais", "réserver", "plongée", "plonger", "baptême",
  "combien", "quand", "où", "prix", "personnes", "sommes", "brevet", "niveau",
  "possible", "demain", "matin", "après", "jours", "semaine", "bateau", "sur",
];

const EN_MARKERS = [
  "i", "we", "you", "hello", "hi", "thanks", "thank", "is", "are", "for", "with",
  "the", "and", "that", "not", "would", "like", "want", "book", "booking", "dive",
  "diving", "how", "much", "when", "where", "price", "people", "certified", "level",
  "possible", "tomorrow", "morning", "days", "week", "boat", "please", "do",
];

/**
 * Languages we can recognise well enough to hand off. The point is not to
 * translate them — it is to avoid answering them in the wrong language.
 */
const OTHER_MARKERS: Record<string, readonly string[]> = {
  de: ["ich", "wir", "hallo", "danke", "möchte", "tauchen", "und", "nicht", "wie", "viel", "kosten"],
  es: ["hola", "gracias", "quiero", "quisiera", "buceo", "bucear", "cuánto", "cuesta", "personas", "somos"],
  it: ["ciao", "grazie", "vorrei", "immersione", "quanto", "costa", "persone", "siamo", "sono"],
  nl: ["hallo", "bedankt", "duiken", "hoeveel", "kost", "wij", "willen", "graag"],
  pt: ["olá", "obrigado", "quero", "mergulho", "quanto", "custa", "pessoas", "somos"],
  ru: ["привет", "спасибо", "хочу", "сколько", "стоит"],
  th: ["สวัสดี", "ขอบคุณ", "ดำน้ำ", "ราคา", "เท่าไหร่"],
  hi: ["नमस्ते", "धन्यवाद", "कितना", "गोता"],
  ja: ["こんにちは", "ありがとう", "ダイビング"],
  zh: ["你好", "谢谢", "潜水", "多少"],
};

/** A non-Latin script is decisive on its own — no word list needed. */
const SCRIPTS: readonly { code: string; re: RegExp }[] = [
  { code: "th", re: /\p{Script=Thai}/u },
  { code: "hi", re: /\p{Script=Devanagari}/u },
  { code: "ru", re: /\p{Script=Cyrillic}/u },
  { code: "ar", re: /\p{Script=Arabic}/u },
  { code: "zh", re: /\p{Script=Han}/u },
  { code: "ja", re: /\p{Script=Hiragana}|\p{Script=Katakana}/u },
  { code: "ko", re: /\p{Script=Hangul}/u },
];

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((w) => w.length > 0);
}

function score(words: readonly string[], markers: readonly string[]): number {
  const set = new Set(markers);
  return words.reduce((n, w) => (set.has(w) ? n + 1 : n), 0);
}

/** French-specific diacritics. Cheap tiebreaker for short messages. */
function frenchAccentBonus(text: string): number {
  const hits = text.match(/[àâçéèêëîïôùûüœ]/gi);
  return hits ? Math.min(hits.length, 3) : 0;
}

export function detectLanguage(text: string, hint?: string): LanguageVerdict {
  const trimmed = text.trim();

  // A channel-provided locale (e.g. the visitor is browsing /fr) is evidence,
  // but a message plainly written in the other language still wins below.
  const hinted = hint && isLocale(hint) ? hint : undefined;

  if (trimmed.length === 0) {
    return { locale: hinted ?? defaultLocale, confidence: "low" };
  }

  for (const { code, re } of SCRIPTS) {
    if (re.test(trimmed)) {
      // Latin-script locales stay for FR/EN; anything else is a handoff.
      return { locale: hinted ?? defaultLocale, foreignLanguage: code, confidence: "high" };
    }
  }

  const words = tokenize(trimmed);
  const fr = score(words, FR_MARKERS) + frenchAccentBonus(trimmed);
  const en = score(words, EN_MARKERS);

  let bestOther: { code: string; n: number } | null = null;
  for (const [code, markers] of Object.entries(OTHER_MARKERS)) {
    const n = score(words, markers);
    if (n > 0 && (bestOther === null || n > bestOther.n)) bestOther = { code, n };
  }

  // Another Latin-script language only wins if it clearly beats both of ours —
  // "hola" inside an otherwise English message must not trigger a handoff.
  if (bestOther !== null && bestOther.n >= 2 && bestOther.n > fr && bestOther.n > en) {
    return { locale: hinted ?? defaultLocale, foreignLanguage: bestOther.code, confidence: "high" };
  }

  if (fr === 0 && en === 0) {
    return { locale: hinted ?? defaultLocale, confidence: "low" };
  }

  const locale: Locale = fr === en ? (hinted ?? defaultLocale) : fr > en ? "fr" : "en";
  return { locale, confidence: Math.abs(fr - en) >= 2 ? "high" : "low" };
}
