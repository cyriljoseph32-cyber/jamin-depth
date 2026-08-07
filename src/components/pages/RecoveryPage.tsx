import type { Locale, Dictionary } from "@/content/i18n";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { RecoveryForm } from "@/components/forms/RecoveryForm";
import { recoveryPrefill } from "@/lib/whatsapp";

export function RecoveryPage({ dict }: { dict: Dictionary; locale: Locale }) {
  const r = dict.recovery;
  return (
    <>
      <PageHeader kicker={r.heroKicker} title={r.heroTitle} lead={r.heroLead} />

      {/* Cases */}
      <Section>
        <Reveal>
          <Kicker>{r.casesKicker}</Kicker>
          <h2 className="mt-5 text-4xl sm:text-5xl">{r.casesTitle}</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {r.cases.map((c, i) => (
            <Reveal key={c.title} delay={i * 60} as="article">
              <div className="h-full rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-6">
                <span className="font-mono text-xs tracking-[0.2em] text-sand-dim">CASE 0{i + 1}</span>
                <h3 className="mt-3 text-2xl text-foam">{c.title}</h3>
                <p className="mt-2 text-sm text-foam-dim">{c.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal>
          <p className="mt-8 max-w-3xl border-l-2 border-signal/60 pl-5 text-sm text-sand">
            {r.honestNote}
          </p>
        </Reveal>
      </Section>

      {/* Process */}
      <Section className="hairline-top">
        <Reveal>
          <Kicker>{r.processKicker}</Kicker>
          <h2 className="mt-5 text-4xl sm:text-5xl">{r.processTitle}</h2>
        </Reveal>
        <ol className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius)] border border-foam/10 bg-foam/10 sm:grid-cols-2 lg:grid-cols-4">
          {r.steps.map((step, i) => (
            <Reveal key={step.n} delay={i * 70} as="li" className="relative bg-abyss p-7">
              <span className="font-display text-5xl text-signal/90">{step.n}</span>
              <h3 className="mt-3 text-xl uppercase text-foam">{step.title}</h3>
              <p className="mt-2 text-sm text-foam-dim">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* Form */}
      <Section id="request" className="hairline-top">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal>
            <Kicker>{r.formKicker}</Kicker>
            <h2 className="mt-5 text-4xl sm:text-5xl">{r.formTitle}</h2>
            <p className="mt-5 max-w-md text-pretty text-foam-dim">{r.formLead}</p>
            <p className="mt-8 max-w-md rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-5 text-sm text-sand">
              {r.responsibleNote}
            </p>
          </Reveal>
          <Reveal delay={80}>
            <div className="rounded-[var(--radius)] border border-foam/10 bg-abyss-2/40 p-6 sm:p-8">
              <RecoveryForm dict={dict} />
            </div>
          </Reveal>
        </div>
      </Section>

      <FinalCta
        dict={dict}
        kicker={dict.home.finalKicker}
        title={dict.home.finalTitle}
        body={dict.home.finalBody}
        waMessage={recoveryPrefill(dict.wa)}
      />
    </>
  );
}
