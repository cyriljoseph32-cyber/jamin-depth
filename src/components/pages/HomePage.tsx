import Link from "next/link";
import type { Locale, Dictionary } from "@/content/i18n";
import { pathFor } from "@/content/routes";
import { Hero } from "@/components/site/Hero";
import { FinalCta } from "@/components/site/FinalCta";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { MediaSlot } from "@/components/ui/MediaSlot";
import { WhyUs } from "@/components/site/WhyUs";
import { Faq } from "@/components/site/Faq";
import { Testimonials } from "@/components/site/Testimonials";
import { ButtonLink } from "@/components/ui/Button";
import { ArrowIcon } from "@/components/ui/Icons";
import { recoveryPrefill } from "@/lib/whatsapp";

export function HomePage({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const h = dict.home;
  const m = dict.media;
  return (
    <>
      <Hero dict={dict} locale={locale} />

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
              href: pathFor("diving", locale),
              ...m.divingCard,
              src: "/media/divers-group.jpg",
            },
            {
              title: h.recoveryCardTitle,
              body: h.recoveryCardBody,
              cta: h.recoveryCardCta,
              href: pathFor("recovery", locale),
              ...m.barracuda,
              src: "/media/barracuda.jpg",
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
        {/* Hairline rules, not card islands — the divider is the rhythm. */}
        <div className="mt-12 grid divide-y divide-foam/10 border-y border-foam/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:border-b-0">
          {h.reassuranceItems.map((item, i) => (
            <Reveal
              key={item.title}
              delay={i * 80}
              className="py-7 sm:px-7 sm:first:pl-0 sm:last:pr-0"
            >
              <span className="font-mono text-xs tracking-[0.2em] text-sand-dim">0{i + 1}</span>
              <h3 className="mt-4 text-2xl text-foam">{item.title}</h3>
              <p className="mt-3 text-sm text-foam-dim">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* In their words — renders nothing until a diver has given permission. */}
      <Testimonials dict={dict} locale={locale} />

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
        {/*
          Asymmetric mosaic on desktop — the grid rows set the heights, so each slot runs
          with ratio={null}. Below lg it collapses to a 2-up grid where the wrapper's own
          aspect ratio takes over instead.
        */}
        <div className="mt-10 grid grid-cols-2 gap-1.5 lg:h-[34rem] lg:grid-cols-[1.3fr_1fr_1fr] lg:grid-rows-2">
          {[
            {
              ...m.reef,
              src: "/media/reef-nudibranch.jpg",
              aspect: "aspect-[3/4]",
              place: "lg:col-start-1 lg:row-start-1 lg:row-span-2",
            },
            {
              ...m.fusiliers,
              src: "/media/fusiliers.jpg",
              aspect: "aspect-[4/5]",
              place: "lg:col-start-2 lg:row-start-1",
            },
            {
              ...m.turtle,
              src: "/media/turtle-tanote-bay.jpg",
              aspect: "aspect-[3/4]",
              place: "lg:col-start-3 lg:row-start-1",
            },
            {
              ...m.platax,
              src: "/media/platax-sail-rock.jpg",
              aspect: "aspect-[4/5]",
              place: "lg:col-start-2 lg:col-span-2 lg:row-start-2",
            },
          ].map((photo, i) => (
            <Reveal
              key={photo.label}
              delay={i * 60}
              className={`${photo.aspect} ${photo.place} lg:aspect-auto lg:h-full`}
            >
              <MediaSlot
                label={photo.label}
                src={photo.src}
                alt={photo.alt}
                ratio={null}
                index={`G-0${i + 1}`}
              />
            </Reveal>
          ))}
        </div>
        <div className="mt-8">
          <ButtonLink href={pathFor("recovery", locale)} variant="outline">
            {h.galleryCta} <ArrowIcon width={16} height={16} />
          </ButtonLink>
        </div>
      </Section>

      <WhyUs dict={dict} />

      {/*
        Shown, not declared: the diving questions belong to the diving and
        beginner pages in structured data. Repeating the same FAQPage here
        would leave Google with three claims on one set of answers.
      */}
      <Faq dict={dict} locale={locale} declare={false} />

      <FinalCta
        dict={dict}
        kicker={h.finalKicker}
        title={h.finalTitle}
        body={h.finalBody}
        waMessage={recoveryPrefill(dict.wa)}
      />
    </>
  );
}
