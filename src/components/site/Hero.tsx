import Link from "next/link";
import { t } from "@/content/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { SonarRings } from "@/components/visuals/SonarRings";
import { WhatsAppIcon, ArrowIcon, ArrowDownIcon } from "@/components/ui/Icons";
import { buildWaLink, divingPrefill } from "@/lib/whatsapp";

export function Hero() {
  const h = t.home;
  return (
    <section className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden">
      {/* faint sonar sweep, decorative */}
      <SonarRings
        className="pointer-events-none absolute -right-24 top-1/2 hidden h-[36rem] w-[36rem] -translate-y-1/2 text-foam/[0.06] lg:block"
      />

      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="max-w-3xl">
          <Kicker>{h.heroKicker}</Kicker>

          <h1 className="mt-6 text-balance font-display text-5xl leading-[0.95] sm:text-6xl md:text-7xl">
            {h.heroTitle}
          </h1>

          <p className="mt-7 max-w-xl text-pretty text-base text-foam-dim sm:text-lg">{h.heroLead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/diving" size="lg" variant="primary">
              {t.nav.exploreDiving}
              <ArrowIcon width={16} height={16} />
            </ButtonLink>
            <ButtonLink href={buildWaLink(divingPrefill())} size="lg" variant="outline">
              <WhatsAppIcon width={18} height={18} />
              {t.nav.askDiving}
            </ButtonLink>
          </div>

          {/* Recovery stays one tap from the hero */}
          <p className="mt-6">
            <Link
              href="/recovery"
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
