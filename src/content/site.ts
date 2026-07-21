/**
 * Single source of truth for verified, public brand facts.
 * NOTHING here is invented — every value comes from the client brief.
 * Update these constants (not scattered strings) if the business details change.
 */

export const SITE = {
  name: "Jammin's Depths",
  legalName: "Jammin's Depths",
  tagline: "Underwater Recovery & Diving",
  slogan: "You drop it. We dive for it.",
  location: "Koh Samui, Thailand",
  /** Only a public area is claimed — no exact address or map pin (none verified). */
  areaServed: ["Koh Samui", "Surat Thani", "Thailand"],
  /** Human-readable phone in local format. */
  phoneDisplay: "063 375 3316",
  phoneInternationalDisplay: "+66 63 375 3316",
  /** E.164 for tel: and wa.me (no +, no spaces). */
  phoneE164: "66633753316",
  /** Contact email fallback for the mailto: path. Owner should confirm/replace. */
  email: "contact@jamminsdepths.com",
  social: {
    instagram: "https://www.instagram.com/granola51/",
    instagramHandle: "@granola51",
    facebook: "https://web.facebook.com/Underwatersamuirecovery/",
  },
} as const;

export const NAV: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/recovery", label: "Recovery" },
  { href: "/diving", label: "Diving" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export const FOOTER_LEGAL: ReadonlyArray<{ href: string; label: string }> = [
  { href: "/privacy", label: "Privacy" },
  { href: "/contact", label: "Contact" },
];

/** Absolute site URL used for canonical links, sitemap and Open Graph. */
export function siteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

export const tel = `tel:+${SITE.phoneE164}` as const;
