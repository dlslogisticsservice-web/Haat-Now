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

  // login as super admin (sandbox)
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

  const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log('shot:', name); };
  const clickByText = async (txt) => {
    const ok = await page.evaluate((t) => {
      const btns = [...document.querySelectorAll('aside button')];
      const el = btns.find(x => x.textContent && x.textContent.includes(t));
      if (el) { el.click(); return true; } return false;
    }, txt);
    await sleep(1800); return ok;
  };

  // sidebar presence check
  const sidebar = await page.evaluate(() => {
    const aside = document.querySelector('aside');
    if (!aside) return { found: false };
    const groups = [...aside.querySelectorAll('button')].map(b => b.textContent.trim()).filter(Boolean);
    return { found: true, groups: groups.slice(0, 40) };
  });
  console.log('SIDEBAR:', JSON.stringify(sidebar).slice(0, 400));

  await shot('01-dashboard');
  await clickByText('غرفة العمليات'); await shot('02-operations');
  await clickByText('المركز المالي'); await shot('03-finance');
  await clickByText('رعاية العملاء'); await shot('04-customer-care');
  await clickByText('إدارة النمو'); await shot('05-growth');
  await clickByText('الحملات'); await shot('06-campaigns');
  await clickByText('مركز التصميم'); await shot('07-design');
  await clickByText('الإرسال'); await shot('08-dispatch');

  console.log('PAGE ERRORS:', errors.length ? errors.join(' | ') : 'none');
  await browser.close();
})();
