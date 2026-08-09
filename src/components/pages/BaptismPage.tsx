import type { Locale, Dictionary } from "@/content/i18n";
import { pathFor } from "@/content/routes";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";
import { WhyUs } from "@/components/site/WhyUs";
import { Faq } from "@/components/site/Faq";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowIcon, WhatsAppIcon } from "@/components/ui/Icons";
import { buildWaLink, coursePrefill } from "@/lib/whatsapp";
import { trackable } from "@/lib/analytics";

/**
 * Search landing page for "baptême plongée Koh Samui" — the highest-volume
 * beginner query in French.
 *
 * Every fact on this page is reused from existing verified content: the
 * Discover Scuba course entry, the courses disclaimer, `why` and `faq`. No
 * inclusions, transfers, group sizes or swimming requirements are asserted,
 * because none of them are confirmed.
 */
export function BaptismPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const b = dict.baptism;
  const d = dict.diving;
  // The Discover Scuba entry is the single source of truth for this page.
  const dsd = d.courses.find((c) => c.code === "DSD") ?? d.courses[0];
  if (!dsd) return null;

  const waHref = buildWaLink(coursePrefill(dsd.name, dict.wa));

  return (
    <>
      <PageHeader kicker={b.heroKicker} title={b.heroTitle} lead={b.heroLead} />

      <Section className="hairline-top">
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <Reveal>
            <Kicker>{b.whatKicker}</Kicker>
            <h2 className="mt-5 text-balance text-4xl sm:text-5xl">{b.whatTitle}</h2>
            <p className="mt-5 max-w-xl text-pretty text-foam-dim">{dsd.summary}</p>

            <dl className="mt-8 flex flex-wrap gap-3">
              <div className="rounded-[var(--radius)] border border-signal/30 bg-signal/10 px-4 py-2.5">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-sand-dim">
                  {d.coursesPriceFrom}
                </dt>
                <dd className="mt-0.5 font-mono text-lg text-foam">{dsd.priceFrom}</dd>
              </div>
              <div className="rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 px-4 py-2.5">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-sand-dim">
                  {b.includedTitle}
                </dt>
                <dd className="mt-0.5 font-mono text-lg text-foam">{dsd.duration}</dd>
              </div>
              <div className="rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 px-4 py-2.5">
                <dt className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-sand-dim">
                  PADI
                </dt>
                <dd className="mt-0.5 font-mono text-lg text-foam">{d.noCertBadge}</dd>
              </div>
            </dl>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <ButtonLink
                href={waHref}
                size="lg"
                variant="primary"
                {...trackable("whatsapp_click_offer", { kind: "course", offer: "DSD", page: "baptism" })}
              >
                <WhatsAppIcon width={18} height={18} />
                {d.courseCta}
              </ButtonLink>
              <ButtonLink href={pathFor("diving", locale)} size="lg" variant="outline">
                {b.seeAllCourses}
                <ArrowIcon width={16} height={16} />
              </ButtonLink>
            </div>

            <p className="mt-8 max-w-2xl border-l-2 border-signal/60 pl-5 text-sm text-sand">
              {d.coursesDisclaimer}
            </p>
          </Reveal>

          <Reveal delay={80}>
            <MediaSlot
              label={d.experienceTitle}
              src="/media/fusiliers.jpg"
              alt="A school of yellow fusiliers over the reef in the Gulf of Thailand, seen on a first dive"
              ratio="4 / 5"
              index="DSD"
            />
          </Reveal>
        </div>
      </Section>

      <WhyUs dict={dict} />

      <Faq dict={dict} locale={locale} page="baptism" />

      <FinalCta
        dict={dict}
        kicker={b.ctaKicker}
        title={b.ctaTitle}
        body={b.ctaBody}
        waMessage={coursePrefill(dsd.name, dict.wa)}
      />
    </>
  );
}
