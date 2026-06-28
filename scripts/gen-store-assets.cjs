// Generates a real Play-Store feature graphic (1024x500) from the brand — pure-JS PNG
// (no external libs). Brand: dark gradient + green logo tile with the "layers" mark + glow.
const zlib = require('zlib'), fs = require('fs'), path = require('path');
const GREEN = [163, 249, 91], DARK = [10, 28, 0];
const crcTable = (() => { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const ch = (ty, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const t = Buffer.from(ty); const cr = Buffer.alloc(4); cr.writeUInt32BE(crc32(Buffer.concat([t, d]))); return Buffer.concat([l, t, d, cr]); };
const enc = (w, h, rgba) => { const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); } return Buffer.concat([sig, ch('IHDR', ih), ch('IDAT', zlib.deflateSync(raw, { level: 9 })), ch('IEND', Buffer.alloc(0))]); };
const cover = d => d <= 0 ? 1 : d >= 1 ? 0 : 1 - d;
const rr = (x, y, x0, y0, x1, y1, rad) => {
  if (x >= x0 + rad && x <= x1 - rad) return Math.max(y0 - y, y - y1);
  if (y >= y0 + rad && y <= y1 - rad) return Math.max(x0 - x, x - x1);
  const cx = Math.max(x0 + rad, Math.min(x, x1 - rad)), cy = Math.max(y0 + rad, Math.min(y, y1 - rad));
  return Math.hypot(x - cx, y - cy) - rad;
};
const lerp = (a, b, t) => Math.round(a + (b - a) * t);

function featureGraphic(W, H) {
  const buf = Buffer.alloc(W * H * 4);
  const cx = W * 0.30, cy = H / 2, tile = 150, x0 = cx - tile, x1 = cx + tile, y0 = cy - tile, y1 = cy + tile, r = tile * 0.42;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, t = y / H;
    // dark vertical gradient with a faint green tint
    let R = lerp(6, 9, t), G = lerp(10, 22, t), B = lerp(14, 10, t);
    // soft radial green glow behind the tile
    const dg = Math.hypot(x - cx, y - cy) / (tile * 2.4);
    const glow = Math.max(0, 1 - dg) * 0.22;
    R = lerp(R, GREEN[0], glow); G = lerp(G, GREEN[1], glow); B = lerp(B, GREEN[2], glow);
    // logo tile (green rounded square)
    const tileA = cover(rr(x + 0.5, y + 0.5, x0, y0, x1, y1, r));
    if (tileA > 0) { R = lerp(R, GREEN[0], tileA); G = lerp(G, GREEN[1], tileA); B = lerp(B, GREEN[2], tileA); }
    // three dark "layers" bars on the tile
    if (tileA > 0) {
      const pad = tile * 0.42, bx0 = cx - (tile - pad), bx1 = cx + (tile - pad);
      const barH = tile * 0.20, gap = tile * 0.13, top = cy - (barH * 3 + gap * 2) / 2;
      for (let b = 0; b < 3; b++) {
        const by0 = top + b * (barH + gap);
        const a = cover(rr(x + 0.5, y + 0.5, bx0, by0, bx1, by0 + barH, barH * 0.45)) * tileA;
        if (a > 0) { R = lerp(R, DARK[0], a); G = lerp(G, DARK[1], a); B = lerp(B, DARK[2], a); }
      }
    }
    buf[i] = R; buf[i + 1] = G; buf[i + 2] = B; buf[i + 3] = 255;
  }
  return enc(W, H, buf);
}

const out = path.join(__dirname, '..', 'store-assets');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'feature-graphic-1024x500.png'), featureGraphic(1024, 500));
fs.writeFileSync(path.join(out, 'promo-512x512.png'), featureGraphic(512, 512));
console.log('wrote store-assets/feature-graphic-1024x500.png + promo-512x512.png');
