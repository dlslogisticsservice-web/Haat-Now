// Generate brand Android launcher icons (all densities + adaptive foreground).
// Reuses the same pure-JS brand renderer. Sets the adaptive background to brand green.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const GREEN = [163, 249, 91], DARK = [10, 28, 0];
const crcTable = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const t = Buffer.from(ty); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, d]))); return Buffer.concat([l, t, d, cr]); };
const enc = (w, h, rgba) => { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } return Buffer.concat([sig, ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]); };
const cover = d => d <= 0 ? 1 : d >= 1 ? 0 : 1 - d;
const rrDist = (x, y, x0, y0, x1, y1, rad) => {
  if (x >= x0 + rad && x <= x1 - rad) return Math.max(y0 - y, y - y1);
  if (y >= y0 + rad && y <= y1 - rad) return Math.max(x0 - x, x - x1);
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad)), cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
  return Math.hypot(x - cx, y - cy) - rad;
};
function draw(S, mode) { // mode: 'full' | 'foreground'
  const buf = Buffer.alloc(S * S * 4);
  const fg = mode === 'foreground';
  const r = fg ? 0 : S * 0.22;
  const pad = fg ? S * 0.30 : S * 0.20;     // adaptive foreground keeps the mark in the safe zone
  const barH = (S - pad * 2) * 0.20, gap = (S - pad * 2) * 0.10;
  const totalH = barH * 3 + gap * 2, top = (S - totalH) / 2;
  const x0 = pad, x1 = S - pad, barR = barH * 0.45;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const px = x + 0.5, py = y + 0.5, i = (y * S + x) * 4;
    let bg = 0;
    if (!fg) { const a = cover(rrDist(px, py, 0, 0, S, S, r)); if (a > 0) { buf[i] = GREEN[0]; buf[i + 1] = GREEN[1]; buf[i + 2] = GREEN[2]; buf[i + 3] = Math.round(a * 255); bg = a; } }
    for (let b = 0; b < 3; b++) {
      const y0 = top + b * (barH + gap), a = cover(rrDist(px, py, x0, y0, x0 + (x1 - x0), y0 + barH, barR)) * (fg ? 1 : bg);
      if (a > 0) { buf[i] = Math.round((buf[i] || 0) * (1 - a) + DARK[0] * a); buf[i + 1] = Math.round((buf[i + 1] || 0) * (1 - a) + DARK[1] * a); buf[i + 2] = Math.round((buf[i + 2] || 0) * (1 - a) + DARK[2] * a); buf[i + 3] = Math.max(buf[i + 3], Math.round(a * 255)); }
    }
  }
  return enc(S, S, buf);
}
const res = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
const dens = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const fgDens = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };
for (const [d, s] of Object.entries(dens)) {
  const dir = path.join(res, `mipmap-${d}`);
  if (!fs.existsSync(dir)) continue;
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), draw(s, 'full'));
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), draw(s, 'full'));
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), draw(fgDens[d], 'foreground'));
  console.log('android mipmap-' + d, 'done');
}
// brand adaptive background colour
const bgXml = path.join(res, 'values', 'ic_launcher_background.xml');
if (fs.existsSync(bgXml)) {
  fs.writeFileSync(bgXml, '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#A3F95B</color>\n</resources>\n');
  console.log('set adaptive background -> #A3F95B');
}
console.log('done.');
