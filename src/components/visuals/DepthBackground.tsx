import Image from "next/image";
import { Caustics } from "./Caustics";

/**
 * Fixed, cinematic site background: the diver artwork under a strong dark scrim
 * so it reads as atmosphere while keeping all foreground text readable. Sits
 * behind every page. The scrim deepens toward the bottom where dense content sits.
 */
export function DepthBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-blueblack">
      <Image
        src="/brand/diver-bg.jpg"
        alt=""
        fill
        sizes="100vw"
        priority
        className="object-cover object-center"
      />

      {/* Readability scrim — darker toward the bottom */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg," +
            " color-mix(in srgb, var(--color-blueblack) 66%, transparent) 0%," +
            " color-mix(in srgb, var(--color-blueblack) 80%, transparent) 42%," +
            " color-mix(in srgb, var(--color-blueblack) 93%, transparent) 100%)",
        }}
      />

      {/* Petrol depth glow at the top */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--color-petrol) 28%, transparent) 0%, transparent 55%)",
        }}
      />

      {/* Center vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 42%, transparent 34%," +
            " color-mix(in srgb, var(--color-blueblack) 60%, transparent) 100%)",
        }}
      />

      <Caustics />
    </div>
  );
}
