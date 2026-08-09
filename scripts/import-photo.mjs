/**
 * Import owner photographs into `public/media/`.
 *
 *   node scripts/import-photo.mjs <source.jpg> <name> [<source> <name> …]
 *
 * Three things happen to every file, and the first is the reason this script
 * exists at all:
 *
 *  1. **The EXIF rotation is baked into the pixels.** The owner's camera stores
 *     portrait shots as landscape pixels plus an `orientation` tag. Browsers
 *     honour that tag, so the photo looks right locally — but Next's image
 *     optimiser re-encodes through sharp, which neither applies the rotation nor
 *     keeps the tag, so the deployed photo comes out on its side. `.rotate()`
 *     with no argument applies the tag and then clears it, which makes the file
 *     upright no matter what reads it afterwards.
 *  2. It is resized. Sources are ~36 megapixels; the largest slot on the site
 *     renders around 700px wide, so 1200px covers a 2× display with room over.
 *  3. Metadata is stripped. These files go public — no camera serial, no GPS.
 */
import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public/media");

/** Long enough for the biggest slot at 2×; small enough to stay a web image. */
const TARGET_WIDTH = 1200;
const QUALITY = 82;

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.length % 2 !== 0) {
    console.error("usage: node scripts/import-photo.mjs <source> <name> [<source> <name> …]");
    process.exitCode = 1;
    return;
  }

  for (let i = 0; i < args.length; i += 2) {
    const source = args[i];
    const name = args[i + 1];
    const target = join(OUT, `${name}.jpg`);

    const before = await sharp(source).metadata();

    await sharp(source)
      // No argument: use the file's own EXIF orientation, then drop it.
      .rotate()
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, mozjpeg: true })
      .toFile(target);

    const after = await sharp(target).metadata();
    const rotated = before.orientation && before.orientation > 1;
    console.log(
      `${name}.jpg  ${before.width}×${before.height}` +
        (rotated ? ` (orientation ${before.orientation})` : "") +
        `  →  ${after.width}×${after.height}` +
        (after.orientation ? `  ⚠ orientation ${after.orientation} survived` : ""),
    );
  }

  const files = (await readdir(OUT)).filter((f) => f.endsWith(".jpg"));
  console.log(`\npublic/media now holds ${files.length} photos.`);
}

await main();
