/**
 * Brand asset pipeline — derives every logo file from the owner's master art.
 *
 *   npm run brand:logo
 *
 * The master (`assets/brand/logo-master.png`) is the owner's full-colour
 * drawing on cream paper: teal wave, gold JD monogram, red/gold/green compass,
 * a diver in green and yellow, and three pieces of dark navy lettering.
 *
 * **The illustration's colours are never changed.** They are deliberate, and
 * they read perfectly well against the site's near-black ground. Two things
 * only are done here:
 *
 *  1. The cream paper is keyed out to transparency, so the logo sits on any
 *     background instead of carrying a beige rectangle around with it.
 *  2. For the dark-background variant, the *lettering* — and nothing else — is
 *     lifted to foam. At #0b222d on #04121a the words are invisible; the wave,
 *     compass, monogram and diver are not, so they are left alone.
 *
 * Re-run after any change to the master. If the owner supplies a vector or a
 * ≥3000px export, drop it in as the master and re-run — nothing else changes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = join(ROOT, "assets/brand/logo-master.png");
const OUT = join(ROOT, "public/brand");

/* Must stay identical to the `@theme` block in globals.css. */
const TOKEN = {
  blueblack: "#04121a",
  abyss: "#07202a",
  foam: "#eff4f0",
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/* ------------------------------------------------------------------ *
 * Paper keying
 * ------------------------------------------------------------------ */

/**
 * Cream measures ≈ #fbfaf5. Anything at least this light *and* this close to
 * neutral is paper; the ramp below it keeps antialiased edges soft instead of
 * cutting them into a jagged outline.
 */
const PAPER_L = [0.86, 0.965];
const PAPER_NEUTRAL = 26;

/** 0 = paper, 1 = fully inked. */
function coverage(r, g, b) {
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  // A saturated pixel is never paper however light it is — the pale end of the
  // wave and the gold monogram both live up here.
  if (chroma > PAPER_NEUTRAL) return 1;
  return 1 - smoothstep(PAPER_L[0], PAPER_L[1], luma(r, g, b));
}

/* ------------------------------------------------------------------ *
 * Lettering
 * ------------------------------------------------------------------ */

/**
 * Colour alone nearly separates the words: lettering measures #0b222d (blue 34
 * above red, 11 above green, luma 0.11), against diver body #304540 (blue
 * *below* green), wave #25656b (luma 0.34) and compass red #872f2b. What it
 * does not separate is the dark outline stroke *inside* the illustration —
 * around the diver, through the wave — which is the same near-black blue.
 *
 * Geometry finishes the job, in two steps. The words occupy two clear bands —
 * JAMMIN'S ends at y 445, the diver's fins end at y 1082 and DEPTH starts at
 * 1085 — and within those bands everything that is not type still sits inside
 * the badge's circle, so a radius test clears the wave and the compass arrow
 * that reach up behind the arc.
 */
const LETTER_BANDS = { aboveY: 450, belowY: 1083 };
const LETTER_RADIUS = 340;

function isLettering(r, g, b, x, y) {
  if (y >= LETTER_BANDS.aboveY && y <= LETTER_BANDS.belowY) return false;
  const dx = x - BADGE.cx;
  const dy = y - BADGE.cy;
  if (dx * dx + dy * dy < LETTER_RADIUS * LETTER_RADIUS) return false;
  return luma(r, g, b) < 0.2 && b - r > 16 && b - g > 3;
}

/* ------------------------------------------------------------------ *
 * Geometry — measured from the master's ink profile
 * ------------------------------------------------------------------ */

/** Whole lockup: JAMMIN'S, badge, DEPTH, PLONGÉE SOUS-MARINE. */
const LOCKUP = { left: 16, top: 222, width: 720, height: 1030 };

/**
 * The badge alone, for sizes where the lettering would be illegible anyway —
 * the header mark and the favicon. Centre and radius come from the compass
 * points, the widest ink row (x 50–702 at y 700). A circular mask rather than a
 * rectangular crop, because the arc wordmark sits right on the circle and a
 * straight edge would slice through its letters.
 */
const BADGE = { cx: 376, cy: 700, size: 700 };

/* ------------------------------------------------------------------ *
 * Build
 * ------------------------------------------------------------------ */

/**
 * The circular badge mask cuts through the arc wordmark's lowest letter tips,
 * leaving a few disconnected specks inside the badge. The badge *is* the
 * drawing without the wordmark, so those are erased rather than kept: any
 * lettering-coloured pixel in the top band, out in the annulus where only type
 * lives, loses its alpha.
 */
function isStrayLetter(r, g, b, x, y) {
  if (y >= LETTER_BANDS.aboveY) return false;
  const dx = x - BADGE.cx;
  const dy = y - BADGE.cy;
  if (dx * dx + dy * dy < 295 * 295) return false;
  return luma(r, g, b) < 0.2 && b - r > 16 && b - g > 3;
}

/**
 * @param {"keep"|"lift"} lettering  `lift` recolours the words to foam for use
 *   on dark grounds; `keep` leaves the artwork exactly as drawn.
 * @param {string} [mono] collapse everything to this single colour.
 * @param {boolean} [dropStrayLetters] see `isStrayLetter` — badge only.
 */
async function render(lettering, mono, dropStrayLetters) {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const foam = rgb(TOKEN.foam);
  const inkFlat = mono ? rgb(mono) : null;

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const r = data[p];
    const g = data[p + 1];
    const b = data[p + 2];
    const x = i % width;
    const y = (i / width) | 0;
    let a = coverage(r, g, b);
    if (dropStrayLetters && isStrayLetter(r, g, b, x, y)) a = 0;

    let colour;
    if (inkFlat) colour = inkFlat;
    else if (lettering === "lift" && isLettering(r, g, b, x, y)) colour = foam;
    else colour = [r, g, b];

    const q = i * 4;
    out[q] = colour[0];
    out[q + 1] = colour[1];
    out[q + 2] = colour[2];
    out[q + 3] = Math.round(a * 255);
  }

  return sharp(out, { raw: { width, height, channels: 4 } });
}

/* ------------------------------------------------------------------ *
 * One-colour variants
 * ------------------------------------------------------------------ */

/**
 * These come from a different source file, and deliberately so.
 *
 * The colour art is built from filled shapes. Flattening it to one colour
 * collapses the diver, the wave and the JD monogram into a single silhouette —
 * the monogram disappears entirely. A one-colour logo has to be *drawn*, not
 * averaged down.
 *
 * The owner also supplied the same design as line art, and that is what a
 * single-colour reproduction wants: coverage keyed straight to alpha, so the
 * strokes stay strokes and the watercolour wash reads as a tint of the ink.
 */
const LINE_MASTER = join(ROOT, "assets/brand/logo-master-line.png");
const LINE_LOCKUP = { left: 8, top: 155, width: 531, height: 748 };
const LINE_PAPER_L = 0.965;
const LINE_INK_L = 0.09;

async function renderMono(hex) {
  const { data, info } = await sharp(LINE_MASTER)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const [r0, g0, b0] = rgb(hex);

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const a = clamp01(
      (LINE_PAPER_L - luma(data[p], data[p + 1], data[p + 2])) / (LINE_PAPER_L - LINE_INK_L),
    );
    const q = i * 4;
    out[q] = r0;
    out[q + 1] = g0;
    out[q + 2] = b0;
    out[q + 3] = Math.round(a * 255);
  }

  return sharp(out, { raw: { width, height, channels: 4 } });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const written = [];
  const png = { compressionLevel: 9, palette: true };

  const circleMask = Buffer.from(
    `<svg width="${BADGE.size}" height="${BADGE.size}">` +
      `<circle cx="${BADGE.size / 2}" cy="${BADGE.size / 2}" r="${BADGE.size / 2}" fill="#fff"/></svg>`,
  );
  const badgeCrop = {
    left: Math.round(BADGE.cx - BADGE.size / 2),
    top: Math.round(BADGE.cy - BADGE.size / 2),
    width: BADGE.size,
    height: BADGE.size,
  };

  const variants = [
    /* On white, cream or any light ground — flyers, letterhead, print. The
     * artwork exactly as drawn, just without its paper. */
    { name: "light", lettering: "keep" },
    /* On the site and anything else near-black. Only the words change. */
    { name: "dark", lettering: "lift" },
  ];

  for (const v of variants) {
    const base = await (await render(v.lettering)).png().toBuffer();
    const file = join(OUT, `logo-lockup-${v.name}.png`);
    await sharp(base).extract(LOCKUP).png(png).toFile(file);
    written.push(file);
  }

  /* One colour, for stamps, embroidery, engraving and mono print — from the
   * line-art master, for the reason given at `renderMono`. */
  for (const [name, hex] of [
    ["mono-ink", TOKEN.abyss],
    ["mono-foam", TOKEN.foam],
  ]) {
    const file = join(OUT, `logo-lockup-${name}.png`);
    await sharp(await (await renderMono(hex)).png().toBuffer())
      .extract(LINE_LOCKUP)
      .png(png)
      .toFile(file);
    written.push(file);
  }

  /* The badge carries no lettering, so it is the same drawing whatever the
   * background — one file, not one per variant. */
  const badge = await sharp(await (await render("keep", undefined, true)).png().toBuffer())
    .extract(badgeCrop)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png(png)
    .toBuffer();
  await writeFile(join(OUT, "logo-badge.png"), badge);
  written.push(join(OUT, "logo-badge.png"));

  /* Square icons. A favicon is composited against browser chrome that is not
   * ours to control, so these are opaque on the site background. */
  const inset = await sharp(badge)
    .resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();
  // sharp resizes before it composites, so build at full size then scale down.
  const icon512 = await sharp({
    create: { width: 512, height: 512, channels: 4, background: TOKEN.blueblack },
  })
    .composite([{ input: inset, gravity: "center" }])
    .png()
    .toBuffer();

  for (const [file, size] of [
    [join(ROOT, "src/app/icon.png"), 512],
    [join(ROOT, "src/app/apple-icon.png"), 180],
    // Same square at a stable URL: schema.org `logo` and any third-party
    // profile needs an opaque square it can fetch.
    [join(OUT, "logo-square.png"), 512],
  ]) {
    await sharp(icon512).resize(size, size).png(png).toFile(file);
    written.push(file);
  }

  /* Android home screens may crop a maskable icon to any shape inside the
   * square, guaranteeing only the centre 80% circle — so inset further. */
  const maskable = join(OUT, "icon-maskable.png");
  await sharp({ create: { width: 512, height: 512, channels: 4, background: TOKEN.blueblack } })
    .composite([{ input: await sharp(badge).resize(330, 330).toBuffer(), gravity: "center" }])
    .png(png)
    .toFile(maskable);
  written.push(maskable);

  /* A flat 1200×630 card for posts the owner composes by hand — Facebook
   * covers, event banners, press kits. The site's own share image is generated
   * per request by `src/app/opengraph-image.tsx`. */
  const cardLogo = await sharp(join(OUT, "logo-lockup-dark.png")).resize({ height: 470 }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: TOKEN.blueblack } })
    .composite([{ input: cardLogo, gravity: "center" }])
    .png(png)
    .toFile(join(OUT, "logo-card.png"));
  written.push(join(OUT, "logo-card.png"));

  console.log(written.map((f) => f.replace(`${ROOT}/`, "")).join("\n"));
}

await main();
