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

// Gold-standard overlap check: is the element actually the top-most thing at its
// own center? If elementFromPoint returns the element (or its descendant/ancestor),
// it is NOT covered. If it returns something else (e.g. the bottom nav), it IS hidden.
async function ctaTopMost(page, selector) {
  return await page.evaluate(sel => {
    const el = document.querySelector(sel);
    if (!el) return { selector: sel, present: false };
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return { selector: sel, present: true, visible: false };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const hit = document.elementFromPoint(cx, cy);
    const covered = !(hit && (el.contains(hit) || hit.contains(el)));
    const coveredBy = covered && hit ? (hit.closest('.bottom-nav') ? 'bottom-nav' : (hit.id || hit.className || hit.tagName)) : null;
    return { selector: sel, present: true, visible: true, top: Math.round(r.top), bottom: Math.round(r.bottom), covered, coveredBy: String(coveredBy).slice(0, 40) };
  }, selector);
}

async function snap(page, name, ctaSelectors = []) {
  const shot = `${OUT}/ui_${name}.png`;
  await page.screenshot({ path: shot });
  const ctas = [];
  for (const s of ctaSelectors) ctas.push(await ctaTopMost(page, s));
  const overlaps = ctas.filter(c => c.present && c.visible && c.covered);
  ui.push({ name, screenshot: shot, ctas, overlap: overlaps.length > 0 });
  console.log(`UI ${name}: ${overlaps.length ? 'OVERLAP! ' + JSON.stringify(overlaps) : 'OK'}  ${JSON.stringify(ctas)}`);
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); } catch (e) {} });

  try {
    await login(page, '+201000000001');
    await page.waitForSelector('#customer_main, #stitch_header', { timeout: 20000 });
    await sleep(2500);
    await snap(page, 'home');

    // Profile
    await page.click('#nav_profile'); await sleep(1500);
    await snap(page, 'profile');

    // Wallet
    await page.click('#nav_wallet'); await sleep(1500);
    await snap(page, 'wallet');

    // Home -> first restaurant -> product modal
    await page.click('#nav_home'); await sleep(1500);
    const hasResto = await page.evaluate(() => {
      const list = document.querySelector('#restaurants_list');
      const card = list && list.querySelector(':scope > div');
      if (card) { card.click(); return true; } return false;
    });
    console.log('restaurant opened:', hasResto);
    await sleep(2200);
    await snap(page, 'restaurant');

    if (hasResto) {
      const hasProd = await page.evaluate(() => {
        const list = document.querySelector('#menu_list');
        const card = list && list.querySelector(':scope > div');
        if (card) { card.click(); return true; } return false;
      });
      console.log('product opened:', hasProd);
      await sleep(1200);
      await snap(page, 'product_modal', ['#add_to_cart_confirm']);
      // add to cart, then cart, then checkout
      const added = await page.evaluate(() => { const b = document.querySelector('#add_to_cart_confirm'); if (b) { b.click(); return true; } return false; });
      console.log('added to cart:', added);
      await sleep(1000);
    }

    // Cart drawer
    await page.click('#nav_cart'); await sleep(1300);
    await snap(page, 'cart', ['#checkout_btn']);

    // Checkout
    const toCheckout = await page.evaluate(() => { const b = document.querySelector('#checkout_btn'); if (b) { b.click(); return true; } return false; });
    console.log('to checkout:', toCheckout);
    await sleep(2000);
    await snap(page, 'checkout', ['#checkout-area']);

  } catch (e) {
    console.log('ERROR', String(e).slice(0, 300));
    try { await page.screenshot({ path: `${OUT}/ui_ERROR2.png` }); } catch {}
  }
  await browser.close();
  const prev = JSON.parse(fs.readFileSync(`${OUT}/results.json`, 'utf8'));
  prev.ui = ui;
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(prev, null, 2));
  const anyOverlap = ui.some(u => u.overlap);
  console.log('\n=== UI SUMMARY ===  anyOverlap=' + anyOverlap);
  ui.forEach(u => console.log(`  ${u.name}: overlap=${u.overlap}`));
})();
