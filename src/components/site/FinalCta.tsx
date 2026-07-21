import { SITE, tel } from "@/content/site";
import { t } from "@/content/i18n";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";
import { SonarRings } from "@/components/visuals/SonarRings";
import { WhatsAppIcon, PhoneIcon } from "@/components/ui/Icons";
import { buildWaLink } from "@/lib/whatsapp";

/** Reusable end-of-page conversion block. */
export function FinalCta({
  kicker,
  title,
  body,
  waMessage,
}: {
  kicker: string;
  title: string;
  body: string;
  waMessage: string;
}) {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal className="relative overflow-hidden rounded-[var(--radius)] border border-signal/25 bg-abyss-2 px-6 py-14 text-center sm:px-16 sm:py-20">
          <SonarRings className="pointer-events-none absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 text-signal/[0.06]" />
          <div className="relative">
            <Kicker className="justify-center">{kicker}</Kicker>
            <h2 className="mx-auto mt-5 max-w-2xl text-balance font-display text-4xl sm:text-5xl md:text-6xl">
              {title}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-foam-dim">{body}</p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <ButtonLink href={buildWaLink(waMessage)} size="lg" variant="primary">
                <WhatsAppIcon width={18} height={18} />
                {t.nav.requestRecovery}
              </ButtonLink>
              <ButtonLink href={tel} size="lg" variant="outline">
                <PhoneIcon width={16} height={16} />
                {SITE.phoneInternationalDisplay}
              </ButtonLink>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
