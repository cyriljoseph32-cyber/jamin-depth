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
| `npm run brand:logo`| Re-generate the logo assets from the master art |
| `npm run media:import`| Import owner photos into `public/media/` |

## How the forms work

The recovery and contact forms are **fully client-side**. On submit they validate,
build a structured summary, and open **WhatsApp** (`wa.me`) pre-filled — with a
**`mailto:` email fallback**. No backend, no database, no API keys. Nothing is stored
by the site (see `/privacy`).

> A WhatsApp deep link can't carry a file, so the optional photo field previews the
> image locally and the success step asks you to attach it directly in the chat.

## Content & configuration

Copy lives in `src/content/fr.ts` and `src/content/en.ts`; `en.ts` defines the
`Dictionary` type both must satisfy. Verified brand facts (phone, socials,
location) live in `src/content/site.ts`.

### Brand assets

The logo is the owner's original artwork, recoloured into the site palette —
no line of it is redrawn. The master lives in `assets/brand/logo-master.png` and
every delivered file is generated from it by `npm run brand:logo`.
`assets/brand/README.md` says which file to use where, on the site and in print.

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

- **More authentic photos.** Three of the owner's own are now in place (Sail Rock, Chumphon Pinnacle, Tanote Bay); the remaining `MediaSlot`s still use placeholders. Import new ones with `npm run media:import <source> <name>` — it bakes in the EXIF rotation, which the image optimiser would otherwise drop.
- **About → Background block**: verified credentials/experience to confirm before publishing.
- **Email address** in `src/content/site.ts` (`SITE.email`) — confirm or replace the placeholder.
- Any **exact public location** if one should appear (currently only "Koh Samui, Thailand", no fake address).
- **A print-resolution logo** — the master supplied is 547×1024, fine for screen but only ~4.4 cm wide at 300 dpi. See `assets/brand/README.md`.
