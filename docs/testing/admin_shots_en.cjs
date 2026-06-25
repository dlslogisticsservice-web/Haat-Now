const puppeteer = require('puppeteer');
const fs = require('fs');
const BASE = 'http://localhost:3001';
const OUT = 'docs/testing/e2e_shots/enterprise';
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {} });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 });
  await page.type('#phone_input', '+201000000005', { delay: 8 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const b = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await b[i].type('123456'[i], { delay: 8 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector('#admin_main_content', { timeout: 20000 });
  await sleep(2500);

  const clickByText = async (txt) => {
    const ok = await page.evaluate((t) => {
      const el = [...document.querySelectorAll('aside button')].find(x => x.textContent && x.textContent.includes(t));
      if (el) { el.click(); return true; } return false;
    }, txt);
    await sleep(1800); return ok;
  };

  // toggle to English via sidebar footer button
  const toggled = await clickByText('English');
  console.log('toggled to EN:', toggled);
  await sleep(1500);

  // verify English text present + RTL flipped to LTR
  const probe = await page.evaluate(() => ({
    hasExec: /Executive Command Center/i.test(document.body.innerText),
    hasModules: /Platform Modules/i.test(document.body.innerText),
    hasFleet: /Fleet Status/i.test(document.body.innerText),
    sidebarSample: [...document.querySelectorAll('aside button')].map(b => b.textContent.trim()).filter(Boolean).slice(0, 30),
  }));
  console.log('EN_PROBE:', JSON.stringify(probe).slice(0, 500));

  await page.screenshot({ path: `${OUT}/09-dashboard-en.png` }); console.log('shot: 09-dashboard-en');
  await clickByText('Finance'); await page.screenshot({ path: `${OUT}/10-finance-en.png` }); console.log('shot: 10-finance-en');
  await clickByText('Customer Care'); await page.screenshot({ path: `${OUT}/11-care-en.png` }); console.log('shot: 11-care-en');

  console.log('PAGE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
