/**
 * Brand asset pipeline — recolours the master logo art into the site palette.
 *
 *   node scripts/build-logo.mjs
 *
 * The master (`assets/brand/logo-master.png`) is dark navy ink on cream paper
 * with a blue watercolour wash behind the wave. Every stroke of that artwork is
 * preserved verbatim: this script never redraws anything, it only re-maps
 * colour. The method is a coverage key —
 *
 *   coverage = (paper luminance − pixel luminance) / (paper − ink luminance)
 *
 * — so a solid stroke keys to 1, bare paper to 0, and an antialiased edge or a
 * translucent wash lands in between. Coverage becomes the alpha channel, which
 * is why the outputs sit on transparency and why the linework stays exactly as
 * crisp as the original.
 *
 * Two tones are separated by how opaque the coverage is, not by hue: the pen
 * lines are near-solid, the watercolour wash is not. `lineness` smoothsteps
 * between them so there is no seam where a stroke crosses the wash.
 *
 * Re-run this whenever the master art changes. If the owner supplies a vector
 * or a ≥3000px export, drop it in as the master and re-run — nothing else needs
 * to change.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MASTER = join(ROOT, "assets/brand/logo-master.png");
const OUT = join(ROOT, "public/brand");

/* Palette — these must stay identical to the `@theme` block in globals.css. */
const TOKEN = {
  blueblack: "#05080d",
  abyss: "#0a1119",
  petrol: "#124c5a",
  foam: "#f2f5f4",
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const luma = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Cubic smoothstep — soft transition between the wash tone and the line tone. */
function smoothstep(edge0, edge1, x) {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

/* Measured off the master: cream paper ≈ #faf9f4, pen ink ≈ #07202a. */
const L_PAPER = 0.965;
const L_INK = 0.09;

/**
 * Below this coverage a pixel is treated as watercolour wash, above it as pen
 * line. The wash measures ~0.35–0.6, the strokes ~0.9+, so the band sits in the
 * empty gap between the two populations.
 */
const WASH_EDGE = [0.6, 0.86];

/** Extra opacity applied to wash pixels only — see the note at its use site. */
const WASH_GAIN = 1.4;

/**
 * @param {{line: string, wash: string, name: string}} variant
 */
async function recolour({ line, wash, name }) {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const lineRgb = rgb(line);
  const washRgb = rgb(wash);

  const out = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const p = i * channels;
    const coverage = clamp01((L_PAPER - luma(data[p], data[p + 1], data[p + 2])) / (L_PAPER - L_INK));
    const lineness = smoothstep(WASH_EDGE[0], WASH_EDGE[1], coverage);
    const [r, g, b] = mix(washRgb, lineRgb, lineness);
    // A flat tint loses chroma as it thins, so the wash is given a little extra
    // density to read as water rather than smoke. Linework is untouched: the
    // gain fades to 1 exactly where `lineness` reaches 1.
    const alpha = clamp01(coverage * (1 + (WASH_GAIN - 1) * (1 - lineness)));
    const q = i * 4;
    out[q] = r;
    out[q + 1] = g;
    out[q + 2] = b;
    out[q + 3] = Math.round(alpha * 255);
  }

  return { name, image: sharp(out, { raw: { width, height, channels: 4 } }) };
}

/** Full lockup: arc wordmark, badge, DEPTH, PLONGÉE SOUS-MARINE. */
const LOCKUP = { left: 8, top: 155, width: 531, height: 748 };

/**
 * The badge alone, for sizes where the lockup's type would be illegible — the
 * header mark and the favicon.
 *
 * The arc wordmark sits directly on the badge's circle, so no rectangular crop
 * separates them without slicing letters. A circular mask does: these bounds
 * are the badge's own circle, measured from the compass points (widest ink row
 * spans x 22–525 at y 515), so the mask edge falls between the circle and the
 * type instead of through it.
 */
const BADGE = { left: 15, top: 276, size: 516 };

async function main() {
  await mkdir(OUT, { recursive: true });

  const variants = [
    /* On the dark site. The tonal order of the original is preserved relative
     * to the ground: linework lightest, wash mid, background darkest. The wash
     * is petrol lifted toward foam so it stays legible on near-black. */
    { name: "dark", line: TOKEN.foam, wash: "#4f93a6" },
    /* On white or cream — flyers, letterhead, print, light email clients. */
    { name: "light", line: TOKEN.abyss, wash: "#125c72" },
    /* One-colour, for stamps, embroidery, engraving, fax-grade reproduction.
     * Coverage alone carries the wash, which renders as a tint of the ink. */
    { name: "mono-foam", line: TOKEN.foam, wash: TOKEN.foam },
    { name: "mono-ink", line: TOKEN.abyss, wash: TOKEN.abyss },
  ];

  const circleMask = Buffer.from(
    `<svg width="${BADGE.size}" height="${BADGE.size}">` +
      `<circle cx="${BADGE.size / 2}" cy="${BADGE.size / 2}" r="${BADGE.size / 2}" fill="#fff"/></svg>`,
  );

  const written = [];
  const badges = {};

  for (const variant of variants) {
    const { image } = await recolour(variant);
    const base = await image.png().toBuffer();

    const lockup = join(OUT, `logo-lockup-${variant.name}.png`);
    await sharp(base).extract(LOCKUP).png({ compressionLevel: 9, palette: true }).toFile(lockup);
    written.push(lockup);

    // The mono variants exist for one-colour reproduction of the whole lockup;
    // the badge is only ever used in the two full-colour treatments.
    if (variant.name.startsWith("mono")) continue;

    const badge = await sharp(base)
      .extract({ left: BADGE.left, top: BADGE.top, width: BADGE.size, height: BADGE.size })
      .composite([{ input: circleMask, blend: "dest-in" }])
      .png({ compressionLevel: 9, palette: true })
      .toBuffer();
    badges[variant.name] = badge;

    const badgeFile = join(OUT, `logo-badge-${variant.name}.png`);
    await writeFile(badgeFile, badge);
    written.push(badgeFile);
  }

  /* Square app icon — the badge on the site background, since a favicon is
   * composited against browser chrome that is not ours to control. */
  const emblemDark = await sharp(badges.dark)
    .resize(432, 432, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // sharp resizes before it composites, so the icon is built at full size and
  // only then scaled down — otherwise the emblem overflows the smaller canvas.
  const icon512 = await sharp({
    create: { width: 512, height: 512, channels: 4, background: TOKEN.blueblack },
  })
    .composite([{ input: emblemDark, gravity: "center" }])
    .png()
    .toBuffer();

  for (const [file, size] of [
    [join(ROOT, "src/app/icon.png"), 512],
    [join(ROOT, "src/app/apple-icon.png"), 180],
    // Same square, but addressable by a stable URL: schema.org `logo` and any
    // third-party profile (Google Business, Facebook, WhatsApp Business) needs
    // an opaque square it can fetch, not a transparent PNG on unknown chrome.
    [join(OUT, "logo-square.png"), 512],
  ]) {
    await sharp(icon512).resize(size, size).png({ compressionLevel: 9, palette: true }).toFile(file);
    written.push(file);
  }

  /* Maskable icon for Android home screens. The platform may crop to any shape
   * inside the square, guaranteeing only the centre 80% circle, so the badge is
   * inset well past that instead of filling the canvas like the plain icon. */
  const maskable = join(OUT, "icon-maskable.png");
  await sharp({ create: { width: 512, height: 512, channels: 4, background: TOKEN.blueblack } })
    .composite([{ input: await sharp(badges.dark).resize(330, 330).toBuffer(), gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(maskable);
  written.push(maskable);

  /* A 1200×630 brand card. The site's own share image is generated per-request
   * by `src/app/opengraph-image.tsx`; this is the flat version, for the places
   * the owner posts by hand — Facebook covers, event banners, press kits. */
  const cardLockup = await sharp(join(OUT, "logo-lockup-dark.png")).resize({ height: 470 }).toBuffer();
  await sharp({ create: { width: 1200, height: 630, channels: 4, background: TOKEN.blueblack } })
    .composite([{ input: cardLockup, gravity: "center" }])
    .png({ compressionLevel: 9, palette: true })
    .toFile(join(OUT, "logo-card.png"));
  written.push(join(OUT, "logo-card.png"));

  console.log(written.map((f) => f.replace(`${ROOT}/`, "")).join("\n"));
}

await main();
