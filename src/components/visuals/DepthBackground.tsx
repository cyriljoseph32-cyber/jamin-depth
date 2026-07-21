import { Caustics } from "./Caustics";

/**
 * Fixed, cinematic depth background. Pure CSS/SVG — no images, no external
 * requests, negligible JS. Sits behind all content.
 */
export function DepthBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 depth-bg">
      <Caustics />
      {/* Deep vignette to pull focus to the centre */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 40%, rgba(3,5,10,0.55) 100%)",
        }}
      />
    </div>
  );
}
