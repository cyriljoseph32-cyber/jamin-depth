import type { Locale, Dictionary } from "@/content/i18n";
import { faqJsonLd } from "@/lib/seo";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";

/**
 * FAQ accordion.
 *
 * Built on native <details>/<summary>: keyboard accessible and fully usable
 * with no JavaScript. Items start collapsed — the answers still reach Google
 * through the FAQPage structured data emitted below.
 *
 * Answers the owner still has to supply carry `confirmed: false`. Those render
 * a visible badge and are excluded from the FAQPage structured data (see
 * `faqJsonLd`) — placeholder text must never reach a search result.
 */
export function Faq({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const f = dict.faq;
  const jsonLd = faqJsonLd(locale);
  return (
    <Section id="faq" className="hairline-top">
      {/* Only confirmed answers reach structured data — see faqJsonLd. */}
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <Reveal>
        <Kicker>{f.kicker}</Kicker>
        <h2 className="mt-5 max-w-2xl text-balance text-4xl sm:text-5xl">{f.title}</h2>
        <p className="mt-5 max-w-xl text-pretty text-foam-dim">{f.lead}</p>
      </Reveal>

      <div className="mt-12 border-t border-foam/10">
        {f.items.map((item, i) => (
          <Reveal key={item.q} delay={i * 50}>
            <details className="group border-b border-foam/10">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 py-6 text-left [&::-webkit-details-marker]:hidden">
                <h3 className="heading-sentence text-xl text-foam transition-colors group-hover:text-signal sm:text-2xl">
                  {item.q}
                </h3>
                <span
                  aria-hidden
                  className="mt-1 shrink-0 font-mono text-lg leading-none text-signal transition-transform duration-200 group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <div className="pb-7 pr-10">
                <p className="max-w-2xl text-pretty text-foam-dim">{item.a}</p>
                {!item.confirmed ? (
                  <p className="mt-3 inline-flex items-center gap-2 border border-sand-dim/40 px-3 py-1.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-sand-dim">
                    {f.toConfirm}
                  </p>
                ) : null}
              </div>
            </details>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
