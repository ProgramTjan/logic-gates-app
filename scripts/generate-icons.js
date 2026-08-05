/**
 * Generate PWA PNG icons from icons/icon.svg using sharp.
 * Run: node scripts/generate-icons.js
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const svgPath = path.join(root, "icons", "icon.svg");
const outDir = path.join(root, "icons");

async function writePng(size, filename, { maskable = false } = {}) {
  const svg = await readFile(svgPath);
  let pipeline = sharp(svg).resize(size, size, { fit: "contain", background: "#0d1117" });

  if (maskable) {
    // Safe zone: icon content stays in center ~80%; pad with theme background.
    const inner = Math.round(size * 0.8);
    const pad = Math.round((size - inner) / 2);
    const resized = await sharp(svg)
      .resize(inner, inner, { fit: "contain", background: "#0d1117" })
      .png()
      .toBuffer();
    pipeline = sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: "#0d1117",
      },
    }).composite([{ input: resized, left: pad, top: pad }]);
  }

  const outPath = path.join(outDir, filename);
  await pipeline.png().toFile(outPath);
  console.log(`Wrote ${path.relative(root, outPath)}`);
}

await mkdir(outDir, { recursive: true });
await writePng(192, "icon-192.png");
await writePng(512, "icon-512.png");
await writePng(512, "icon-512-maskable.png", { maskable: true });
await writePng(180, "apple-touch-icon.png");
console.log("Icons generated.");
