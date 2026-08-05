import Image from "next/image";
import { SonarRings } from "@/components/visuals/SonarRings";

/**
 * Media frame. With a `src` it renders a real photo (next/image, cover-cropped
 * to the slot's aspect ratio) under a subtle caption gradient. Without a `src`
 * it falls back to the premium labelled placeholder — so slots without a photo
 * yet still look intentional.
 *
 * Pass `ratio={null}` to drop the intrinsic aspect ratio and let the slot fill
 * whatever box it is placed in — used by the home gallery mosaic, where the grid
 * rows dictate the height instead.
 */
export function MediaSlot({
  label,
  ratio = "4 / 5",
  className = "",
  index,
  src,
  alt,
}: {
  label: string;
  ratio?: string | null;
  className?: string;
  index?: string;
  src?: string;
  alt?: string;
}) {
  return (
    <figure
      className={`group relative overflow-hidden rounded-[var(--radius)] border border-foam/10 bg-abyss-2 ${
        ratio ? "" : "h-full w-full"
      } ${className}`}
      style={ratio ? { aspectRatio: ratio } : undefined}
    >
      {src ? (
        <>
          <Image
            src={src}
            alt={alt ?? label}
            fill
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(to top, rgba(5,8,13,0.72), rgba(5,8,13,0) 48%)" }}
          />
        </>
      ) : (
        <>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(80% 60% at 30% 20%, color-mix(in srgb, var(--color-petrol) 45%, transparent), transparent 60%), linear-gradient(160deg, #0c1520, #05080d)",
            }}
          />
          <SonarRings className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 text-foam/15" />
        </>
      )}

      {index ? (
        <span className="absolute left-3 top-3 font-mono text-[0.62rem] tracking-[0.25em] text-foam/70 drop-shadow">
          {index}
        </span>
      ) : null}

      <figcaption className="absolute inset-x-3 bottom-3 flex items-center gap-2">
        <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-signal" />
        <span className="font-mono text-[0.6rem] leading-tight tracking-[0.14em] text-foam uppercase drop-shadow">
          {label}
        </span>
      </figcaption>
    </figure>
  );
}
