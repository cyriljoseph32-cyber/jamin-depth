import Link from "next/link";
import Image from "next/image";
import type { Locale, Dictionary } from "@/content/i18n";
import { pathFor } from "@/content/routes";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { SonarRings } from "@/components/visuals/SonarRings";
import { WhatsAppIcon, ArrowIcon, ArrowDownIcon } from "@/components/ui/Icons";
import { buildWaLink, divingPrefill } from "@/lib/whatsapp";
import { trackable } from "@/lib/analytics";

export function Hero({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const h = dict.home;
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
      {/* Full-bleed photographic hero. Decorative — the headline carries the meaning. */}
      <Image
        src="/brand/diver-bg.jpg"
        alt=""
        aria-hidden
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_30%]"
      />
      {/*
        Scrim keeps the headline legible over the photo: bottom-up on narrow screens where the
        crop sits behind the text, diagonal on wide ones so the diver stays visible at right.
      */}
      <div
        aria-hidden
        className="absolute inset-0 bg-[linear-gradient(to_top,rgba(5,8,13,0.9),rgba(5,8,13,0.35))] sm:bg-[linear-gradient(100deg,rgba(5,8,13,0.92)_30%,rgba(5,8,13,0.55)_65%,rgba(5,8,13,0.25)_100%)]"
      />

      {/* faint sonar sweep, decorative */}
      <SonarRings
        className="pointer-events-none absolute -right-24 top-1/2 hidden h-[36rem] w-[36rem] -translate-y-1/2 text-foam/[0.06] lg:block"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <Kicker>{h.heroKicker}</Kicker>

          <h1 className="mt-6 text-balance font-display text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
            {h.heroTitle}
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-base text-foam-dim sm:text-lg">{h.heroLead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={pathFor("diving", locale)} size="lg" variant="primary">
              {dict.nav.exploreDiving}
              <ArrowIcon width={16} height={16} />
            </ButtonLink>
            <ButtonLink
              href={buildWaLink(divingPrefill(dict.wa))}
              size="lg"
              variant="outline"
              {...trackable("whatsapp_click_hero", { locale })}
            >
              <WhatsAppIcon width={18} height={18} />
              {dict.nav.askDiving}
            </ButtonLink>
          </div>

          {/* Recovery stays one tap from the hero */}
          <p className="mt-6">
            <Link
              href={pathFor("recovery", locale)}
              className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.14em] text-foam-dim underline underline-offset-4 transition-colors hover:text-signal"
            >
              {h.recoveryLink}
              <ArrowIcon width={14} height={14} />
            </Link>
          </p>

          <ul className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3">
            {h.badges.map((b) => (
              <li key={b} className="flex items-center gap-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-sand">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-signal" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <span
        aria-hidden
        className="float-slow absolute bottom-6 left-1/2 hidden -translate-x-1/2 text-foam/30 sm:block"
      >
        <ArrowDownIcon width={22} height={22} />
      </span>
    </section>
  );
}
