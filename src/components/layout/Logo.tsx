import { SITE } from "@/content/site";

/**
 * Original brand mark: a sonar ring with a descending drop — "locate + dive".
 * Paired with the condensed display wordmark.
 */
export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg
        width="30"
        height="30"
        viewBox="0 0 40 40"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.3" opacity="0.28" />
        <circle cx="20" cy="20" r="11.5" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
        <path
          d="M20 9c3.6 4.2 5.4 7.6 5.4 10.4A5.4 5.4 0 0 1 20 24.8a5.4 5.4 0 0 1-5.4-5.4c0-2.8 1.8-6.2 5.4-10.4Z"
          fill="var(--color-signal)"
        />
        <circle cx="20" cy="20" r="1.7" fill="var(--color-ink)" />
      </svg>
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
