// ─────────────────────────────────────────────────────────────────────────────
// Email layout shell — production HTML that renders across email clients.
// Responsive (mobile media query), dark-mode compatible (prefers-color-scheme),
// and RTL-aware (dir + text-align flip for Arabic). Table-based + inline styles for
// client compatibility, with a <style> block for the parts clients honor.
// ─────────────────────────────────────────────────────────────────────────────
import type { Locale } from './types';

const BRAND = 'HAAT NOW';
const BRAND_AR = 'هات الآن';
const PRIMARY = '#9ED442';
const INK = '#0f1115';

export interface LayoutBlocks {
  heading: string;
  /** Body paragraphs (already escaped). */
  lines: string[];
  /** A big highlighted value (e.g. an OTP code or a total), optional. */
  highlight?: string | null;
  cta?: { label: string; url: string } | null;
  /** Small print under the CTA (already escaped). */
  footnote?: string | null;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export { esc };

export function renderLayout(locale: Locale, blocks: LayoutBlocks): string {
  const rtl = locale === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  const brand = rtl ? BRAND_AR : BRAND;
  const footer = rtl
    ? 'هذه رسالة آلية من هات الآن. الرجاء عدم الرد عليها مباشرة.'
    : 'This is an automated message from HAAT NOW. Please do not reply directly.';

  const lines = blocks.lines
    .map(l => `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#3a3f47;text-align:${align}">${l}</p>`)
    .join('');

  const highlight = blocks.highlight
    ? `<div style="margin:22px 0;text-align:center">
         <span style="display:inline-block;font-size:30px;letter-spacing:6px;font-weight:700;color:${INK};background:#f2f6ea;border:1px solid #e2ebd0;border-radius:12px;padding:14px 22px">${blocks.highlight}</span>
       </div>`
    : '';

  const cta = blocks.cta
    ? `<div style="margin:24px 0;text-align:center">
         <a href="${esc(blocks.cta.url)}" style="display:inline-block;background:${PRIMARY};color:${INK};font-weight:700;font-size:15px;text-decoration:none;border-radius:12px;padding:13px 28px">${esc(blocks.cta.label)}</a>
       </div>`
    : '';

  const footnote = blocks.footnote
    ? `<p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#8a9099;text-align:${align}">${blocks.footnote}</p>`
    : '';

  return `<!doctype html>
<html lang="${locale}" dir="${dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<style>
  body { margin:0; padding:0; background:#eef1f4; }
  .wrap { width:100%; background:#eef1f4; padding:24px 12px; }
  .card { max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e6e9ee; }
  .pad { padding:32px; }
  .brand { font-size:20px; font-weight:800; letter-spacing:0.5px; color:${INK}; }
  @media (max-width:600px) { .pad { padding:22px !important; } }
  @media (prefers-color-scheme: dark) {
    body, .wrap { background:#0b0d10 !important; }
    .card { background:#15181d !important; border-color:#23282f !important; }
    .brand, h1, .h { color:#f2f4f6 !important; }
    p { color:#c3c8d0 !important; }
    .foot { color:#7d838c !important; }
    .hl { background:#1d2410 !important; border-color:#33401a !important; color:#eaf4d7 !important; }
  }
</style>
</head>
<body>
  <div class="wrap" dir="${dir}">
    <div class="card">
      <div style="background:${PRIMARY};height:6px;line-height:6px;font-size:0">&nbsp;</div>
      <div class="pad">
        <div class="brand" style="text-align:${align};margin-bottom:18px">${brand}</div>
        <h1 class="h" style="margin:0 0 16px;font-size:20px;line-height:1.4;color:${INK};text-align:${align}">${esc(blocks.heading)}</h1>
        ${lines}
        ${highlight}
        ${cta}
        ${footnote}
      </div>
      <div class="pad" style="padding-top:0">
        <hr style="border:none;border-top:1px solid #eef1f4;margin:0 0 16px">
        <p class="foot" style="margin:0;font-size:12px;line-height:1.6;color:#9aa0a8;text-align:${align}">${footer}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

/** Plain-text fallback derived from the same blocks (deliverability + a11y). */
export function renderText(locale: Locale, blocks: LayoutBlocks): string {
  const parts = [blocks.heading, '', ...blocks.lines];
  if (blocks.highlight) parts.push('', blocks.highlight);
  if (blocks.cta) parts.push('', `${blocks.cta.label}: ${blocks.cta.url}`);
  if (blocks.footnote) parts.push('', blocks.footnote);
  return parts.join('\n').replace(/<[^>]+>/g, '');
}
