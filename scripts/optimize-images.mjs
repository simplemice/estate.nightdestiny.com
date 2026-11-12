#!/usr/bin/env node
// Generates responsive WebP variants into /assets/optimized for every image referenced by /content.
// Requires: npm install (sharp). Originals are never modified. Safe to re-run (skips up-to-date files).
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WIDTHS = [480, 800, 1280, 1920];
const IMG_RE = /^\/[^"]+\.(jpe?g|png|webp)$/i;

function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p); else if (e.name.endsWith('.json')) yield p;
  }
}
function* strings(v) {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* strings(x);
  else if (v && typeof v === 'object') for (const x of Object.values(v)) yield* strings(x);
}

const refs = new Set();
for (const f of walk(path.join(ROOT, 'content'))) for (const s of strings(JSON.parse(fs.readFileSync(f, 'utf8')))) if (IMG_RE.test(s)) refs.add(s);

let made = 0;
const dims = {};
for (const ref of refs) {
  const src = path.join(ROOT, ref);
  if (!fs.existsSync(src)) { console.warn('missing:', ref); continue; }
  const meta = await sharp(src).metadata();
  { const sw = (meta.orientation || 1) > 4; dims[ref] = [sw ? meta.height : meta.width, sw ? meta.width : meta.height]; }
  const base = '/assets/optimized/' + ref.slice(1).replace(/\.[a-z0-9]+$/i, '');
  const widths = WIDTHS.filter((w) => w <= meta.width);
  if (!widths.length || meta.width < WIDTHS[0]) widths.push(meta.width); // small source: one webp at native width
  for (const w of widths) {
    const out = path.join(ROOT, `${base}-${w}.webp`);
    if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) continue;
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await sharp(src).rotate().resize({ width: w, withoutEnlargement: true }).webp({ quality: 78 }).toFile(out);
    made++;
  }
}
fs.mkdirSync(path.join(ROOT, 'assets/optimized'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'assets/optimized/dims.json'), JSON.stringify(dims));
console.log(`Optimized ${refs.size} images, wrote ${made} files.`);
