import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale, isLocale } from "@/content/i18n";

/**
 * Locale routing.
 *
 * Every page lives under `/fr/…` or `/en/…`. A request without a locale prefix
 * is redirected to the visitor's best match: their `Accept-Language` header if
 * we speak it, otherwise French (the business targets francophone visitors
 * first). Static assets, API routes and metadata files are left alone.
 */

/** Paths served as-is — never locale-prefixed. */
const PASSTHROUGH = [
  "/api",
  "/_next",
  "/brand",
  "/media",
  "/favicon.ico",
  "/icon.svg",
  "/apple-icon",
  "/opengraph-image",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
];

/** First locale we support from the browser's ranked preferences. */
function preferredLocale(header: string | null) {
  if (!header) return defaultLocale;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    const base = tag.split("-")[0] ?? "";
    if (isLocale(base)) return base;
  }
  return defaultLocale;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PASSTHROUGH.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const first = pathname.split("/")[1] ?? "";
  if (isLocale(first)) return NextResponse.next();

  const locale = preferredLocale(req.headers.get("accept-language"));
  const url = req.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip anything with a file extension, plus Next internals.
  matcher: ["/((?!_next|.*\\..*).*)"],
};

export { locales };
