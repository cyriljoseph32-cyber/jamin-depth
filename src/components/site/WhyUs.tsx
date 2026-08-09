import type { Dictionary } from "@/content/i18n";
import { Section } from "@/components/ui/Section";
import { Kicker } from "@/components/ui/Kicker";
import { Reveal } from "@/components/ui/Reveal";

/**
 * "Why dive with us".
 *
 * Every item is traceable to a verified fact (see the note above `why` in
 * en.ts). Deliberately no numbers-for-their-own-sake, no badges, no ratings —
 * none of those exist for this business.
 */
export function WhyUs({ dict }: { dict: Dictionary }) {
  const w = dict.why;
  return (
    <Section className="hairline-top">
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal>
          <Kicker>{w.kicker}</Kicker>
          <h2 className="mt-5 text-balance text-4xl sm:text-5xl">{w.title}</h2>
          <p className="mt-5 max-w-sm text-pretty text-foam-dim">{w.lead}</p>
        </Reveal>

        <ul className="grid gap-px bg-foam/10 sm:grid-cols-2">
          {w.items.map((item, i) => (
            <Reveal key={item.title} delay={i * 70} as="li" className="bg-blueblack p-7">
              <span className="font-mono text-xs tracking-[0.2em] text-signal">0{i + 1}</span>
              <h3 className="mt-4 text-2xl text-foam">{item.title}</h3>
              <p className="mt-3 text-sm text-foam-dim">{item.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </Section>
  );
}
