const puppeteer = require('puppeteer');
const BASE = 'http://localhost:3001';
const OUT = 'docs/testing/localization';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function login(page, phone) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 });
  await page.type('#phone_input', phone, { delay: 8 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const b = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await b[i].type('123456'[i], { delay: 8 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector('#customer_main', { timeout: 20000 });
  await sleep(2500);
}
// the EN/ع toggle in the header
async function toggleLang(page) {
  await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button, [role="button"], div')];
    const el = btns.find(b => /^(EN|ع)$/.test((b.innerText || '').trim()));
    if (el) (el.closest('button') || el).click();
  });
  await sleep(1200);
}
// detect language of the bottom nav (Home vs الرئيسية) to confirm switch
async function navLang(page) {
  return await page.evaluate(() => {
    const t = (document.querySelector('#nav_home')?.innerText || '').trim();
    return /Home/i.test(t) ? 'EN' : /الرئيسية/.test(t) ? 'AR' : '?';
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {} });

  const log = [];
  await login(page, '+201000000001');
  log.push(['start', await navLang(page)]);
  await page.screenshot({ path: `${OUT}/home_AR.png` });

  // 3 consecutive AR -> EN -> AR cycles, verifying nav language each time
  for (let i = 1; i <= 3; i++) {
    await toggleLang(page); log.push([`toggle ${i}a`, await navLang(page)]);
    if (i === 1) await page.screenshot({ path: `${OUT}/home_EN.png` });
    await toggleLang(page); log.push([`toggle ${i}b`, await navLang(page)]);
  }
  // capture a converted screen in EN: wallet
  await toggleLang(page); // to EN
  await page.click('#nav_wallet'); await sleep(1500);
  await page.screenshot({ path: `${OUT}/wallet_EN.png` });
  await toggleLang(page); // back to AR
  await page.screenshot({ path: `${OUT}/wallet_AR.png` });

  console.log('LANG CYCLE LOG:', JSON.stringify(log));
  await browser.close();
})();
