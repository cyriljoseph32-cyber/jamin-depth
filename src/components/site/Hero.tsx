import { t } from "@/content/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { SonarRings } from "@/components/visuals/SonarRings";
import { WhatsAppIcon, ArrowIcon, ArrowDownIcon } from "@/components/ui/Icons";
import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";

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

          <p className="mt-6 flex items-center gap-3 font-display text-2xl uppercase text-signal sm:text-3xl">
            <span aria-hidden className="h-px w-8 bg-signal" />
            {h.heroSlogan}
          </p>

          <p className="mt-7 max-w-xl text-pretty text-base text-foam-dim sm:text-lg">{h.heroLead}</p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <ButtonLink href={buildWaLink(recoveryPrefill())} size="lg" variant="primary">
              <WhatsAppIcon width={18} height={18} />
              {t.nav.requestRecovery}
            </ButtonLink>
            <ButtonLink href="/diving" size="lg" variant="outline">
              {t.nav.exploreDiving}
              <ArrowIcon width={16} height={16} />
            </ButtonLink>
          </div>

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
