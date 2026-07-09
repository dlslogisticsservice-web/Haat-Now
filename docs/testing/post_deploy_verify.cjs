const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3001/app'; // role app moved to /app (website owns /)
const OUT = 'docs/testing/post_deploy_shots';
const results = { admins: [], ui: [], startedAt: new Date().toISOString() };

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function freshPage(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  // skip onboarding so we reach the login screen quickly
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); } catch (e) {} });
  return { ctx, page };
}

async function login(page, phone) {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#phone_input', { timeout: 20000 }); // splash auto-advances (~2.75s)
  await page.click('#phone_input', { clickCount: 3 });
  await page.type('#phone_input', phone, { delay: 8 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 10000 });
  const boxes = await page.$$('#otp_boxes input');
  const otp = '123456';
  for (let i = 0; i < boxes.length && i < otp.length; i++) await boxes[i].type(otp[i], { delay: 8 });
  await page.click('#verify_otp_btn');
}

async function verifyAdmin(browser, label, phone, expectSuper) {
  const { ctx, page } = await freshPage(browser);
  const rec = { label, phone, expectSuper };
  try {
    await login(page, phone);
    // wait for admin dashboard shell
    await page.waitForSelector('#admin_dashboard_full, #admin_main_content', { timeout: 20000 });
    await sleep(2500); // allow async getAdminScope -> isSuper to resolve & nav to render
    const probe = await page.evaluate(() => {
      const txt = document.body.innerText || '';
      return {
        designCenter: txt.includes('مركز التصميم'),
        campaignCenter: txt.includes('الحملات'),
        hasDashboard: !!document.querySelector('#admin_dashboard_full, #admin_main_content'),
      };
    });
    rec.designCenter = probe.designCenter;
    rec.campaignCenter = probe.campaignCenter;
    rec.resolvedSuper = probe.designCenter && probe.campaignCenter;
    rec.pass = rec.resolvedSuper === expectSuper;
    const shot = `${OUT}/admin_${phone.replace('+', '')}.png`;
    await page.screenshot({ path: shot, fullPage: false });
    rec.screenshot = shot;
  } catch (e) {
    rec.error = String(e).slice(0, 200);
    try { await page.screenshot({ path: `${OUT}/admin_${phone.replace('+', '')}_ERROR.png` }); } catch {}
  }
  results.admins.push(rec);
  await ctx.close();
  console.log(`ADMIN ${label} (${phone}) -> design=${rec.designCenter} campaign=${rec.campaignCenter} expectSuper=${expectSuper} PASS=${rec.pass}`);
}

// Measure whether any visible CTA-like button overlaps the fixed bottom nav.
async function overlapProbe(page) {
  return await page.evaluate(() => {
    const nav = document.querySelector('.bottom-nav');
    const navTop = nav ? nav.getBoundingClientRect().top : null;
    const vh = window.innerHeight;
    // candidate action buttons by id/text
    const sel = '#checkout_btn, #add_to_cart_confirm, #checkout-area, button';
    const offenders = [];
    document.querySelectorAll(sel).forEach(el => {
      const r = el.getBoundingClientRect();
      const label = (el.id || el.innerText || '').trim().slice(0, 30);
      if (r.width < 40 || r.height < 20) return;            // ignore tiny controls
      if (r.bottom <= 0 || r.top >= vh) return;             // offscreen
      const isCTA = /إتمام|اطلب|أضف|السلة|متابعة|تأكيد|checkout|cart|confirm/i.test(label) || ['checkout_btn','add_to_cart_confirm'].includes(el.id);
      if (!isCTA) return;
      // overlap if the button's lower half sits under the nav top
      if (navTop != null && r.bottom > navTop + 4 && r.top < vh) {
        offenders.push({ label, top: Math.round(r.top), bottom: Math.round(r.bottom), navTop: Math.round(navTop) });
      }
    });
    return { navTop: navTop != null ? Math.round(navTop) : null, vh, offenders };
  });
}

async function snap(page, name) {
  const shot = `${OUT}/ui_${name}.png`;
  await page.screenshot({ path: shot, fullPage: false });
  const probe = await overlapProbe(page);
  results.ui.push({ name, screenshot: shot, ...probe, overlap: probe.offenders.length > 0 });
  console.log(`UI ${name} -> navTop=${probe.navTop} offenders=${probe.offenders.length}`, probe.offenders);
  return shot;
}

async function verifyCustomerUI(browser) {
  const { ctx, page } = await freshPage(browser);
  try {
    await login(page, '+201000000001');
    await page.waitForSelector('#customer_main, #stitch_header', { timeout: 20000 });
    await sleep(2000);
    await snap(page, 'home');

    // Profile
    try { await page.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(e=>/الحساب|حسابي|الملف/.test(e.innerText)); if(b) b.click(); }); await sleep(1500); await snap(page, 'profile'); } catch(e){ console.log('profile nav fail', String(e).slice(0,120)); }

    // Wallet
    try { await page.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(e=>/المحفظة|محفظتي/.test(e.innerText)); if(b) b.click(); }); await sleep(1500); await snap(page, 'wallet'); } catch(e){ console.log('wallet nav fail', String(e).slice(0,120)); }

    // back home, open a restaurant -> product modal
    try {
      await page.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(e=>/الرئيسية|الرئيسيه/.test(e.innerText)); if(b) b.click(); });
      await sleep(1500);
      await page.evaluate(() => { const c=document.querySelector('[id^="restaurant_card"], .restaurant-card, a[href], [role="button"]'); });
      // click first restaurant-like card
      const opened = await page.evaluate(() => {
        const cards = [...document.querySelectorAll('div,button,a')].filter(e => e.getBoundingClientRect().width>120 && /مطعم|توصيل|دقيقة|★|\d/.test(e.innerText) && e.querySelector('img'));
        if (cards[0]) { cards[0].click(); return true; } return false;
      });
      await sleep(1800);
      await snap(page, 'restaurant');
      // open a product
      const prod = await page.evaluate(() => {
        const add = [...document.querySelectorAll('button')].find(e=>/أضف|إضافة|\+/.test(e.innerText));
        const card = document.querySelector('#menu_list > div, [id^="product"]');
        const t = (card || add); if (t) { t.click(); return true; } return false;
      });
      await sleep(1200);
      await snap(page, 'product_modal');
    } catch(e){ console.log('restaurant/product fail', String(e).slice(0,120)); }

    // Cart
    try { await page.evaluate(() => { const b=[...document.querySelectorAll('button,a')].find(e=>/السلة|سلة/.test(e.innerText)); if(b) b.click(); }); await sleep(1200); await snap(page, 'cart'); } catch(e){ console.log('cart fail', String(e).slice(0,120)); }

  } catch (e) {
    console.log('customer flow error', String(e).slice(0,200));
    try { await page.screenshot({ path: `${OUT}/ui_ERROR.png` }); } catch {}
  }
  await ctx.close();
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  await verifyAdmin(browser, 'EG Country Admin', '+201000000004', false);
  await verifyAdmin(browser, 'SA Country Admin', '+966500000004', false);
  await verifyAdmin(browser, 'Super Admin', '+201000000005', true);
  await verifyCustomerUI(browser);
  await browser.close();
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  console.log('\n=== RESULTS WRITTEN ===');
  console.log(JSON.stringify(results.admins.map(a => ({ label: a.label, design: a.designCenter, campaign: a.campaignCenter, expectSuper: a.expectSuper, pass: a.pass, err: a.error })), null, 2));
})();
