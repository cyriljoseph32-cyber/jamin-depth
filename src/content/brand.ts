/**
 * The handful of palette values that JavaScript needs.
 *
 * `src/app/globals.css` is the source of truth — its `@theme` block defines the
 * full system, and every component reads it through Tailwind. These constants
 * exist only for the places a CSS variable cannot reach:
 *
 *  - `manifest.ts`, which emits JSON
 *  - `viewport.themeColor`, which the browser reads before any CSS loads
 *  - `opengraph-image.tsx`, rendered by Satori, which does not resolve `var()`
 *
 * Keep them identical to `globals.css`. Nothing else should hardcode a colour.
 */
export const BRAND = {
  /** Page ground. */
  blueblack: "#04121a",
  /** Section surfaces — the navy of the logo's own lettering. */
  abyss: "#07202a",
  /** The wave. */
  petrol: "#25676a",
  foam: "#eff4f0",
  foamDim: "#a9bcbb",
  sand: "#cdb98f",
  sandDim: "#a89670",
  /** The logo's gold, lifted for legibility. */
  signal: "#d9a83f",
} as const;
