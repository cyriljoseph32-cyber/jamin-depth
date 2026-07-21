import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";

/** Consistent interior-page hero. */
export function PageHeader({
  kicker,
  title,
  lead,
}: {
  kicker: string;
  title: string;
  lead: string;
}) {
  return (
    <section className="relative overflow-hidden pt-16 sm:pt-24">
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
        <Reveal>
          <Kicker>{kicker}</Kicker>
          <h1 className="mt-6 max-w-4xl text-balance font-display text-4xl leading-[0.98] sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-foam-dim">{lead}</p>
        </Reveal>
      </div>
    </section>
  );
}
