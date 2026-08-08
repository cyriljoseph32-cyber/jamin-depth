import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { BRAND } from "@/content/brand";

/**
 * The palette is derived from the logo, so its values are chosen by the artwork
 * rather than by what happens to be readable. These tests hold the line: every
 * pair a visitor actually reads must clear WCAG AA, and the constants JS needs
 * must not drift from the stylesheet that defines them.
 */

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

const TOKENS: Record<string, string> = Object.fromEntries(
  [...css.matchAll(/--color-([a-z0-9-]+):\s*(#[0-9a-f]{6})/g)].map((m) => [m[1] ?? "", m[2] ?? ""]),
);

function token(name: string): string {
  const value = TOKENS[name];
  if (!value) throw new Error(`--color-${name} is not defined in globals.css`);
  return value;
}

/** WCAG relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  const [r = 0, g = 0, b = 0] = channels;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

/** Foreground, background, and what the pair is for. */
const READABLE_PAIRS: [string, string, string][] = [
  ["foam", "blueblack", "body text on the page"],
  ["foam", "abyss", "body text on a section surface"],
  ["foam", "abyss-2", "body text on a card"],
  ["foam-dim", "blueblack", "secondary text"],
  ["foam-dim", "abyss-2", "secondary text on a card"],
  ["sand", "blueblack", "mono label"],
  ["sand-dim", "blueblack", "dim mono label"],
  ["sand-dim", "abyss-2", "dim mono label on a card"],
  ["signal", "blueblack", "accent used as text"],
  ["signal", "abyss-2", "accent text on a card"],
  ["ink", "signal", "dark text on a CTA"],
  ["ink", "signal-600", "dark text on a hovered CTA"],
  ["error", "blueblack", "validation message"],
  ["error", "abyss-2", "validation message on a card"],
  ["success", "blueblack", "success message"],
  ["success", "abyss-2", "success message on a card"],
];

describe("palette contrast", () => {
  it.each(READABLE_PAIRS)("%s on %s clears AA (%s)", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("brand constants", () => {
  /**
   * `BRAND` exists only for the manifest, the theme colour and the Satori-
   * rendered share card, none of which can resolve a CSS variable. It is a copy,
   * so it can rot; this is what stops it.
   */
  const MIRRORED: [keyof typeof BRAND, string][] = [
    ["blueblack", "blueblack"],
    ["abyss", "abyss"],
    ["petrol", "petrol"],
    ["foam", "foam"],
    ["foamDim", "foam-dim"],
    ["sand", "sand"],
    ["sandDim", "sand-dim"],
    ["signal", "signal"],
  ];

  it.each(MIRRORED)("BRAND.%s matches --color-%s", (key, name) => {
    expect(BRAND[key]).toBe(token(name));
  });
});
