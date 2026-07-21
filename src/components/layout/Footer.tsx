import Link from "next/link";
import { NAV, SITE, FOOTER_LEGAL, tel } from "@/content/site";
import { t } from "@/content/i18n";
import { buildWaLink, recoveryPrefill } from "@/lib/whatsapp";
import { Logo } from "./Logo";
import { WhatsAppIcon, InstagramIcon, FacebookIcon, PhoneIcon } from "@/components/ui/Icons";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="relative border-t border-foam/10 bg-blueblack">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-5 max-w-xs text-sm text-foam-dim">{t.footer.blurb}</p>
          <p className="mt-5 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-sand-dim">
            {SITE.location}
          </p>
        </div>

        <nav aria-label="Footer" className="text-sm">
          <p className="mono-kicker mb-4">Explore</p>
          <ul className="space-y-3">
            <li>
              <Link href="/" className="text-foam-dim transition-colors hover:text-foam">
                Home
              </Link>
            </li>
            {NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="text-foam-dim transition-colors hover:text-foam">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm">
          <p className="mono-kicker mb-4">Direct</p>
          <ul className="space-y-3">
            <li>
              <a
                href={buildWaLink(recoveryPrefill())}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-foam-dim transition-colors hover:text-signal"
              >
                <WhatsAppIcon width={16} height={16} /> {SITE.phoneInternationalDisplay}
              </a>
            </li>
            <li>
              <a href={tel} className="inline-flex items-center gap-2 text-foam-dim transition-colors hover:text-foam">
                <PhoneIcon width={16} height={16} /> {SITE.phoneDisplay}
              </a>
            </li>
            <li className="flex items-center gap-4 pt-2">
              <a
                href={SITE.social.instagram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-foam-dim transition-colors hover:text-foam"
              >
                <InstagramIcon />
              </a>
              <a
                href={SITE.social.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-foam-dim transition-colors hover:text-foam"
              >
                <FacebookIcon />
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-foam/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-sand-dim sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p>
            © {year} {SITE.legalName}. {t.footer.rights}
          </p>
          <nav aria-label="Legal" className="flex items-center gap-5 font-mono uppercase tracking-[0.14em]">
            {FOOTER_LEGAL.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-foam">
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
