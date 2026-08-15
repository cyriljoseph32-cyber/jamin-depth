import { getDictionary, type Locale } from "@/content/i18n";

/**
 * The knowledge base — the site's own FAQ, reused verbatim.
 *
 * Phase 0 asked what real material existed to answer from. This is it: the FAQ
 * blocks in `src/content/fr.ts` and `en.ts`, already written by the owner,
 * already published, already carrying a `confirmed` flag. Nothing here is
 * generated, translated or paraphrased — an answer is either the owner's
 * sentence or it does not exist.
 *
 * Only `confirmed: true` entries are loaded. An answer the owner has not
 * confirmed is not a weaker answer; it is not an answer.
 */

export interface KnowledgeEntry {
  id: string;
  locale: Locale;
  question: string;
  answer: string;
  /** Which FAQ block it came from — auditable back to the page. */
  source: "faq" | "faqRecovery";
  /** Significant words from the question, normalised. */
  keywords: string[];
}

/** Words that carry no topic. Kept short: over-filtering loses real signal. */
const STOPWORDS = new Set([
  // fr
  "avec", "dans", "pour", "vous", "nous", "faut", "puis", "est", "sont", "les", "des", "une", "que",
  "qui", "quoi", "quel", "quelle", "quels", "quelles", "comment", "pourquoi", "dois", "peut", "peux",
  "mon", ", ma", "mes", "votre", "vos", "sur", "par", "pas", "plus", "aussi", "tout", "tous", "elle",
  "cela", "avez", "avoir", "etre", "fait", "faire", "donc", "mais", "leur",
  // en
  "with", "what", "when", "where", "which", "should", "would", "could", "have", "has", "the", "and",
  "for", "you", "your", "are", "can", "does", "did", "how", "why", "there", "their", "this", "that",
  "from", "about", "need", "want", "will", "then", "than", "before", "after", "any",
]);

/** Lowercase, accent-free, so "baptême" and "bapteme" match. */
export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function keywordsOf(question: string): string[] {
  return [
    ...new Set(
      normalise(question)
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => w.length > 3 && !STOPWORDS.has(w)),
    ),
  ];
}

/** Every confirmed FAQ answer for a locale. */
export function knowledgeBase(locale: Locale): KnowledgeEntry[] {
  const dict = getDictionary(locale);
  const entries: KnowledgeEntry[] = [];

  for (const source of ["faq", "faqRecovery"] as const) {
    dict[source].items.forEach((item, index) => {
      if (!item.confirmed) return;
      entries.push({
        id: `${source}.${index}`,
        locale,
        question: item.q,
        answer: item.a,
        source,
        keywords: keywordsOf(item.q),
      });
    });
  }

  return entries;
}

export interface KnowledgeMatch {
  entry: KnowledgeEntry;
  score: number;
}

/**
 * Find the FAQ entry a message is asking about.
 *
 * Two guards against answering the wrong question, which is worse than not
 * answering: at least two topic words must match, and the best match must beat
 * the runner-up. A tie means the message is ambiguous, and an ambiguous message
 * goes to a human rather than getting a confident answer to something the
 * visitor did not ask.
 */
export function findAnswer(text: string, locale: Locale): KnowledgeMatch | null {
  const words = new Set(
    normalise(text)
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 3),
  );
  if (words.size === 0) return null;

  const scored = knowledgeBase(locale)
    .map((entry) => ({ entry, score: entry.keywords.filter((k) => words.has(k)).length }))
    .filter((m) => m.score >= 2)
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best) return null;
  const runnerUp = scored[1];
  if (runnerUp && runnerUp.score === best.score) return null;
  return best;
}
