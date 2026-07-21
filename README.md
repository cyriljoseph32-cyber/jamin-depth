# Jammin's Depths

**Underwater Recovery & Diving — Koh Samui, Thailand**
_You drop it. We dive for it._

A premium, mobile-first marketing site for a Koh Samui underwater-recovery and diving
service. Cinematic dark-marine design, minimal JavaScript, zero backend, no secrets.

## Stack

- **Next.js 15** (App Router) · **React 19** · **TypeScript** (strict)
- **Tailwind CSS v4** — CSS-first design tokens
- Self-hosted fonts via `next/font`: Oswald (display), IBM Plex Sans (body), IBM Plex Mono (labels)
- Original CSS/SVG visuals (depth gradient, caustics, film grain, sonar rings) — no stock/AI photos
- Vitest (unit) + Playwright (smoke + visual)

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
```

## Scripts

| Script              | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `npm run dev`       | Local dev server                         |
| `npm run build`     | Production build                         |
| `npm run start`     | Serve the production build               |
| `npm run lint`      | ESLint (next/core-web-vitals)            |
| `npm run typecheck` | `tsc --noEmit`                           |
| `npm run test`      | Vitest unit tests                        |
| `npm run e2e`       | Playwright smoke + visual capture        |

## How the forms work

The recovery and contact forms are **fully client-side**. On submit they validate,
build a structured summary, and open **WhatsApp** (`wa.me`) pre-filled — with a
**`mailto:` email fallback**. No backend, no database, no API keys. Nothing is stored
by the site (see `/privacy`).

> A WhatsApp deep link can't carry a file, so the optional photo field previews the
> image locally and the success step asks you to attach it directly in the chat.

## Content & configuration

All copy lives in `src/content/en.ts` (i18n-ready — add `fr.ts` / `th.ts` later).
Verified brand facts (phone, socials, location) live in `src/content/site.ts`.

### Environment variables

None are required. Optionally set the canonical/OG base URL:

```
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

Falls back to `VERCEL_URL`, then `http://localhost:3000`.

## Deploy to Vercel

Zero-config — Vercel auto-detects Next.js.

```bash
npm i -g vercel
vercel        # preview
vercel --prod # production
```

Set `NEXT_PUBLIC_SITE_URL` to the final domain in the Vercel project settings once known.

## What needs the owner's real content

Every item below is already wired as a clearly-labelled, drop-in slot — nothing is faked:

- **Authentic photos / clips** for the `MediaSlot`s (home cards & gallery, diving, About portrait) — sourced from [@granola51](https://www.instagram.com/granola51/) / [Facebook](https://web.facebook.com/Underwatersamuirecovery/).
- **About → Background block**: verified credentials/experience to confirm before publishing.
- **Email address** in `src/content/site.ts` (`SITE.email`) — confirm or replace the placeholder.
- Any **exact public location** if one should appear (currently only "Koh Samui, Thailand", no fake address).
