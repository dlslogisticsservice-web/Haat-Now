const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const OUT = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT);

const FAKE_USER = {
  id: '00000000-0000-0000-0000-000000000001',
  aud: 'authenticated', role: 'authenticated',
  phone: '+966501234567', email: null,
  phone_confirmed_at: '2024-01-01T00:00:00Z',
  confirmed_at: '2024-01-01T00:00:00Z',
  last_sign_in_at: '2024-06-01T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  app_metadata: { provider: 'phone', providers: ['phone'] },
  user_metadata: { phone_number: '+966501234567', full_name: 'محمد العمري', role: 'customer' },
  identities: [], factors: [],
};
const FAKE_SESSION_OBJ = {
  access_token: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwicm9sZSI6ImF1dGhlbnRpY2F0ZWQiLCJpc3MiOiJodHRwczovL3Rlc3Quc3VwYWJhc2UuY28vYXV0aC92MSIsImV4cCI6OTk5OTk5OTk5OX0.fake',
  refresh_token: 'fake_refresh', token_type: 'bearer',
  expires_in: 3600, expires_at: 9999999999, user: FAKE_USER,
};
const FAKE_PROFILE = {
  id: '00000000-0000-0000-0000-000000000002',
  user_id: '00000000-0000-0000-0000-000000000001',
  phone_number: '+966501234567', full_name: 'محمد العمري',
  role: 'customer', avatar_url: null, email: null,
  created_at: '2024-01-01T00:00:00Z', updated_at: '2024-01-01T00:00:00Z',
};
const MOCK_BRANCHES = [
  { id: 'b1', name: 'جليلة', merchant_id: 'm1', zone_id: 'z1', is_active: true, merchants: { business_name: 'مطعم جليلة', logo_url: null }, zones: { name: 'العليا' } },
  { id: 'b2', name: 'مايسترو', merchant_id: 'm2', zone_id: 'z1', is_active: true, merchants: { business_name: 'مايسترو بيتزا', logo_url: null }, zones: { name: 'الملقا' } },
];
const MOCK_PRODUCTS = [
  { id: 'p1', name: 'شاورما دجاج فاخرة', description: 'شاورما دجاج مع صوص الثوم وخضروات طازجة', price: 35.00, product_images: [{ url: 'https://images.unsplash.com/photo-1561651823-34feb02250e4?auto=format&fit=crop&q=80&w=400' }], product_variants: [] },
  { id: 'p2', name: 'برجر لحم واغيو', description: 'لحم واغيو أصلي مع جبنة شيدر وصوص خاص', price: 65.00, product_images: [{ url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400' }], product_variants: [] },
  { id: 'p3', name: 'سلطة يونانية', description: 'طازجة مع زيتون وجبنة فيتا وزيت زيتون بكر', price: 28.00, product_images: [{ url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=400' }], product_variants: [] },
];

const BASE_INJECT = `
(function() {
  const origFetch = window.fetch.bind(window);
  function makeResponse(data, status) {
    return new Response(JSON.stringify(data), { status: status||200, headers:{'Content-Type':'application/json'} });
  }
  window.fetch = async function(input, init) {
    const url = typeof input==='string' ? input : (input&&input.url ? input.url : '');
    if (url.includes('/auth/v1/token')) return makeResponse(${JSON.stringify({...FAKE_SESSION_OBJ, user: FAKE_USER})});
    if (url.includes('/auth/v1/user'))  return makeResponse(${JSON.stringify(FAKE_USER)});
    if (url.includes('/auth/v1/'))      return makeResponse({user:${JSON.stringify(FAKE_USER)},session:${JSON.stringify(FAKE_SESSION_OBJ)}});
    if (url.includes('/rest/v1/profiles')) {
      const hdrs=(init&&init.headers)||{};
      let accept=typeof hdrs.get==='function'?(hdrs.get('Accept')||''):(hdrs['Accept']||'');
      return accept.includes('vnd.pgrst.object') ? makeResponse(${JSON.stringify(FAKE_PROFILE)}) : makeResponse([${JSON.stringify(FAKE_PROFILE)}]);
    }
    if (url.includes('/rest/v1/merchant_branches')) return makeResponse(${JSON.stringify(MOCK_BRANCHES)});
    if (url.includes('/rest/v1/products')) return makeResponse(${JSON.stringify(MOCK_PRODUCTS)});
    if (url.includes('/rest/v1/banners')) return makeResponse([]);
    if (url.includes('/rest/v1/offers'))  return makeResponse([]);
    if (url.includes('/rest/v1/wallet_transactions')) return makeResponse([]);
    if (url.includes('/rest/v1/wallets')) {
      const hdrs=(init&&init.headers)||{};
      let accept=typeof hdrs.get==='function'?(hdrs.get('Accept')||''):(hdrs['Accept']||'');
      const W={id:'w1',owner_type:'customer',owner_id:'00000000-0000-0000-0000-000000000001',balance:245.50,currency:'SAR'};
      return accept.includes('vnd.pgrst.object') ? makeResponse(W) : makeResponse([W]);
    }
    if (url.includes('/rest/v1/payment_methods')) return makeResponse([]);
    if (url.includes('/rest/v1/orders')) return makeResponse([]);
    if (url.includes('/rest/v1/')) return makeResponse([]);
    return origFetch(input, init);
  };
  try {
    localStorage.setItem('haat_onboarding_done','1');
    localStorage.setItem('haat_session', JSON.stringify({id:'00000000-0000-0000-0000-000000000001',phone_number:'+966501234567',role:'customer'}));
  } catch(e) {}
})();
`;

const delay = ms => new Promise(r => setTimeout(r, ms));
async function shot(page, name) {
  await delay(600);
  const file = path.join(OUT, `audit_${name}.png`);
  await page.screenshot({ path: file, type: 'png', fullPage: false });
  console.log('✓', name);
}

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-gpu','--disable-dev-shm-usage'],
  });

  try {
    // ── HOME ──────────────────────────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(BASE_INJECT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      await shot(page, 'home_top');
      await page.evaluate(() => window.scrollBy(0, 160));
      await delay(300);
      await shot(page, 'home_mid');
      await page.evaluate(() => window.scrollBy(0, 480));
      await delay(300);
      await shot(page, 'home_bottom');
      await page.close();
    }

    // ── RESTAURANT (with mock products) ──────────────────────────
    {
      const page = await browser.newPage();
      page.on('console', m => { if (m.type()==='error') console.log('ERR:', m.text()); });
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(BASE_INJECT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      // Click first restaurant card
      const clicked = await page.evaluate(() => {
        const allBtns = [...document.querySelectorAll('button, [role="button"]')];
        for (const el of allBtns) {
          const txt = el.textContent || '';
          if (txt.includes('جليلة') || txt.includes('مايسترو')) { el.click(); return txt.slice(0,30); }
        }
        // Fallback: click any card
        const cards = document.querySelectorAll('[id^="rest_card_"]');
        if (cards.length) { cards[0].click(); return 'rest_card'; }
        return 'not found';
      });
      console.log('  Clicked:', clicked);
      await delay(3000);
      await shot(page, 'restaurant_top');
      await page.evaluate(() => window.scrollBy(0, 340));
      await delay(400);
      await shot(page, 'restaurant_menu');
      await page.close();
    }

    // ── CHECKOUT (inject cart items) ──────────────────────────────
    {
      const page = await browser.newPage();
      page.on('console', m => { if (m.type()==='error') console.log('ERR:', m.text()); });
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      const injectCart = BASE_INJECT + `
try {
  localStorage.setItem('haat_cart', JSON.stringify({
    branchId:'b1', branchName:'مطعم جليلة',
    items:[
      {id:'p1',product:{id:'p1',name:'شاورما دجاج فاخرة',price:35},variant:null,quantity:2,note:''},
      {id:'p2',product:{id:'p2',name:'برجر لحم واغيو',price:65},variant:null,quantity:1,note:''},
    ]
  }));
} catch(e) {}
`;
      await page.evaluateOnNewDocument(injectCart);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      // Try to reach checkout through restaurant → cart pill
      const r = await page.evaluate(() => {
        const allBtns = [...document.querySelectorAll('button')];
        for (const el of allBtns) {
          if ((el.textContent||'').includes('جليلة') || (el.textContent||'').includes('مايسترو')) { el.click(); return 'restaurant'; }
        }
        return 'home';
      });
      await delay(2500);
      // Now try the floating cart pill or checkout button
      const r2 = await page.evaluate(() => {
        const pill = document.querySelector('#floating_cart_pill');
        if (pill) { pill.click(); return 'pill'; }
        const btns = [...document.querySelectorAll('button')];
        for (const b of btns) {
          if ((b.textContent||'').includes('السلة') || (b.textContent||'').includes('الدفع')) { b.click(); return b.textContent.slice(0,20); }
        }
        return 'none';
      });
      console.log('  Checkout nav:', r, '->', r2);
      await delay(3000);
      await shot(page, 'checkout');
      await page.close();
    }

    // ── ORDERS ────────────────────────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(BASE_INJECT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      const r = await page.evaluate(() => {
        const btn = document.querySelector('#nav_orders');
        if (btn) { btn.click(); return 'orders nav'; }
        const btns = [...document.querySelectorAll('button')];
        for (const b of btns) {
          if ((b.textContent||'').includes('الطلبات') || (b.textContent||'').includes('طلباتي')) { b.click(); return b.textContent.slice(0,20); }
        }
        return 'not found';
      });
      console.log('  Orders nav:', r);
      await delay(3000);
      await shot(page, 'orders');
      await page.close();
    }

    // ── WALLET ────────────────────────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(BASE_INJECT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      const r = await page.evaluate(() => {
        const btn = document.querySelector('#nav_wallet');
        if (btn) { btn.click(); return 'wallet nav'; }
        return 'not found';
      });
      console.log('  Wallet nav:', r);
      await delay(3000);
      await shot(page, 'wallet');
      await page.close();
    }

    // ── PROFILE ───────────────────────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(BASE_INJECT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4500);
      const r = await page.evaluate(() => {
        const btn = document.querySelector('#nav_profile');
        if (btn) { btn.click(); return 'profile nav'; }
        return 'not found';
      });
      console.log('  Profile nav:', r);
      await delay(3000);
      await shot(page, 'profile');
      await page.close();
    }

    console.log('\nAudit screenshots done. Output:', OUT);
  } catch(err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
