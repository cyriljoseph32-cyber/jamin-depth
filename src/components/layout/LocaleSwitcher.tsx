"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { locales, isLocale, type Locale, type Dictionary } from "@/content/i18n";
import { pathFor, pageKeyFromSlug, type PageKey } from "@/content/routes";

/**
 * Language switcher.
 *
 * Points each locale at the *equivalent* page rather than the home page, so
 * switching language never loses the visitor's place — `/fr/plongee` maps to
 * `/en/diving`, not `/en`. The current path is the only input needed, which is
 * why this reads `usePathname()` instead of taking a page key as a prop: the
 * header lives in the layout and doesn't know which page is rendering.
 */
export function LocaleSwitcher({
  dict,
  locale,
  className = "",
  onNavigate,
}: {
  dict: Dictionary;
  locale: Locale;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  const segments = pathname.split("/");
  const first = segments[1] ?? "";
  const second = segments[2] ?? "";
  const currentKey: PageKey =
    isLocale(first) && second ? (pageKeyFromSlug(first, second) ?? "home") : "home";

  return (
    <nav
      aria-label={dict.nav.languageLabel}
      className={`flex items-center gap-1.5 font-mono text-[0.68rem] uppercase tracking-[0.14em] ${className}`}
    >
      {locales.map((l, i) => (
        <span key={l} className="flex items-center gap-1.5">
          {i > 0 ? (
            <span aria-hidden className="text-foam/25">
              /
            </span>
          ) : null}
          {l === locale ? (
            <span aria-current="true" className="text-signal">
              {l.toUpperCase()}
            </span>
          ) : (
            <Link
              href={pathFor(currentKey, l)}
              hrefLang={l}
              lang={l}
              onClick={onNavigate}
              aria-label={dict.nav.languageNames[l]}
              className="text-foam-dim transition-colors hover:text-foam"
            >
              {l.toUpperCase()}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
