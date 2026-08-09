import Link from "next/link";
import type { Locale, Dictionary } from "@/content/i18n";
import { NAV_KEYS, pathFor } from "@/content/routes";
import { buildWaLink, divingPrefill } from "@/lib/whatsapp";
import { trackable } from "@/lib/analytics";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { WhatsAppIcon } from "@/components/ui/Icons";

/** Sticky, translucent header. Server component; only the menu is interactive. */
export function Header({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  return (
    <header className="sticky top-0 z-50 border-b border-foam/10 bg-blueblack/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link
          href={pathFor("home", locale)}
          aria-label={`${dict.home.heroSlogan} — ${dict.nav.pages.home}`}
          className="transition-opacity hover:opacity-80"
        >
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV_KEYS.map((key) => (
            <Link
              key={key}
              href={pathFor(key, locale)}
              className="font-mono text-xs uppercase tracking-[0.16em] text-foam-dim transition-colors hover:text-foam"
            >
              {dict.nav.pages[key]}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher dict={dict} locale={locale} />
          <a
            href={buildWaLink(divingPrefill(dict.wa))}
            target="_blank"
            rel="noopener noreferrer"
            {...trackable("whatsapp_click_nav", { locale })}
            className="hidden items-center gap-2 bg-signal px-4 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:bg-signal-600 sm:inline-flex"
          >
            <WhatsAppIcon width={16} height={16} />
            {dict.nav.askDiving}
          </a>
          <MobileNav dict={dict} locale={locale} />
        </div>
      </div>
    </header>
  );
}
