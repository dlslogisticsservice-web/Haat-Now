// Verifies the content fixes render correctly on the live-built preview.
const puppeteer = require('puppeteer');
const BASE = process.env.BASE_URL || 'http://localhost:3001';

async function textAt(page, path, locale) {
  await page.evaluateOnNewDocument((loc) => { try { localStorage.setItem('haat_web_lang', loc); } catch (e) {} }, locale);
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle0', timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 500));
  return page.evaluate(() => document.body.innerText);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const checks = [];
  // AR homepage: testimonial cities should be Arabic, NOT Latin "Cairo/Giza/Alexandria"
  let p = await browser.newPage();
  const arHome = await textAt(p, '/', 'ar'); await p.close();
  checks.push(['AR home shows القاهرة (Cairo in Arabic)', arHome.includes('القاهرة')]);
  checks.push(['AR home has NO Latin "Cairo · illustrative"', !arHome.includes('Cairo · illustrative')]);
  checks.push(['AR home has NO Latin "Riyadh"', !arHome.includes('Riyadh')]);
  // Franchise page: no fabricated "15+ Cities"; shows 3-in-1
  p = await browser.newPage();
  const enFr = await textAt(p, '/franchise', 'en'); await p.close();
  checks.push(['Franchise: no "15+" fabricated metric', !enFr.includes('15+')]);
  checks.push(['Franchise: shows honest "3-in-1"', enFr.includes('3-in-1')]);
  // Blog: pre-launch messaging, not "is live"
  p = await browser.newPage();
  const enBlog = await textAt(p, '/blog', 'en'); await p.close();
  checks.push(['Blog: no "is live" contradiction', !enBlog.toLowerCase().includes('is live')]);
  checks.push(['Blog: shows "Coming soon"', enBlog.includes('Coming soon')]);
  // AR blog: translated (Arabic "قريباً"), not English title
  p = await browser.newPage();
  const arBlog = await textAt(p, '/blog', 'ar'); await p.close();
  checks.push(['AR blog: shows Arabic "قريباً"', arBlog.includes('قريباً')]);
  checks.push(['AR blog: NO Latin "Coming soon to your city"', !arBlog.includes('Coming soon to your city')]);

  await browser.close();
  let pass = 0;
  for (const [name, ok] of checks) { console.log(`  ${ok ? '✔' : '✖'} ${name}`); if (ok) pass++; }
  console.log(`\nCONTENT VERIFY: ${pass}/${checks.length} pass`);
  process.exit(pass === checks.length ? 0 : 1);
})();
