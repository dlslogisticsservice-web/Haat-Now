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
  expires_in: 3600, expires_at: 9999999999,
  user: FAKE_USER,
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
  { id: 'b3', name: 'قهوة التميمي', merchant_id: 'm3', zone_id: 'z2', is_active: true, merchants: { business_name: 'قهوة التميمي', logo_url: null }, zones: { name: 'النرجس' } },
  { id: 'b4', name: 'صيدلية الدواء', merchant_id: 'm4', zone_id: 'z2', is_active: true, merchants: { business_name: 'صيدلية الدواء', logo_url: null }, zones: { name: 'السليمانية' } },
  { id: 'b5', name: 'التميمي سوبرماركت', merchant_id: 'm5', zone_id: 'z3', is_active: true, merchants: { business_name: 'التميمي', logo_url: null }, zones: { name: 'الغدير' } },
  { id: 'b6', name: 'مليون قهوة', merchant_id: 'm6', zone_id: 'z3', is_active: true, merchants: { business_name: 'مليون قهوة', logo_url: null }, zones: { name: 'حطين' } },
];

const INJECTED_SCRIPT = `
(function() {
  const origFetch = window.fetch.bind(window);
  function makeResponse(data, status) {
    return new Response(JSON.stringify(data), { status: status || 200, headers: { 'Content-Type': 'application/json' } });
  }
  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
    if (url.includes('/auth/v1/token')) return makeResponse(${JSON.stringify({ ...FAKE_SESSION_OBJ, user: FAKE_USER })});
    if (url.includes('/auth/v1/user')) return makeResponse(${JSON.stringify(FAKE_USER)});
    if (url.includes('/auth/v1/')) return makeResponse({ user: ${JSON.stringify(FAKE_USER)}, session: ${JSON.stringify(FAKE_SESSION_OBJ)} });
    if (url.includes('/rest/v1/profiles')) {
      const hdrs = (init && init.headers) || {};
      let accept = typeof hdrs.get === 'function' ? (hdrs.get('Accept') || '') : (hdrs['Accept'] || '');
      return accept.includes('vnd.pgrst.object') ? makeResponse(${JSON.stringify(FAKE_PROFILE)}) : makeResponse([${JSON.stringify(FAKE_PROFILE)}]);
    }
    if (url.includes('/rest/v1/merchant_branches')) return makeResponse(${JSON.stringify(MOCK_BRANCHES)});
    if (url.includes('/rest/v1/banners')) return makeResponse([]);
    if (url.includes('/rest/v1/offers')) return makeResponse([]);
    if (url.includes('/rest/v1/wallet_transactions')) return makeResponse([]);
    if (url.includes('/rest/v1/wallets')) {
      const hdrs = (init && init.headers) || {};
      let accept = typeof hdrs.get === 'function' ? (hdrs.get('Accept') || '') : (hdrs['Accept'] || '');
      const W = { id: 'w1', owner_type: 'customer', owner_id: '00000000-0000-0000-0000-000000000001', balance: 245.50, currency: 'SAR' };
      return accept.includes('vnd.pgrst.object') ? makeResponse(W) : makeResponse([W]);
    }
    if (url.includes('/rest/v1/payment_methods')) return makeResponse([]);
    if (url.includes('/rest/v1/orders')) return makeResponse([]);
    if (url.includes('/rest/v1/')) return makeResponse([]);
    return origFetch(input, init);
  };
  try {
    localStorage.setItem('haat_onboarding_done', '1');
    localStorage.setItem('haat_session', JSON.stringify({ id: '00000000-0000-0000-0000-000000000001', phone_number: '+966501234567', role: 'customer' }));
  } catch(e) {}
})();
`;

async function shot(page, name) {
  await new Promise(r => setTimeout(r, 400));
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, type: 'png', fullPage: false });
  console.log('✓', name);
}
const delay = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    // ── Home BOTTOM (scroll far down) ──────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(INJECTED_SCRIPT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);
      // Scroll to bottom of page content
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(300);
      await shot(page, 'extra_home_bottom');
      await page.close();
    }

    // ── Restaurant screen (click first merchant card) ──────────────
    {
      const page = await browser.newPage();
      page.on('console', msg => { if (msg.type() === 'error') console.log('ERR:', msg.text()); });
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(INJECTED_SCRIPT);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);

      // Try to click the first restaurant/merchant card
      const clicked = await page.evaluate(() => {
        // Look for restaurant cards or clickable merchant cards
        const candidates = [
          ...document.querySelectorAll('[id^="rest_card_"], [id^="merchant_card_"], [data-testid="restaurant-card"]'),
          ...document.querySelectorAll('.restaurant-card, .merchant-card'),
        ];
        // Fallback: find any card that looks like a restaurant entry
        const allCards = document.querySelectorAll('button, [role="button"]');
        for (const el of allCards) {
          const txt = el.textContent || '';
          if (txt.includes('جليلة') || txt.includes('بيتزا') || txt.includes('مايسترو')) {
            el.click();
            return `clicked: ${txt.slice(0,30)}`;
          }
        }
        if (candidates.length > 0) { candidates[0].click(); return 'clicked first'; }
        return 'not found';
      });
      console.log('Restaurant nav:', clicked);
      await delay(2500);
      await shot(page, 'extra_restaurant_screen');
      await page.close();
    }

    // ── Checkout screen ────────────────────────────────────────────
    {
      const page = await browser.newPage();
      page.on('console', msg => { if (msg.type() === 'error') console.log('ERR:', msg.text()); });
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      // Inject a cart in localStorage so checkout renders with items
      const checkoutScript = INJECTED_SCRIPT + `
try {
  localStorage.setItem('haat_cart', JSON.stringify({
    branchId: 'b1',
    branchName: 'مطعم جليلة',
    items: [
      { id: 'item1', name: 'شاورما دجاج', price: 35, quantity: 2, note: '' },
      { id: 'item2', name: 'بيبسي', price: 8, quantity: 1, note: '' },
    ],
  }));
} catch(e) {}
`;
      await page.evaluateOnNewDocument(checkoutScript);
      await page.goto('http://localhost:4173/app', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);

      // Try to navigate to checkout via nav or cart button
      const checkoutNav = await page.evaluate(() => {
        // Try clicking cart/orders nav item
        const cartBtn = document.querySelector('#nav_orders, [aria-label*="cart"], [aria-label*="طلب"], button[id*="cart"], button[id*="checkout"]');
        if (cartBtn) { cartBtn.click(); return 'nav clicked'; }
        // Try clicking any checkout button
        const allBtns = [...document.querySelectorAll('button')];
        for (const b of allBtns) {
          const t = b.textContent || '';
          if (t.includes('الطلبات') || t.includes('السلة') || t.includes('الدفع')) {
            b.click(); return `btn: ${t.slice(0,20)}`;
          }
        }
        return 'not found';
      });
      console.log('Checkout nav:', checkoutNav);
      await delay(2500);
      await shot(page, 'extra_checkout_screen');
      await page.close();
    }

    console.log('\nExtra screenshots done. Output:', OUT);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
})();
