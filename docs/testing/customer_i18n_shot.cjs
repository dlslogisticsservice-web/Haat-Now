const puppeteer = require('puppeteer');
const fs = require('fs');
const BASE = 'http://localhost:3001';
const OUT = 'docs/testing/e2e_shots/enterprise';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'en'); } catch (e) {} });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 });
  await page.type('#phone_input', '+201000000001', { delay: 8 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const b = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await b[i].type('123456'[i], { delay: 8 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector('#customer_main', { timeout: 20000 });
  await sleep(2000);

  await page.click('#nav_discover');
  await page.waitForSelector('#discover_screen', { timeout: 10000 });
  await sleep(1500);

  const probe = await page.evaluate(() => ({
    dir: document.querySelector('#discover_screen')?.getAttribute('dir'),
    enTabs: /Search & discover|Favorites|Rewards|Support/.test(document.body.innerText),
    arLeftover: /بحث واكتشاف|المفضّلة|مكافآتي/.test(document.body.innerText),
  }));
  console.log('DISCOVER_EN:', JSON.stringify(probe));
  await page.screenshot({ path: `${OUT}/15-discover-en.png` }); console.log('shot: 15-discover-en');

  // Rewards tab (had the emoji + alerts)
  await page.evaluate(() => { const el = [...document.querySelectorAll('#discover_screen button')].find(b => /Rewards/.test(b.textContent)); if (el) el.click(); });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/16-discover-rewards-en.png` }); console.log('shot: 16-discover-rewards-en');

  console.log('PAGE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
