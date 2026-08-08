import Image from "next/image";
import { SITE } from "@/content/site";

/**
 * Brand logo, in the two forms the artwork supports.
 *
 * `badge` is the circular device on its own — the arc wordmark sits directly on
 * that circle in the master art, so the badge is masked out of it rather than
 * cropped, and the surrounding type is set live beside it. This is the form
 * used wherever the logo renders small enough that its own lettering would be
 * illegible.
 *
 * `lockup` is the complete artwork, used where there is room to read it.
 *
 * Both are recoloured into the site palette by `scripts/build-logo.mjs`; the
 * linework is the owner's original, untouched.
 */
export function Logo({
  variant = "badge",
  compact = false,
}: {
  variant?: "badge" | "lockup";
  compact?: boolean;
}) {
  if (variant === "lockup") {
    return (
      <Image
        src="/brand/logo-lockup-dark.png"
        alt={SITE.name}
        width={531}
        height={748}
        sizes="176px"
        className="h-auto w-44"
      />
    );
  }

  return (
    <span className="flex items-center gap-2.5">
      <Image
        src="/brand/logo-badge-dark.png"
        /* The wordmark beside it already names the brand; without it the image
         * has to carry the accessible name for the link that wraps this. */
        alt={compact ? SITE.name : ""}
        width={516}
        height={516}
        sizes="40px"
        className="h-10 w-10 shrink-0"
        priority
      />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-lg font-semibold uppercase tracking-tight text-foam">
            {SITE.name}
          </span>
          <span className="block font-mono text-[0.55rem] uppercase tracking-[0.22em] text-foam-dim">
            {SITE.tagline}
          </span>
        </span>
      )}
    </span>
  );
}
