import type { Metadata } from "next";
import { t } from "@/content/i18n";
import { pageMetadata } from "@/lib/metadata";
import { PageHeader } from "@/components/site/PageHeader";
import { FinalCta } from "@/components/site/FinalCta";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { recoveryPrefill } from "@/lib/whatsapp";

export const metadata: Metadata = pageMetadata({
  title: t.meta.about.title,
  description: t.meta.about.description,
  path: "/about",
  keywords: [...t.meta.about.keywords],
});

export default function AboutPage() {
  const a = t.about;
  return (
    <>
      <PageHeader kicker={a.heroKicker} title={a.heroTitle} lead={a.heroLead} />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <Reveal>
              <h2 className="text-3xl sm:text-4xl">{a.storyTitle}</h2>
              <p className="mt-5 max-w-xl text-pretty text-foam-dim">{a.storyBody}</p>
            </Reveal>

            <Reveal className="mt-12">
              <h3 className="text-2xl">{a.valuesTitle}</h3>
              <ul className="mt-6 grid gap-4 sm:grid-cols-3">
                {a.values.map((v, i) => (
                  <li key={v.title} className="rounded-[var(--radius)] border border-foam/10 bg-abyss-2/50 p-5">
                    <span className="font-mono text-xs tracking-[0.2em] text-sand-dim">0{i + 1}</span>
                    <h4 className="mt-3 text-xl uppercase text-foam">{v.title}</h4>
                    <p className="mt-2 text-sm text-foam-dim">{v.body}</p>
                  </li>
                ))}
              </ul>
            </Reveal>

            {/*
              Owner-editable, verified-only credentials block. This is the page's strongest
              trust signal, so it gets a filled signal panel rather than a dashed placeholder.
            */}
            <Reveal className="mt-12">
              <div className="rounded-[var(--radius)] border border-signal bg-signal/[0.08] p-6">
                <Kicker>{a.credentialsTitle}</Kicker>
                <p className="mt-4 max-w-xl text-sm text-foam">{a.credentialsNote}</p>
              </div>
            </Reveal>
          </div>

          <Reveal delay={80}>
            <MediaSlot
              label={a.portraitCaption}
              src="/media/diver.jpg"
              alt="The diver behind Jammin's Depths, underwater with a camera in the Gulf of Thailand"
              ratio="4 / 5"
              index="PORTRAIT"
            />
          </Reveal>
        </div>
      </Section>

      <FinalCta
        kicker={t.home.finalKicker}
        title={t.home.finalTitle}
        body={t.home.finalBody}
        waMessage={recoveryPrefill()}
      />
    </>
  );
}
