import type { Metadata } from "next";
import { t } from "@/content/i18n";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/site/PageHeader";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/Icons";
import { buildWaLink, divingPrefill } from "@/lib/whatsapp";

export const metadata: Metadata = pageMetadata({
  title: t.meta.diving.title,
  description: t.meta.diving.description,
  path: "/diving",
  keywords: [...t.meta.diving.keywords],
});

export default function DivingPage() {
  const d = t.diving;
  return (
    <>
      <PageHeader kicker={d.heroKicker} title={d.heroTitle} lead={d.heroLead} />

      {/* Experience + gallery */}
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <Reveal>
            <Kicker>{d.experienceKicker}</Kicker>
            <h2 className="mt-5 text-4xl sm:text-5xl">{d.experienceTitle}</h2>
            <p className="mt-5 text-pretty text-foam-dim">{d.experienceBody}</p>
            <div className="mt-8">
              <ButtonLink href={buildWaLink(divingPrefill())} variant="primary" size="lg">
                <WhatsAppIcon width={18} height={18} />
                {t.nav.askDiving}
              </ButtonLink>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-4">
            <Reveal>
              <MediaSlot label="Underwater · @granola51" ratio="3 / 4" index="D-01" />
            </Reveal>
            <Reveal delay={90} className="pt-10">
              <MediaSlot label="Descent · @granola51" ratio="3 / 4" index="D-02" />
            </Reveal>
          </div>
        </div>
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

      {/* CTA */}
      <Section className="hairline-top">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-xl">
            <h2 className="text-4xl sm:text-5xl">{d.ctaTitle}</h2>
            <p className="mt-4 text-foam-dim">{d.ctaBody}</p>
          </div>
          <ButtonLink href={buildWaLink(divingPrefill())} variant="primary" size="lg">
            <WhatsAppIcon width={18} height={18} />
            {t.nav.askDiving}
          </ButtonLink>
        </div>
      </Section>
    </>
  );
}
