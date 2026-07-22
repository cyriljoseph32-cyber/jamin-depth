"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { NAV, SITE, tel } from "@/content/site";
import { t } from "@/content/i18n";
import { buildWaLink, divingPrefill } from "@/lib/whatsapp";
import { MenuIcon, CloseIcon, WhatsAppIcon, PhoneIcon } from "@/components/ui/Icons";

/**
 * Accessible mobile menu: ESC to close, scroll lock.
 *
 * The overlay is rendered through a portal to document.body. This is essential:
 * the sticky header uses `backdrop-blur`, and an ancestor with backdrop-filter
 * becomes the containing block for `position: fixed` children — which would clamp
 * a `fixed inset-0` overlay to the header's height instead of the viewport, letting
 * the page bleed through. Portalling to <body> escapes that containing block.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const overlay = (
    <div
      id="mobile-menu"
      role="dialog"
      aria-modal="true"
      aria-label={t.nav.menu}
      className="fixed inset-0 z-[80] flex flex-col overflow-y-auto md:hidden"
      style={{ backgroundColor: "#05080d" }}
    >
      <div className="flex items-center justify-between px-5 py-4">
        <span className="mono-kicker">{SITE.name}</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.nav.close}
          className="inline-flex h-10 w-10 items-center justify-center text-foam"
        >
          <CloseIcon />
        </button>
      </div>

      <nav className="flex flex-1 flex-col justify-center gap-1 px-6" aria-label="Mobile">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className="border-b border-foam/10 py-5 font-display text-4xl uppercase text-foam transition-colors hover:text-signal"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3 px-6 pb-10">
        <a
          href={buildWaLink(divingPrefill())}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 bg-signal px-4 py-4 font-mono text-xs uppercase tracking-[0.14em] text-ink"
        >
          <WhatsAppIcon width={18} height={18} /> {t.nav.whatsapp}
        </a>
        <a
          href={tel}
          className="inline-flex items-center justify-center gap-2 border border-foam/30 px-4 py-4 font-mono text-xs uppercase tracking-[0.14em] text-foam"
        >
          <PhoneIcon width={18} height={18} /> {t.nav.call}
        </a>
      </div>
    </div>
  );

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t.nav.menu}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="inline-flex h-10 w-10 items-center justify-center text-foam"
      >
        <MenuIcon />
      </button>

      {open && mounted ? createPortal(overlay, document.body) : null}
    </div>
  );
}
