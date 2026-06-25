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
    const ok = await page.evaluate((t) => { const el = [...document.querySelectorAll('aside button')].find(x => x.textContent && x.textContent.includes(t)); if (el) { el.click(); return true; } return false; }, txt);
    await sleep(1500); return ok;
  };

  // Notification Center
  const nOk = await clickByText('الإشعارات');
  const nProbe = await page.evaluate(() => ({ center: !!document.querySelector('#notification_center'), title: /مركز الإشعارات/.test(document.body.innerText) }));
  console.log('NOTIF:', nOk, JSON.stringify(nProbe));
  await page.screenshot({ path: `${OUT}/12-notifications.png` }); console.log('shot: 12-notifications');

  // Global Search palette (Ctrl+K)
  await page.keyboard.down('Control'); await page.keyboard.press('KeyK'); await page.keyboard.up('Control');
  await sleep(700);
  await page.type('input[placeholder*="ابحث"]', 'a', { delay: 30 });
  await page.type('input[placeholder*="ابحث"]', 'b', { delay: 30 });
  await sleep(1200);
  const sProbe = await page.evaluate(() => ({ palette: /تنقّل|navigate/.test(document.body.innerText) }));
  console.log('SEARCH:', JSON.stringify(sProbe));
  await page.screenshot({ path: `${OUT}/13-global-search.png` }); console.log('shot: 13-global-search');
  await page.keyboard.press('Escape'); await sleep(400);

  // System Logs
  const lOk = await clickByText('سجلّات النظام');
  const lProbe = await page.evaluate(() => ({ logs: !!document.querySelector('#system_logs') }));
  console.log('LOGS:', lOk, JSON.stringify(lProbe));
  await page.screenshot({ path: `${OUT}/14-system-logs.png` }); console.log('shot: 14-system-logs');

  console.log('PAGE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
