// Production app-icon generator — renders real brand PNGs (no external libs).
// Brand: green #a3f95b tile + dark "layers" mark (#0a1c00). Pure-JS PNG (zlib).
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const GREEN = [163, 249, 91];
const DARK = [10, 28, 0];
const BG = [6, 10, 14];

// ── PNG encoder (8-bit RGBA) ──
const crcTable = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = buf => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const t = Buffer.from(type); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data]))); return Buffer.concat([len, t, data, crc]); }
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// soft coverage for anti-aliasing (distance-based, 1px feather)
const cover = (d) => d <= 0 ? 1 : d >= 1 ? 0 : 1 - d;

function draw(S, { maskable }) {
  const buf = Buffer.alloc(S * S * 4);
  const r = maskable ? 0 : S * 0.225;          // tile corner radius (0 = full-bleed for maskable)
  const pad = maskable ? S * 0.18 : S * 0.20;   // safe-zone padding for the mark
  // 3 "layers" bars
  const barH = (S - pad * 2) * 0.20, gap = (S - pad * 2) * 0.10;
  const totalH = barH * 3 + gap * 2;
  const top = (S - totalH) / 2;
  const barX0 = pad, barX1 = S - pad, barR = barH * 0.45;
  const set = (x, y, rgb, a) => { const i = (y * S + x) * 4; buf[i] = rgb[0]; buf[i + 1] = rgb[1]; buf[i + 2] = rgb[2]; buf[i + 3] = Math.round(a * 255); };
  // rounded-rect signed distance (outside>0)
  const rrDist = (x, y, x0, y0, x1, y1, rad) => {
    const cx = Math.max(x0 + rad, Math.min(x, x1 - rad));
    const cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
    const dx = Math.max(x0 + rad - x, x - (x1 - rad), 0);
    const dy = Math.max(y0 + rad - y, y - (y1 - rad), 0);
    // inside straight zones
    if (x >= x0 + rad && x <= x1 - rad) return Math.max(y0 - y, y - y1);
    if (y >= y0 + rad && y <= y1 - rad) return Math.max(x0 - x, x - x1);
    return Math.hypot(x - cx, y - cy) - rad;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = x + 0.5, py = y + 0.5;
    // tile
    const tileD = maskable ? -1 : rrDist(px, py, 0, 0, S, S, r);
    const tileA = maskable ? 1 : cover(tileD);
    if (tileA <= 0) { set(x, y, BG, 0); continue; }
    set(x, y, GREEN, tileA);
    // bars (dark) over the tile
    for (let b = 0; b < 3; b++) {
      const y0 = top + b * (barH + gap), y1 = y0 + barH;
      const d = rrDist(px, py, barX0, y0, barX1, y1, barR);
      const a = cover(d) * tileA;
      if (a > 0) {
        const i = (y * S + x) * 4;
        buf[i] = Math.round(buf[i] * (1 - a) + DARK[0] * a);
        buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + DARK[1] * a);
        buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + DARK[2] * a);
        buf[i + 3] = Math.max(buf[i + 3], Math.round(a * 255));
      }
    }
  }
  return encodePNG(S, S, buf);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
const targets = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['maskable-192.png', 192, true], ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, false], ['icon-1024.png', 1024, false],
  ['notification-icon.png', 96, false],
];
for (const [name, size, maskable] of targets) {
  fs.writeFileSync(path.join(outDir, name), draw(size, { maskable }));
  console.log('wrote', name, size + 'x' + size);
}
console.log('done.');
