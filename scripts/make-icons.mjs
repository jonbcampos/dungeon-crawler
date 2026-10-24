/**
 * Generates the PWA icons.
 *
 * Written as a script rather than committing PNGs by hand so the icon stays
 * editable: it's drawn from the same palette as the game, so when the art
 * direction changes (generated art is planned — see ART-PLAN.md), you change these numbers
 * and re-run instead of trying to hand-edit a binary.
 *
 *   node scripts/make-icons.mjs
 *
 * No dependencies — it rasterises into an RGBA buffer and writes the PNG with
 * Node's built-in zlib.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');

// ---------------------------------------------------------------- raster ---

class Raster {
  constructor(size) {
    this.size = size;
    this.data = new Uint8Array(size * size * 4);
  }

  /** Source-over blend of a solid colour, so translucent glow layers stack. */
  fillRect(x, y, w, h, [r, g, b], a = 1) {
    const x0 = Math.max(0, Math.round(x));
    const y0 = Math.max(0, Math.round(y));
    const x1 = Math.min(this.size, Math.round(x + w));
    const y1 = Math.min(this.size, Math.round(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * this.size + px) * 4;
        this.data[i] = this.data[i] * (1 - a) + r * a;
        this.data[i + 1] = this.data[i + 1] * (1 - a) + g * a;
        this.data[i + 2] = this.data[i + 2] * (1 - a) + b * a;
        this.data[i + 3] = 255;
      }
    }
  }

  verticalGradient(top, bottom) {
    for (let y = 0; y < this.size; y++) {
      const t = y / (this.size - 1);
      const c = [0, 1, 2].map((k) => top[k] + (bottom[k] - top[k]) * t);
      this.fillRect(0, y, this.size, 1, c, 1);
    }
  }
}

// ------------------------------------------------------------------ png ----

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, body])));
  return Buffer.concat([length, typeBytes, body, crc]);
}

function encodePng(raster) {
  const { size, data } = raster;
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  // 10..12 stay 0: deflate, adaptive filtering, no interlace.

  // Each scanline is prefixed with its filter type; 0 (none) is fine here
  // because the image is flat colour blocks and compresses well regardless.
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ----------------------------------------------------------------- icon ----

// From PALETTE in src/render/palette.ts, so the icon on the home screen looks
// like the game it opens: a glowing jack-o'-lantern under a full moon on a
// purple Halloween night.
const NIGHT_TOP = [26, 16, 51];
const NIGHT_BOTTOM = [59, 31, 92];
const MOON = [255, 244, 194];
const PUMPKIN = [255, 140, 26];
const PUMPKIN_DARK = [194, 90, 10];
const STEM = [90, 58, 36];
const GLOW = [255, 224, 102];
const STAR = [255, 233, 168];

/** Filled ellipse, by scanlines. */
function ellipse(raster, cx, cy, rx, ry, colour) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    const dy = (y + 0.5 - cy) / ry;
    if (Math.abs(dy) > 1) continue;
    const half = rx * Math.sqrt(1 - dy * dy);
    raster.fillRect(cx - half, y, half * 2, 1, colour, 1);
  }
}

/** Filled triangle, by scanlines. */
function triangle(raster, ax, ay, bx, by, cx, cy, colour) {
  const minY = Math.floor(Math.min(ay, by, cy));
  const maxY = Math.ceil(Math.max(ay, by, cy));
  const edges = [
    [ax, ay, bx, by],
    [bx, by, cx, cy],
    [cx, cy, ax, ay],
  ];
  for (let y = minY; y <= maxY; y++) {
    const yc = y + 0.5;
    const xs = [];
    for (const [x0, y0, x1, y1] of edges) {
      if ((yc >= y0 && yc < y1) || (yc >= y1 && yc < y0)) xs.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
    }
    if (xs.length >= 2) raster.fillRect(Math.min(...xs), y, Math.abs(xs[1] - xs[0]), 1, colour, 1);
  }
}

function drawIcon(size) {
  const r = new Raster(size);
  r.verticalGradient(NIGHT_TOP, NIGHT_BOTTOM);
  const s = size / 100;
  for (const [x, y] of [[14, 14], [30, 8], [52, 18], [10, 40], [44, 30]]) r.fillRect(x * s, y * s, 1.6 * s, 1.6 * s, STAR, 0.9);
  ellipse(r, 76 * s, 22 * s, 14 * s, 14 * s, MOON);
  // The pumpkin: three overlapping lobes, a stem, and a glowing face.
  ellipse(r, 38 * s, 64 * s, 20 * s, 24 * s, PUMPKIN_DARK);
  ellipse(r, 62 * s, 64 * s, 20 * s, 24 * s, PUMPKIN_DARK);
  ellipse(r, 50 * s, 64 * s, 26 * s, 27 * s, PUMPKIN);
  r.fillRect(47 * s, 33 * s, 6 * s, 8 * s, STEM, 1);
  triangle(r, 36 * s, 60 * s, 44 * s, 60 * s, 40 * s, 51 * s, GLOW);
  triangle(r, 56 * s, 60 * s, 64 * s, 60 * s, 60 * s, 51 * s, GLOW);
  triangle(r, 47 * s, 66 * s, 53 * s, 66 * s, 50 * s, 61 * s, GLOW);
  r.fillRect(36 * s, 72 * s, 28 * s, 5 * s, GLOW, 1);
  r.fillRect(42 * s, 72 * s, 3 * s, 3 * s, PUMPKIN, 1);
  r.fillRect(55 * s, 72 * s, 3 * s, 3 * s, PUMPKIN, 1);
  return r;
}

mkdirSync(OUT_DIR, { recursive: true });
for (const size of [192, 512, 180]) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), encodePng(drawIcon(size)));
}
console.log('icons written');
