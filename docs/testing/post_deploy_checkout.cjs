const puppeteer = require('puppeteer');
const fs = require('fs');
const BASE = 'http://localhost:3001/app'; // role app moved to /app (website owns /)
const OUT = 'docs/testing/post_deploy_shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ui = [];

async function login(page, phone) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 });
  await page.type('#phone_input', phone, { delay: 8 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const boxes = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 8 });
  await page.click('#verify_otp_btn');
}
async function ctaTopMost(page, selector) {
  return await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return { selector: sel, present: false };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { selector: sel, present: true, visible: false };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const covered = !(hit && (el.contains(hit) || hit.contains(el)));
    const coveredBy = covered && hit ? (hit.closest('.bottom-nav') ? 'bottom-nav' : (hit.id || hit.tagName)) : null;
    return { selector: sel, present: true, visible: true, top: Math.round(r.top), bottom: Math.round(r.bottom), winH: window.innerHeight, covered, coveredBy: String(coveredBy).slice(0, 30) };
  }, selector);
}
async function snap(page, name, ctaSelectors = []) {
  const shot = `${OUT}/ui_${name}.png`;
  await page.screenshot({ path: shot });
  const ctas = [];
  for (const s of ctaSelectors) ctas.push(await ctaTopMost(page, s));
  const overlaps = ctas.filter(c => c.present && c.visible && c.covered);
  ui.push({ name, screenshot: shot, ctas, overlap: overlaps.length > 0 });
  console.log(`UI ${name}: ${overlaps.length ? 'OVERLAP! ' : 'OK'} ${JSON.stringify(ctas)}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); } catch (e) {} });
  try {
    await login(page, '+201000000001');
    await page.waitForSelector('#customer_main', { timeout: 20000 });
    await sleep(2500);
    // open first restaurant
    await page.evaluate(() => { const c = document.querySelector('#restaurants_list > div'); if (c) c.click(); });
    await page.waitForSelector('#menu_list', { timeout: 8000 }); await sleep(1500);
    // open a product card: click the first IMG inside the menu grid (bubbles to card onClick)
    const opened = await page.evaluate(() => {
      const img = document.querySelector('#menu_list img');
      const card = img && (img.closest('[class*="cursor"]') || img.parentElement);
      if (card) { card.click(); return true; }
      return false;
    });
    await sleep(1200);
    const modalThere = await page.$('#product_modal');
    console.log('product opened:', opened, 'modal present:', !!modalThere);
    await snap(page, 'product_modal', ['#add_to_cart_confirm']);
    // add to cart
    const added = await page.evaluate(() => { const b = document.querySelector('#add_to_cart_confirm'); if (b) { b.click(); return true; } return false; });
    console.log('added:', added); await sleep(1200);
    // cart drawer
    await page.click('#nav_cart'); await sleep(1300);
    await snap(page, 'cart', ['#checkout_btn']);
    // checkout
    await page.evaluate(() => { const b = document.querySelector('#checkout_btn'); if (b) b.click(); });
    await sleep(2200);
    await snap(page, 'checkout', ['#checkout-area']);
  } catch (e) {
    console.log('ERROR', String(e).slice(0, 300));
    try { await page.screenshot({ path: `${OUT}/ui_checkout_ERROR.png` }); } catch {}
  }
  await browser.close();
  const prev = JSON.parse(fs.readFileSync(`${OUT}/results.json`, 'utf8'));
  prev.ui = (prev.ui || []).filter(u => !['product_modal','cart','checkout'].includes(u.name)).concat(ui);
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(prev, null, 2));
  console.log('anyOverlap=' + ui.some(u => u.overlap));
})();
