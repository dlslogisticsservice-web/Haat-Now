// Responsive screenshot evidence for the public website (PublicSiteApp).
// Captures the homepage at launch-critical breakpoints in EN (LTR) and AR (RTL),
// and reports any horizontal overflow (scrollWidth > viewport width) as a blocker.
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const OUT = path.join(__dirname, 'public_shots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const WIDTHS = [320, 375, 390, 414, 768, 1024, 1280, 1440, 1920];

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const report = [];
  for (const locale of ['en', 'ar']) {
    for (const w of WIDTHS) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: 900, deviceScaleFactor: 1 });
      await page.evaluateOnNewDocument((loc) => { try { localStorage.setItem('haat_web_lang', loc); } catch (e) {} }, locale);
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
      await new Promise(r => setTimeout(r, 600));
      const metrics = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
        imgs: Array.from(document.images).map(i => ({ src: i.currentSrc || i.src, ok: i.complete && i.naturalWidth > 0, alt: i.alt })),
      }));
      const overflow = metrics.scrollW - metrics.clientW;
      const brokenImgs = metrics.imgs.filter(i => !i.ok);
      const noAlt = metrics.imgs.filter(i => !i.alt || !i.alt.trim());
      report.push({ locale, w, overflow, imgTotal: metrics.imgs.length, broken: brokenImgs.length, noAlt: noAlt.length });
      if (w === 320 || w === 768 || w === 1440) {
        await page.screenshot({ path: path.join(OUT, `home_${locale}_${w}.png`), fullPage: true });
      }
      await page.close();
    }
  }
  await browser.close();
  console.log('BREAKPOINT AUDIT (overflow>0 = horizontal scroll blocker):');
  let blockers = 0;
  for (const r of report) {
    const flag = r.overflow > 1 ? ' ⚠ OVERFLOW' : '';
    if (r.overflow > 1) blockers++;
    console.log(`  ${r.locale} ${String(r.w).padStart(4)}px  overflow=${r.overflow}px  imgs=${r.imgTotal} broken=${r.broken} noAlt=${r.noAlt}${flag}`);
  }
  console.log(`\nRESULT: ${blockers === 0 ? 'PASS — no horizontal overflow at any breakpoint' : blockers + ' overflow blocker(s)'}`);
})();
