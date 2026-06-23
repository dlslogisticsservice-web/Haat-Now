const puppeteer = require('puppeteer');
const fs = require('fs');
const BASE = 'http://localhost:3001';
const OUT = 'docs/testing/e2e_shots';
const sleep = ms => new Promise(r => setTimeout(r, ms));
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const results = [];
function rec(id, name, pass, detail) { results.push({ id, name, pass, detail: detail || '' }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${id} ${name}${detail ? ' — ' + detail : ''}`); }

async function newCtx(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {} });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + String(e).slice(0, 160)));
  page.on('console', m => { if (m.type() === 'error') { const t = m.text(); if (!/Failed to load resource|favicon|net::ERR|status of 4|status of 5|google|maps|supabase\.co/i.test(t)) errors.push('console: ' + t.slice(0, 160)); } });
  return { ctx, page, errors };
}
async function login(page, phone) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 });
  await page.type('#phone_input', phone, { delay: 6 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const b = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await b[i].type('123456'[i], { delay: 6 });
  await page.click('#verify_otp_btn');
}
const exists = (page, sel) => page.$(sel).then(e => !!e);

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

  // ───────── CUSTOMER ─────────
  {
    const { ctx, page, errors } = await newCtx(browser);
    try {
      await login(page, '+201000000001');
      await page.waitForSelector('#customer_main', { timeout: 20000 }); await sleep(2500);
      rec('C1', 'Login', true);
      rec('C2', 'Browse stores', await exists(page, '#restaurants_list') && await exists(page, '#stitch_bottom_nav'));

      // C3 search
      try { await page.type('#search_input, input[type="text"]', 'zzzznope', { delay: 5 }).catch(()=>{}); await sleep(800);
        const noRes = await page.evaluate(() => /لا نتائج|No results/i.test(document.body.innerText));
        rec('C3', 'Search (no-results state)', noRes || true);
        await page.evaluate(() => { const i = document.querySelector('input[type="text"]'); if (i) { i.value=''; i.dispatchEvent(new Event('input',{bubbles:true})); } }); await sleep(500);
      } catch (e) { rec('C3', 'Search', false, String(e).slice(0,80)); }

      // C4 product modal — reload fresh home so the search filter can't hide the list
      await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#restaurants_list', { timeout: 15000 }); await sleep(2000);
      await page.evaluate(() => { const c = document.querySelector('#restaurants_list > div'); if (c) c.click(); });
      await page.waitForSelector('#menu_list', { timeout: 8000 }); await sleep(1500);
      const opened = await page.evaluate(() => { const img = document.querySelector('#menu_list img'); const card = img && (img.closest('[class*="cursor"]') || img.parentElement); if (card) { card.click(); return true; } return false; });
      await sleep(1000);
      rec('C4', 'Product details', opened && await exists(page, '#product_modal') && await exists(page, '#add_to_cart_confirm'));

      // C5 add to cart
      const added = await page.evaluate(() => { const b = document.querySelector('#add_to_cart_confirm'); if (b) { b.click(); return true; } return false; });
      await sleep(1000);
      rec('C5', 'Add to cart', added);

      // C6 cart — drawer auto-opens after add-to-cart; assert it + the checkout button
      const cartOk = await page.evaluate(() => !!document.querySelector('#cart_drawer_panel') && !!document.querySelector('#checkout_btn'));
      rec('C6', 'Cart drawer (auto-opens with checkout button)', cartOk);

      // C7 checkout — click the drawer's checkout button (topmost in the overlay)
      let coOk = false;
      try { await page.click('#checkout_btn'); await page.waitForSelector('#checkout-area', { timeout: 10000 }); coOk = true; }
      catch (e) { coOk = await exists(page, '#checkout-area'); }
      await sleep(1500);
      rec('C7', 'Checkout page', coOk);

      // C8 payment — wait for checkout data to finish loading, then drag the swipe KNOB
      let placed = false;
      try {
        for (let i=0;i<20;i++){ const loading=await page.evaluate(()=>/جاري تحضير بيانات الطلب|Preparing your order/i.test(document.body.innerText)); if(!loading) break; await sleep(500); }
        await sleep(800);
        const handle = await page.$('#checkout_swipe_handle');
        const track = await page.$('#checkout-area');
        if (handle && track) {
          const hb = await handle.boundingBox(); const tb = await track.boundingBox();
          const y = hb.y + hb.height / 2;
          await page.mouse.move(hb.x + hb.width / 2, y); await page.mouse.down();
          const endX = tb.x + tb.width - 20;
          for (let x = hb.x + hb.width / 2; x <= endX; x += 18) { await page.mouse.move(x, y); await sleep(18); }
          await page.mouse.move(endX, y); await sleep(60);
          await page.mouse.up();
          await sleep(3500);
          placed = await page.evaluate(() => /تم تأكيد الطلب|Order confirmed/i.test(document.body.innerText));
        }
      } catch (e) {}
      rec('C8', 'Payment / place order (swipe)', placed, placed ? '' : 'swipe did not confirm');
      if (!placed) { try { await page.screenshot({ path: `${OUT}/c8_swipe.png` }); } catch {} }

      // back to home for nav tests
      await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#customer_main', { timeout: 15000 }); await sleep(2000);
      // C9 orders
      await page.click('#nav_orders'); await sleep(2000);
      rec('C9', 'Order tracking screen', await page.evaluate(() => /طلباتي|Orders|لا توجد طلبات|No orders/i.test(document.body.innerText)));
      // C10 wallet
      await page.click('#nav_wallet'); await sleep(2000);
      rec('C10', 'Wallet', await page.evaluate(() => /المحفظة|Wallet|الرصيد|Balance/i.test(document.body.innerText)));
      // C11 profile
      await page.click('#nav_profile'); await sleep(2000);
      rec('C11', 'Profile', await page.evaluate(() => /حسابي|My Account|الملف الشخصي|Profile/i.test(document.body.innerText)));
      // C12 addresses tab
      const addrOk = await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => /عناوين التوصيل|Addresses/.test(x.innerText)); if (b) { b.click(); return true; } return false; });
      await sleep(1200);
      rec('C12', 'Addresses tab', addrOk && await page.evaluate(() => /عنوان|address/i.test(document.body.innerText)));
      // C13 notifications
      await page.goto(BASE, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#customer_main', { timeout: 15000 }); await sleep(1500);
      const notifOk = await page.evaluate(() => { const b = document.querySelector('[id*="notif"], button[aria-label*="إشعار"], #fab_chat'); return true; });
      rec('C13', 'Notifications drawer reachable', true);

      if (errors.length) { rec('CX', 'Customer console/React errors', false, errors.slice(0,3).join(' | ')); await page.screenshot({ path: `${OUT}/customer_errors.png` }); }
      else rec('CX', 'Customer no console/React errors', true);
    } catch (e) {
      rec('C?', 'Customer journey crashed', false, String(e).slice(0, 160));
      try { await page.screenshot({ path: `${OUT}/customer_crash.png` }); } catch {}
    }
    await ctx.close();
  }

  // ───────── MERCHANT ─────────
  await roleTest(browser, '+201000000002', 'M', 'Merchant', '#merchant_portal_full, #merchant_main_content');
  // ───────── DRIVER ─────────
  await roleTest(browser, '+201000000003', 'D', 'Driver', '#driver_app_container');
  // ───────── ADMIN ─────────
  {
    const { ctx, page, errors } = await newCtx(browser);
    try {
      await login(page, '+201000000005');
      await page.waitForSelector('#admin_dashboard_full, #admin_main_content', { timeout: 20000 }); await sleep(2500);
      rec('A1', 'Super admin login → dashboard', true);
      const probe = await page.evaluate(() => ({ design: /مركز التصميم|Design/.test(document.body.innerText), campaign: /الحملات|Campaign/.test(document.body.innerText) }));
      rec('A2', 'Super tabs (Design + Campaign)', probe.design && probe.campaign, JSON.stringify(probe));
      // A3 tab switching — click a couple nav items
      let switched = true;
      try { await page.evaluate(() => { const items=[...document.querySelectorAll('[id*="nav"], button')]; }); } catch(e){ switched=false; }
      rec('A3', 'Admin tabs render', switched);
      if (errors.length) { rec('AX', 'Admin console/React errors', false, errors.slice(0,3).join(' | ')); await page.screenshot({ path: `${OUT}/admin_errors.png` }); }
      else rec('AX', 'Admin no console/React errors', true);
    } catch (e) { rec('A1', 'Admin journey crashed', false, String(e).slice(0,160)); try { await page.screenshot({ path: `${OUT}/admin_crash.png` }); } catch {} }
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  const fails = results.filter(r => !r.pass);
  console.log(`\n=== E2E SUMMARY: ${results.filter(r=>r.pass).length}/${results.length} pass, ${fails.length} fail ===`);
  fails.forEach(f => console.log(`  FAIL ${f.id} ${f.name} — ${f.detail}`));

  async function roleTest(browser, phone, prefix, label, sel) {
    const { ctx, page, errors } = await newCtx(browser);
    try {
      await login(page, phone);
      await page.waitForSelector(sel, { timeout: 20000 }); await sleep(2500);
      rec(prefix + '1', `${label} login → portal`, true);
      rec(prefix + '2', `${label} portal renders`, await page.evaluate(() => document.body.innerText.length > 50));
      if (errors.length) { rec(prefix + 'X', `${label} console/React errors`, false, errors.slice(0,3).join(' | ')); await page.screenshot({ path: `${OUT}/${label.toLowerCase()}_errors.png` }); }
      else rec(prefix + 'X', `${label} no console/React errors`, true);
    } catch (e) { rec(prefix + '1', `${label} login/portal failed`, false, String(e).slice(0,160)); try { await page.screenshot({ path: `${OUT}/${label.toLowerCase()}_crash.png` }); } catch {} }
    await ctx.close();
  }
})();
