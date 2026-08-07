import { getDictionary, defaultLocale } from "@/content/i18n";
import { pathFor } from "@/content/routes";
import { ButtonLink } from "@/components/ui/Button";
import { Kicker } from "@/components/ui/Kicker";
import { SonarRings } from "@/components/visuals/SonarRings";
import { ArrowIcon } from "@/components/ui/Icons";

/**
 * Localised 404. `not-found.tsx` can't read route params, so it falls back to
 * the default locale — which is also where middleware sends anyone arriving
 * without a locale prefix.
 */
export default function NotFound() {
  const locale = defaultLocale;
  const n = getDictionary(locale).notFound;
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden">
      <SonarRings className="pointer-events-none absolute left-1/2 top-1/2 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 text-foam/[0.06]" />
      <div className="mx-auto w-full max-w-3xl px-5 text-center sm:px-8">
        <Kicker className="justify-center">{n.kicker}</Kicker>
        <h1 className="mt-6 text-balance font-display text-5xl sm:text-7xl">{n.title}</h1>
        <p className="mx-auto mt-5 max-w-md text-pretty text-foam-dim">{n.body}</p>
        <div className="mt-9 flex justify-center">
          <ButtonLink href={pathFor("home", locale)} size="lg" variant="primary">
            {n.cta}
            <ArrowIcon width={16} height={16} />
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
