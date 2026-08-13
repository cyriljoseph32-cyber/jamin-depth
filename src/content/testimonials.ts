/**
 * Real messages from divers, quoted verbatim from WhatsApp.
 *
 * **Why this is not in `fr.ts` / `en.ts`.** The dictionary is passed as a prop
 * across a client boundary, so Next serialises the whole of it into the RSC
 * payload embedded in every page's HTML. Quotes kept there were readable with
 * "view source" even though the component refused to render them — the consent
 * flag stopped the display and not the publication, which is the opposite of
 * the point. Living here, an unconsented quote never leaves the server: only
 * what `publishedTestimonials()` returns gets rendered, and only rendered
 * output reaches the browser.
 *
 * Two rules, both enforced by `testimonials.test.ts`:
 *
 * 1. `consent: false` means NOT PUBLISHED. These are private messages — their
 *    authors wrote to the diver, not to the internet. Flip the flag once you
 *    have actually asked; a WhatsApp "ok pour que je le mette sur le site ?"
 *    is enough.
 * 2. First names only. Never an address, a date of birth or a phone number.
 *    A testimonial needs a voice, not an identity.
 *
 * Quotes keep their author's own wording and punctuation, in their original
 * language. Translating a customer's words puts sentences in their mouth;
 * polishing them into marketing prose is how they stop sounding real.
 */

export interface Testimonial {
  /** The sender's own words, unedited. */
  quote: string;
  /** First name, or how they signed off. */
  name: string;
  /** What they dived, per locale — context, not a claim about the person. */
  context: { fr: string; en: string };
  /** Asked, and said yes. Nothing renders while this is false. */
  consent: boolean;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    quote:
      "Thank you very much for sharing videos and pictures. I really appreciated the dives with you today.",
    name: "Thorsten",
    context: { fr: "Plongées d'exploration", en: "Fun dives" },
    consent: false,
  },
  {
    quote:
      "We'd like to take this opportunity to thank you once again for your great effort and everyone for their patience. We had a lot of fun.",
    name: "Frank & Lion",
    context: { fr: "Advanced Open Water", en: "Advanced Open Water" },
    consent: false,
  },
  {
    quote: "Merci pour cette superbe expérience Cyril !",
    name: "Hester",
    context: { fr: "Journée de plongée", en: "Diving day" },
    consent: false,
  },
  {
    quote: "Encore merci pour mon baptême, je garde un super bon souvenir à raconter !",
    name: "Bernard",
    context: { fr: "Baptême de plongée", en: "Discover Scuba Diving" },
    consent: false,
  },
];

/** The only ones allowed off the server. */
export function publishedTestimonials(): Testimonial[] {
  return TESTIMONIALS.filter((t) => t.consent);
}

/** How many are still waiting on a yes — for the owner's own tracking. */
export function pendingConsentCount(): number {
  return TESTIMONIALS.length - publishedTestimonials().length;
}
