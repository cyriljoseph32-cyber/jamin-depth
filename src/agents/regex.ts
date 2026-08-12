/**
 * Unicode-aware word boundaries.
 *
 * JavaScript's `\b` is defined against ASCII `\w`, so an accented letter counts
 * as a NON-word character. The consequences are not cosmetic in a French-first
 * system: `/\bcertifi[ée]\b/` never matches "certifié", `/\b[ée]pileps\w*\b/`
 * never matches "épilepsie", and a guard written as `/c'est\s+confirm[ée]\b/`
 * would let "c'est confirmé" straight through to a customer.
 *
 * `words()` builds the same intent with real Unicode boundaries, so every
 * safety pattern in `policy.ts` and every extraction rule in `extract.ts`
 * behaves the same on "plongé" as on "plonge".
 */

export const WORD_START = "(?<![\\p{L}\\p{N}_])";
export const WORD_END = "(?![\\p{L}\\p{N}_])";

/**
 * Wrap `source` so it only matches on whole words, accents included.
 * The `u` flag is always applied — the boundaries need it.
 */
export function words(source: string, flags = "i"): RegExp {
  const withUnicode = flags.includes("u") ? flags : `${flags}u`;
  return new RegExp(`${WORD_START}(?:${source})${WORD_END}`, withUnicode);
}
