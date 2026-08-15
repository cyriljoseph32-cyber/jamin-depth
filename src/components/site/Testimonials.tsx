import type { Dictionary, Locale } from "@/content/i18n";
import { publishedTestimonials } from "@/content/testimonials";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";

/**
 * Real messages from divers, quoted verbatim.
 *
 * The consent gate is the whole point of this component. These quotes come from
 * private WhatsApp conversations: the sender wrote to the diver, not to the
 * internet. So an entry appears only when `consent: true`, and if none does, the
 * section renders nothing at all rather than an empty heading — an unconsented
 * testimonial is not a draft to be styled, it is something we do not have.
 *
 * The quotes come from `content/testimonials.ts`, not from the dictionary: the
 * dictionary is serialised into every page's HTML for hydration, so a pending
 * quote stored there would be readable with "view source" while this component
 * dutifully refused to render it.
 *
 * Deliberately absent: any `Review` or `AggregateRating` structured data. A
 * business marking up its own hand-picked quotes as review data on its own page
 * is against Google's guidelines and risks a manual action. If star ratings are
 * wanted, they have to come from a platform that collects them — a claimed
 * Google Business Profile, not this file.
 */
export function Testimonials({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const t = dict.testimonials;
  const published = publishedTestimonials();

  // Nothing consented yet: no heading, no placeholder, no section.
  if (published.length === 0) return null;

  return (
    <Section className="hairline-top">
      <Reveal>
        <Kicker>{t.kicker}</Kicker>
        <h2 className="mt-5 max-w-2xl text-balance text-4xl sm:text-5xl">{t.title}</h2>
      </Reveal>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {published.map((item, i) => (
          <Reveal key={item.name} delay={i * 80} className="h-full">
            <figure className="flex h-full flex-col rounded-[var(--radius)] border border-foam/10 bg-abyss-2/60 p-7">
              <blockquote className="flex-1 text-pretty text-lg text-foam">“{item.quote}”</blockquote>
              <figcaption className="mt-6 font-mono text-xs uppercase tracking-[0.14em] text-foam-dim">
                {item.name}
                <span className="text-signal"> · {item.context[locale]}</span>
              </figcaption>
            </figure>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
