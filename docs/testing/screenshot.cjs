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

// Fetch interceptor injected before page scripts run
const INJECTED_SCRIPT = `
(function() {
  const origFetch = window.fetch.bind(window);

  function makeResponse(data, status) {
    return new Response(JSON.stringify(data), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  window.fetch = async function(input, init) {
    const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

    // ── Supabase Auth endpoints ──────────────────────────────────────
    if (url.includes('/auth/v1/token')) {
      return makeResponse(${JSON.stringify({ ...FAKE_SESSION_OBJ, user: FAKE_USER })});
    }
    if (url.includes('/auth/v1/user')) {
      return makeResponse(FAKE_USER);
    }
    if (url.includes('/auth/v1/')) {
      return makeResponse({ user: FAKE_USER, session: ${JSON.stringify(FAKE_SESSION_OBJ)} });
    }

    // ── REST API endpoints ──────────────────────────────────────────
    if (url.includes('/rest/v1/profiles')) {
      const hdrs = (init && init.headers) || {};
      let accept = '';
      if (typeof hdrs.get === 'function') { accept = hdrs.get('Accept') || hdrs.get('accept') || ''; }
      else { accept = hdrs['Accept'] || hdrs['accept'] || ''; }
      return accept.includes('vnd.pgrst.object')
        ? makeResponse(${JSON.stringify(FAKE_PROFILE)})
        : makeResponse([${JSON.stringify(FAKE_PROFILE)}]);
    }
    if (url.includes('/rest/v1/merchant_branches')) {
      return makeResponse(${JSON.stringify(MOCK_BRANCHES)});
    }
    if (url.includes('/rest/v1/banners')) { return makeResponse([]); }
    if (url.includes('/rest/v1/offers')) { return makeResponse([]); }
    if (url.includes('/rest/v1/wallet_transactions')) { return makeResponse([]); }
    if (url.includes('/rest/v1/wallets')) {
      // Supabase .single() sends Accept: application/vnd.pgrst.object+json — needs plain object
      const hdrs = (init && init.headers) || {};
      let accept = '';
      if (typeof hdrs.get === 'function') { accept = hdrs.get('Accept') || hdrs.get('accept') || ''; }
      else { accept = hdrs['Accept'] || hdrs['accept'] || ''; }
      const WALLET = { id: 'w1', owner_type: 'customer', owner_id: '00000000-0000-0000-0000-000000000001', balance: 245.50, currency: 'SAR' };
      return accept.includes('vnd.pgrst.object') ? makeResponse(WALLET) : makeResponse([WALLET]);
    }
    if (url.includes('/rest/v1/payment_methods')) { return makeResponse([]); }
    if (url.includes('/rest/v1/orders')) { return makeResponse([]); }
    if (url.includes('/rest/v1/')) { return makeResponse([]); }

    return origFetch(input, init);
  };

  // Skip onboarding + inject HAAT session (the app reads haat_session, not Supabase's key)
  try {
    localStorage.setItem('haat_onboarding_done', '1');
    localStorage.setItem('haat_session', JSON.stringify({
      id: '00000000-0000-0000-0000-000000000001',
      phone_number: '+966501234567',
      role: 'customer',
    }));
  } catch(e) {}
})();
`;

async function shot(page, name) {
  await new Promise(r => setTimeout(r, 300));
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, type: 'png', fullPage: false });
  console.log('✓', name);
  return file;
}

async function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  try {
    // ── SPLASH (no auth, capture before fade-out) ──────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(1200);
      await shot(page, '00_splash_screen');
      await page.close();
    }

    // ── ONBOARDING (no auth) ────────────────────────────────────────
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      // Wait for splash to finish (splash lasts ~2.5s) then capture onboarding slide 1
      await delay(3500);
      await shot(page, '01_onboarding_slide1_lime');

      const btn = await page.$('.onboarding-cta');
      if (btn) { await btn.click(); await delay(400); }
      await shot(page, '02_onboarding_slide2_lime');

      const btn2 = await page.$('.onboarding-cta');
      if (btn2) { await btn2.click(); await delay(400); }
      await shot(page, '03_onboarding_slide3_lime');
      await page.close();
    }

    // ── AUTHENTICATED SCREENS ────────────────────────────────────────
    // Capture page console errors
    const pageErrors = [];

    // Home screen
    {
      const page = await browser.newPage();
      page.on('console', msg => { if (msg.type() === 'error') pageErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err.message));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(INJECTED_SCRIPT);
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);
      await shot(page, '04_home_screen');
      await page.evaluate(() => window.scrollBy(0, 120));
      await delay(200);
      await shot(page, '05_home_merchants_grid');
      if (pageErrors.length) console.log('Page errors (home):', pageErrors.slice(0, 5));
      await page.close();
    }

    // Wallet screen — fresh page, start directly on wallet via localStorage
    {
      const page = await browser.newPage();
      page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });
      page.on('pageerror', err => console.log('PAGE ERR:', err.message));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      // Same injection but skip directly to wallet by queuing nav click after boot
      const walletScript = INJECTED_SCRIPT + `
window.__TARGET_SCREEN__ = 'wallet';
`;
      await page.evaluateOnNewDocument(walletScript);
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);
      // Now click wallet nav
      const walletBtn = await page.$('#nav_wallet');
      console.log('Wallet btn:', !!walletBtn);
      if (walletBtn) {
        await walletBtn.click();
        await delay(5000);
      }
      await shot(page, '06_wallet_screen');
      await page.close();
    }

    // Profile screen — fresh page
    {
      const page = await browser.newPage();
      page.on('console', msg => { if (msg.type() === 'error') console.log('CONSOLE ERR:', msg.text()); });
      page.on('pageerror', err => console.log('PAGE ERR:', err.message));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(INJECTED_SCRIPT);
      await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded', timeout: 15000 });
      await delay(4000);
      const profileBtn = await page.$('#nav_profile');
      console.log('Profile btn:', !!profileBtn);
      if (profileBtn) {
        await profileBtn.click();
        await delay(4000);
      }
      await shot(page, '07_profile_screen');
      await page.close();
    }

    console.log('\nDone. Screenshots in:', OUT);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
