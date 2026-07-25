import Link from "next/link";
import type { Metadata } from "next";
import { t } from "@/content/i18n";
import { pageMetadata } from "@/lib/metadata";
import { Hero } from "@/components/site/Hero";
import { FinalCta } from "@/components/site/FinalCta";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowIcon } from "@/components/ui/Icons";
import { recoveryPrefill } from "@/lib/whatsapp";

export const metadata: Metadata = pageMetadata({
  title: t.meta.home.title,
  description: t.meta.home.description,
  path: "/",
  keywords: [...t.meta.home.keywords],
});

export default function HomePage() {
  const h = t.home;
  return (
    <>
      <Hero />

      {/* Two worlds */}
      <Section id="worlds" className="hairline-top">
        <Reveal>
          <Kicker>{h.worldsKicker}</Kicker>
          <h2 className="mt-5 max-w-3xl text-balance text-4xl sm:text-5xl">{h.worldsTitle}</h2>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          {[
            {
              title: h.divingCardTitle,
              body: h.divingCardBody,
              cta: h.divingCardCta,
              href: "/diving",
              label: "Diving · Gulf of Thailand",
              src: "/media/diver.jpg",
              alt: "Scuba diver with an underwater camera on a reef in the Gulf of Thailand",
            },
            {
              title: h.recoveryCardTitle,
              body: h.recoveryCardBody,
              cta: h.recoveryCardCta,
              href: "/recovery",
              label: "Into the blue",
              src: "/media/barracuda.jpg",
              alt: "A large school of barracuda in the blue",
            },
          ].map((card, i) => (
            <Reveal key={card.href} delay={i * 80} as="article">
              <Link
                href={card.href}
                className="group flex h-full flex-col overflow-hidden rounded-[var(--radius)] border border-foam/10 bg-abyss-2/60 transition-colors hover:border-signal/40"
              >
                <MediaSlot
                  label={card.label}
                  src={card.src}
                  alt={card.alt}
                  ratio="16 / 10"
                  index={`0${i + 1}`}
                  className="rounded-none border-0"
                />
                <div className="flex flex-1 flex-col p-7">
                  <h3 className="text-3xl">{card.title}</h3>
                  <p className="mt-3 flex-1 text-pretty text-foam-dim">{card.body}</p>
                  <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-signal">
                    {card.cta}
                    <ArrowIcon width={16} height={16} className="transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Reassurance */}
      <Section className="hairline-top">
        <Reveal>
          <Kicker>{h.reassuranceKicker}</Kicker>
          <h2 className="mt-5 max-w-2xl text-balance text-4xl sm:text-5xl">{h.reassuranceTitle}</h2>
        </Reveal>
        <div className="mt-12 grid gap-px overflow-hidden rounded-[var(--radius)] border border-foam/10 bg-foam/10 sm:grid-cols-3">
          {h.reassuranceItems.map((item, i) => (
            <Reveal key={item.title} delay={i * 80} className="bg-abyss p-7">
              <span className="font-mono text-xs tracking-[0.2em] text-sand-dim">0{i + 1}</span>
              <h3 className="mt-4 text-2xl text-foam">{item.title}</h3>
              <p className="mt-3 text-sm text-foam-dim">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Gallery */}
      <Section className="hairline-top">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <Kicker>{h.galleryKicker}</Kicker>
            <h2 className="mt-5 max-w-xl text-balance text-4xl sm:text-5xl">{h.galleryTitle}</h2>
          </Reveal>
          <Reveal className="max-w-sm">
            <p className="text-sm text-foam-dim">{h.galleryNote}</p>
          </Reveal>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: "Reef life · Gulf of Thailand", src: "/media/reef-nudibranch.jpg", alt: "Colourful nudibranch on the reef in the Gulf of Thailand" },
            { label: "Fusiliers · Sail Rock", src: "/media/fusiliers.jpg", alt: "A school of yellow fusiliers over the reef at Sail Rock" },
            { label: "Similan Islands", src: "/media/similan-surface.jpg", alt: "The Similan Islands seen from the dive boat" },
            { label: "Barracuda · Sail Rock", src: "/media/barracuda.jpg", alt: "A school of barracuda in the blue at Sail Rock" },
          ].map((photo, i) => (
            <Reveal key={photo.label} delay={i * 60}>
              <MediaSlot
                label={photo.label}
                src={photo.src}
                alt={photo.alt}
                ratio={i % 2 === 0 ? "3 / 4" : "4 / 5"}
                index={`G-0${i + 1}`}
              />
            </Reveal>
          ))}
        </div>
        <div className="mt-8">
          <ButtonLink href="/recovery" variant="outline">
            Start a recovery request <ArrowIcon width={16} height={16} />
          </ButtonLink>
        </div>
      </Section>

      <FinalCta
        kicker={h.finalKicker}
        title={h.finalTitle}
        body={h.finalBody}
        waMessage={recoveryPrefill()}
      />
    </>
  );
}
