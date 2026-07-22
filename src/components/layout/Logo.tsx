import Image from "next/image";
import { SITE } from "@/content/site";

/**
 * Brand logo: the owner's manta-ray badge (circular crop) + the wordmark.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-1 ring-foam/15">
        <Image
          src="/brand/logo.jpg"
          alt={`${SITE.name} logo`}
          fill
          sizes="36px"
          className="object-cover object-center"
          priority
        />
      </span>
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
