import Link from "next/link";
import { NAV } from "@/content/site";
import { t } from "@/content/i18n";
import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";
import { Logo } from "./Logo";
import { MobileNav } from "./MobileNav";
import { WhatsAppIcon } from "@/components/ui/Icons";

/** Sticky, translucent header. Server component; only the menu is interactive. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-foam/10 bg-blueblack/70 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <Link href="/" aria-label={`${t.home.heroSlogan} — home`} className="transition-opacity hover:opacity-80">
          <Logo />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="font-mono text-xs uppercase tracking-[0.16em] text-foam-dim transition-colors hover:text-foam"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <a
            href={buildWaLink(recoveryPrefill())}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 bg-signal px-4 py-2.5 font-mono text-xs uppercase tracking-[0.14em] text-ink transition-colors hover:bg-signal-600 sm:inline-flex"
          >
            <WhatsAppIcon width={16} height={16} />
            {t.nav.requestRecovery}
          </a>
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
