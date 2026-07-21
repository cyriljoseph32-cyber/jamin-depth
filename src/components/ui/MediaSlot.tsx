import { SonarRings } from "@/components/visuals/SonarRings";

/**
 * Premium, clearly-labelled placeholder for authentic media.
 * Designed to look intentional (not broken) and to be swapped 1:1 with a
 * <next/image> once the owner provides real photos/clips. Every slot states,
 * in mono microtype, exactly what real content belongs there.
 */
export function MediaSlot({
  label,
  ratio = "4 / 5",
  className = "",
  index,
}: {
  label: string;
  ratio?: string;
  className?: string;
  index?: string;
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[var(--radius)] border border-foam/10 bg-abyss-2 ${className}`}
      style={{ aspectRatio: ratio }}
    >
      {/* textured depth fill */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 60% at 30% 20%, color-mix(in srgb, var(--color-petrol) 45%, transparent), transparent 60%), linear-gradient(160deg, #0c1520, #05080d)",
        }}
      />
      <SonarRings
        className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-foam/15"
      />
      {index ? (
        <span className="absolute left-3 top-3 font-mono text-[0.62rem] tracking-[0.25em] text-foam/35">
          {index}
        </span>
      ) : null}
      <figcaption className="absolute inset-x-3 bottom-3 flex items-center gap-2">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
        <span className="font-mono text-[0.6rem] leading-tight tracking-[0.14em] text-foam-dim uppercase">
          {label}
        </span>
      </figcaption>
    </figure>
  );
}
