import type { Locale, Dictionary } from "@/content/i18n";
import { coursesJsonLd } from "@/lib/seo";
import { pathFor } from "@/content/routes";
import { DIVE_CENTER } from "@/content/site";
import { PageHeader } from "@/components/site/PageHeader";
import { Faq } from "@/components/site/Faq";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon, ArrowIcon } from "@/components/ui/Icons";
import { buildWaLink, divingPrefill, coursePrefill, tripPrefill } from "@/lib/whatsapp";
import { trackable } from "@/lib/analytics";

export function DivingPage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const d = dict.diving;
  return (
    <>
      {/* Verified Discovery Divers rates — safe to publish as Offers. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(coursesJsonLd(locale)) }}
      />
      <PageHeader kicker={d.heroKicker} title={d.heroTitle} lead={d.heroLead} />

      {/* Experience + gallery */}
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Kicker>{d.experienceKicker}</Kicker>
            <h2 className="mt-5 text-4xl sm:text-5xl">{d.experienceTitle}</h2>
            <p className="mt-5 text-pretty text-foam-dim">{d.experienceBody}</p>
            <div className="mt-8">
              <ButtonLink href={buildWaLink(divingPrefill(dict.wa))} variant="primary" size="lg">
                <WhatsAppIcon width={18} height={18} />
                {dict.nav.askDiving}
              </ButtonLink>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            <Reveal>
              <MediaSlot
                {...dict.media.divers}
                src="/media/divers-chumphon-pinnacle.jpg"
                ratio="3 / 4"
                index="D-01"
              />
            </Reveal>
            <Reveal delay={90} className="pt-10">
              <MediaSlot
                {...dict.media.reef}
                src="/media/reef-nudibranch.jpg"
                ratio="3 / 4"
                index="D-02"
              />
            </Reveal>
          </div>
        </div>
      </Section>

      {/* Courses — with Discovery Divers */}
      <Section id="courses" className="hairline-top">
        <Reveal>
          <Kicker>{d.coursesKicker}</Kicker>
          <h2 className="mt-5 max-w-3xl text-balance text-4xl sm:text-5xl">{d.coursesTitle}</h2>
          <p className="mt-5 max-w-2xl text-pretty text-foam-dim">{d.coursesIntro}</p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {d.courses.map((course, i) => (
            <Reveal key={course.code} delay={i * 60} as="article">
              <div className="flex h-full flex-col rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-6">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`font-mono text-[0.6rem] uppercase tracking-[0.16em] ${
                      course.cert ? "text-signal" : "text-sand-dim"
                    }`}
                  >
                    {course.cert ? d.certBadge : d.noCertBadge}
                  </span>
                  <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-sand-dim">
                    {course.duration}
                  </span>
                </div>
                <h3 className="mt-3 text-2xl text-foam">{course.name}</h3>
                <p className="mt-2 flex-1 text-sm text-foam-dim">{course.summary}</p>
                {/* Filled chip — priced content is the data that matters most on this page. */}
                {course.priceFrom ? (
                  <p className="mt-4">
                    <span className="inline-flex items-baseline gap-2 rounded-[var(--radius)] border border-signal/30 bg-signal/10 px-3 py-1.5 font-mono text-sm text-foam">
                      <span className="text-[0.62rem] uppercase tracking-[0.16em] text-sand-dim">
                        {d.coursesPriceFrom}
                      </span>
                      {course.priceFrom}
                    </span>
                  </p>
                ) : null}
                {/* Every priced card converts on its own — the visitor never has to scroll back up. */}
                <a
                  href={buildWaLink(coursePrefill(course.name, dict.wa))}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...trackable("whatsapp_click_offer", { kind: "course", offer: course.code })}
                  className="mt-4 inline-flex items-center gap-2 font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal transition-colors hover:text-foam"
                >
                  <WhatsAppIcon width={15} height={15} />
                  {d.courseCta}
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <p className="mt-8 max-w-3xl border-l-2 border-signal/60 pl-5 text-sm text-sand">
            {d.coursesDisclaimer}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={DIVE_CENTER.pricingUrl} variant="primary" size="lg">
              {d.coursesCtaLabel}
              <ArrowIcon width={16} height={16} />
            </ButtonLink>
            <ButtonLink href={buildWaLink(divingPrefill(dict.wa))} variant="outline" size="lg">
              <WhatsAppIcon width={18} height={18} />
              {dict.nav.askDiving}
            </ButtonLink>
            {/* Internal link to the beginner landing page — keeps it out of the nav
                while still giving it a crawlable path and real traffic. */}
            <ButtonLink href={pathFor("baptism", locale)} variant="ghost" size="lg">
              {dict.nav.pages.baptism}
              <ArrowIcon width={16} height={16} />
            </ButtonLink>
          </div>
          <p className="mt-4 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-sand-dim">
            {DIVE_CENTER.status} · {DIVE_CENTER.name}
          </p>
        </Reveal>
      </Section>

      {/* Fun dives & trips */}
      <Section id="trips" className="hairline-top">
        <Reveal>
          <Kicker>{d.tripsKicker}</Kicker>
          <h2 className="mt-5 max-w-3xl text-balance text-4xl sm:text-5xl">{d.tripsTitle}</h2>
          <p className="mt-5 max-w-2xl text-pretty text-foam-dim">{d.tripsIntro}</p>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {d.trips.map((trip, i) => (
            <Reveal key={trip.name} delay={i * 60} as="article">
              <div className="flex h-full flex-col justify-between rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-5">
                <div>
                  <h3 className="text-xl text-foam">{trip.name}</h3>
                  <p className="mt-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-sand-dim">
                    {trip.detail}
                  </p>
                </div>
                <div className="mt-6">
                  <p className="font-mono text-lg text-signal">{trip.price}</p>
                  <a
                    href={buildWaLink(tripPrefill(trip.name, dict.wa))}
                    target="_blank"
                    rel="noopener noreferrer"
                    {...trackable("whatsapp_click_offer", { kind: "trip", offer: trip.name })}
                    className="mt-3 inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.14em] text-foam-dim transition-colors hover:text-signal"
                  >
                    <WhatsAppIcon width={14} height={14} />
                    {d.tripCta}
                  </a>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-8 max-w-3xl border-l-2 border-signal/60 pl-5 text-sm text-sand">{d.tripsNote}</p>
          <div className="mt-8">
            <ButtonLink href={buildWaLink(divingPrefill(dict.wa))} variant="primary" size="lg">
              <WhatsAppIcon width={18} height={18} />
              {dict.nav.askDiving}
            </ButtonLink>
          </div>
        </Reveal>
      </Section>

      {/* Preparation */}
      <Section className="hairline-top">
        <Reveal>
          <Kicker>{d.prepKicker}</Kicker>
          <h2 className="mt-5 text-4xl sm:text-5xl">{d.prepTitle}</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {d.prep.map((p, i) => (
            <Reveal key={p.title} delay={i * 70} as="article">
              <div className="h-full rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-6">
                <span className="font-mono text-xs tracking-[0.2em] text-sand-dim">0{i + 1}</span>
                <h3 className="mt-3 text-2xl text-foam">{p.title}</h3>
                <p className="mt-2 text-sm text-foam-dim">{p.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Dive with respect */}
      <Section className="hairline-top">
        <Reveal className="relative overflow-hidden rounded-[var(--radius)] border border-deepgreen/60 bg-[color:var(--color-deepgreen)]/25 p-8 sm:p-14">
          <div className="max-w-2xl">
            <Kicker>{d.respectKicker}</Kicker>
            <h2 className="mt-5 text-4xl sm:text-5xl">{d.respectTitle}</h2>
            <p className="mt-5 text-pretty text-foam-dim">{d.respectBody}</p>
          </div>
        </Reveal>
      </Section>

      <Faq dict={dict} locale={locale} page="diving" />

      {/* CTA */}
      <Section className="hairline-top">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-4xl sm:text-5xl">{d.ctaTitle}</h2>
            <p className="mt-4 text-foam-dim">{d.ctaBody}</p>
          </div>
          <ButtonLink href={buildWaLink(divingPrefill(dict.wa))} variant="primary" size="lg">
            <WhatsAppIcon width={18} height={18} />
            {dict.nav.askDiving}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
