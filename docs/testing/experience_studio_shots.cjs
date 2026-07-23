#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Experience Studio · multi-channel visual verification.
//
// The Website Studio is now the Experience Studio: one Studio, four channels. This
// signs in as super admin, opens the Studio, and verifies:
//   · the Experience Channels navigator exists (Website + Customer + Merchant + Driver)
//   · selecting each channel renders its real device preview with real engine surfaces
//   · the channel-aware inspector renders per channel
//   · returning to Website restores the existing page editor UNCHANGED (compat)
//
// Exists for the reason every visual suite here exists: tsc, tests and Guardian have
// all passed while a shipped admin surface crashed into an error boundary. A screen is
// verified only when something has looked at it.
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const { mkdirSync } = require('fs');
const { join } = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = join(__dirname, 'e2e_shots', 'studio');
const SUPER_ADMIN = '+201000000005';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (n, x = '') => { pass++; console.log(`  ✔ ${n}${x ? ' — ' + x : ''}`); };
const bad = (n, w) => { fail++; console.log(`  ✖ ${n} — ${w}`); };

async function signInAdmin(page) {
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'en'); } catch (e) {} });
  await page.goto(`${BASE}/app?console=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[id^="acct_"]', { timeout: 30000 });
  await sleep(400);
  await page.evaluate(() => (document.querySelector('#acct_admin') || document.querySelector('[id^="acct_"]')).click());
  await page.waitForSelector('#phone_input', { timeout: 30000 });
  await page.type('#phone_input', SUPER_ADMIN, { delay: 6 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 20000 });
  const boxes = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 6 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector('aside', { timeout: 30000 });
  await sleep(2200);
}

const clickSidebar = async (page, txt) => {
  const found = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('aside button')].find(x => x.textContent && x.textContent.includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, txt);
  await sleep(1600);
  return found;
};

async function inspect(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { present: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { present: true, visible: cs.display !== 'none' && Number(cs.opacity) > 0.01, w: Math.round(r.width), h: Math.round(r.height), text: (el.innerText || '').trim().length };
  }, sel);
}

// Real engine surface = an ExperienceBanner/Hint rendered inside the channel preview.
async function surfaceCount(page) {
  return page.evaluate(() => document.querySelectorAll('#channel_preview .xp-surface, #channel_preview .xp-rise').length);
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const errors = [];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1000 });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  try {
    console.log('\n── Sign in & open Studio ─────────');
    await signInAdmin(page);
    const opened = await clickSidebar(page, 'Website');
    opened ? ok('Studio opens from the sidebar') : bad('Studio opens', 'sidebar item not found');
    await page.waitForSelector('#website_center', { timeout: 20000 });

    // The Studio is now titled "Experience Studio".
    const title = await page.evaluate(() => document.querySelector('#studio_title')?.textContent || '');
    /Experience Studio/.test(title) ? ok('Studio is titled "Experience Studio"') : bad('Studio title', `got: ${title}`);

    // The Experience Channels navigator with all four live channels.
    const nav = await inspect(page, '#experience_channels_nav');
    nav.present && nav.text > 0 ? ok('Experience Channels navigator present') : bad('Experience Channels navigator', 'absent');
    for (const c of ['website', 'customer', 'merchant', 'driver']) {
      const has = await page.$(`#channel_${c}`);
      has ? ok(`Channel entry: ${c}`) : bad(`Channel entry: ${c}`, 'missing');
    }
    const future = await page.evaluate(() => document.querySelectorAll('#future_channels [id^="channel_future_"]').length);
    future === 7 ? ok('Seven future channel placeholders shown', String(future)) : bad('Future channels', `expected 7, got ${future}`);

    // Website is the default — the existing page editor must be intact (compat).
    const websiteLeft = await page.$('#studio_mod_pages');
    websiteLeft ? ok('Website path intact — page/module navigator present') : bad('Website path intact', 'page navigator missing');

    // ── Customer channel ──
    console.log('\n── Customer channel ──────────────');
    await page.click('#channel_customer'); await sleep(1400);
    const custPrev = await inspect(page, '#channel_preview');
    custPrev.present && custPrev.visible && custPrev.h > 200 ? ok('Customer preview renders', `${custPrev.w}x${custPrev.h}`) : bad('Customer preview renders', JSON.stringify(custPrev));
    const custChan = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-channel'));
    custChan === 'customer' ? ok('Preview is the customer channel') : bad('Preview channel', `got ${custChan}`);
    // Home screen is selected by default and places the welcome experience via the real engine.
    const custSurfaces = await surfaceCount(page);
    custSurfaces > 0 ? ok('Real engine surface rendered on customer Home', `${custSurfaces} surface(s)`) : bad('Customer surface', 'no experience surface — engine not driving the preview');
    const custInspector = await inspect(page, '#channel_inspector');
    custInspector.present && custInspector.text > 0 ? ok('Customer inspector renders (Cards/Lists/Offers…)') : bad('Customer inspector', 'absent');
    // Screen list is navigable.
    const hasScreens = await page.evaluate(() => document.querySelectorAll('#channel_screens button').length);
    hasScreens >= 10 ? ok('Customer screen list present', `${hasScreens} screens`) : bad('Customer screens', `only ${hasScreens}`);
    await page.screenshot({ path: join(OUT, 'studio-customer.png') });

    // Switch to the Offers screen and confirm the preview re-decides.
    const offersBtn = await page.$('#screen_offers');
    if (offersBtn) { await offersBtn.click(); await sleep(900); const s = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-screen')); s === 'offers' ? ok('Screen switch re-renders preview (Offers)') : bad('Screen switch', `data-screen=${s}`); }
    else bad('Offers screen', 'button missing');

    // ── Merchant channel ──
    console.log('\n── Merchant channel ──────────────');
    await page.click('#channel_merchant'); await sleep(1400);
    const merPrev = await inspect(page, '#channel_preview');
    merPrev.present && merPrev.visible ? ok('Merchant portal preview renders', `${merPrev.w}x${merPrev.h}`) : bad('Merchant preview', JSON.stringify(merPrev));
    const merSurfaces = await surfaceCount(page);
    merSurfaces > 0 ? ok('Real engine surface on merchant Dashboard', `${merSurfaces} surface(s)`) : bad('Merchant surface', 'no experience surface');
    await page.screenshot({ path: join(OUT, 'studio-merchant.png') });

    // ── Driver channel ──
    console.log('\n── Driver channel ────────────────');
    await page.click('#channel_driver'); await sleep(1400);
    const drvPrev = await inspect(page, '#channel_preview');
    drvPrev.present && drvPrev.visible ? ok('Driver app preview renders', `${drvPrev.w}x${drvPrev.h}`) : bad('Driver preview', JSON.stringify(drvPrev));
    const drvSurfaces = await surfaceCount(page);
    drvSurfaces > 0 ? ok('Real engine surface on driver Home', `${drvSurfaces} surface(s)`) : bad('Driver surface', 'no experience surface');
    await page.screenshot({ path: join(OUT, 'studio-driver.png') });

    // ── Back to Website — compat ──
    console.log('\n── Website channel (compat) ──────');
    await page.click('#channel_website'); await sleep(1200);
    const backToPages = await page.$('#studio_mod_pages');
    const canvasBack = await page.$('#studio_canvas');
    const channelGone = await page.$('#channel_preview');
    backToPages && canvasBack && !channelGone ? ok('Website restores the existing page editor unchanged') : bad('Website restore', `pages=${!!backToPages} canvas=${!!canvasBack} channelPreviewStillThere=${!!channelGone}`);
    await page.screenshot({ path: join(OUT, 'studio-website.png') });

    // ── Cross-channel Marketing OS ──
    console.log('\n── Marketing OS · cross-channel ──');
    const openedMkt = await page.evaluate(() => { const el = [...document.querySelectorAll('#studio_left button')].find(b => /Campaigns|الحملات/.test(b.textContent || '')); if (el) { el.click(); return true; } return false; });
    await sleep(1000);
    if (openedMkt) {
      // Select/create a campaign so the editor (with the channel picker) shows.
      await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => /New campaign|حملة جديدة|\+/.test(b.textContent || '')); });
      await sleep(400);
      const picker = await page.$('#campaign_channels');
      picker ? ok('Campaign channel picker present (cross-channel targeting)') : bad('Campaign channel picker', 'not found — open a campaign to view');
    } else bad('Marketing OS opens', 'Campaigns nav not found');

    // ── VISUAL AUTHORING ── select → toolbar → inline edit → inspector → undo ──
    console.log('\n── Visual authoring (customer) ───');
    await page.click('#channel_customer'); await sleep(1200);

    // No mock scaffolding must remain (skeleton bars were removed).
    const surfaceEls = await page.evaluate(() => document.querySelectorAll('#channel_preview .wsx-sec').length);
    surfaceEls > 0 ? ok('Real experience surface mounted with authoring wrapper', `${surfaceEls}`) : bad('Authoring surface', 'no .wsx-sec surface found');

    // Select the surface → selection outline + floating toolbar appear.
    await page.evaluate(() => document.querySelector('#channel_preview .wsx-sec')?.click());
    await sleep(600);
    const selected = await page.evaluate(() => !!document.querySelector('#channel_preview .wsx-sec.sel'));
    selected ? ok('Clicking a surface selects it (selection outline)') : bad('Selection', 'no .sel class');
    const toolbar = await page.evaluate(() => !!document.querySelector('#channel_preview .wsx-bar'));
    toolbar ? ok('Floating toolbar shown on selection') : bad('Toolbar', 'no .wsx-bar');
    const breadcrumb = await page.evaluate(() => (document.querySelector('#channel_breadcrumbs')?.textContent || ''));
    /customer_welcome|Customer/.test(breadcrumb) ? ok('Breadcrumbs reflect selection', breadcrumb.trim().slice(0, 40)) : bad('Breadcrumbs', breadcrumb);

    // Select the OFFERS surface (no experiment-variant title) so the base-title edit is
    // what the canvas shows — a clean live-bind check.
    const hasOffers = await page.evaluate(() => { const el = document.querySelector('#channel_preview [data-exp="flag.customer_offers"]'); if (el) { el.click(); return true; } return false; });
    await sleep(600);
    const propEn = await page.$('#prop_title_en');
    (hasOffers && propEn) ? ok('Inspector shows content property editor for the selection') : bad('Property editor', '#prop_title_en missing');

    // Edit the title through the inspector → the offers surface updates (same source).
    if (propEn) {
      await page.click('#prop_title_en', { clickCount: 3 });
      await page.type('#prop_title_en', 'Authored in Studio', { delay: 8 });
      await sleep(1000);
      const canvasText = await page.evaluate(() => document.querySelector('#channel_preview [data-exp="flag.customer_offers"] h3')?.textContent || '');
      /Authored in Studio/.test(canvasText) ? ok('Inspector edit updates the canvas surface live', canvasText.slice(0, 30)) : bad('Live bind', `canvas shows: ${canvasText}`);
    }

    // Undo (the SAME top-bar button) reverts the content edit.
    await page.click('#studio_undo'); await sleep(1000);
    const afterUndo = await page.evaluate(() => document.querySelector('#channel_preview [data-exp="flag.customer_offers"] h3')?.textContent || '');
    afterUndo && !/Authored in Studio/.test(afterUndo) ? ok('Undo reverts the authored edit', afterUndo.slice(0, 30)) : bad('Undo', `still shows: ${afterUndo}`);

    // Lock prevents editing; hide removes from the preview.
    if (await page.$('#prop_toggle_lock')) {
      await page.click('#prop_toggle_lock'); await sleep(500);
      const locked = await page.evaluate(() => !!document.querySelector('#channel_preview .wsx-sec.locked'));
      locked ? ok('Lock marks the surface locked') : bad('Lock', 'no .locked class');
      await page.click('#prop_toggle_lock'); await sleep(300);
    }

    await page.screenshot({ path: join(OUT, 'studio-authoring.png'), fullPage: true });

    // Inline editing: double-click the title in the canvas makes it contentEditable.
    await page.evaluate(() => document.querySelector('#channel_preview .wsx-sec')?.click());
    await sleep(500);
    const editable = await page.evaluate(() => {
      const h = document.querySelector('#channel_preview .wsx-sec h3');
      return h ? h.getAttribute('contenteditable') === 'true' : false;
    });
    editable ? ok('Canvas title is inline-editable when selected') : bad('Inline edit', 'title not contentEditable');

    // ── Responsive & runtime ──
    console.log('\n── Responsive & runtime ──────────');
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    overflow <= 2 ? ok('No horizontal overflow', `overflow=${overflow}`) : bad('Horizontal overflow', `${overflow}px`);
    errors.length === 0 ? ok('No uncaught page errors across all channels') : bad('Page errors', errors.slice(0, 3).join(' | '));
  } catch (e) {
    bad('experience studio run completed', String(e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  console.log(`\n═══ ${pass} passed · ${fail} failed ═══`);
  console.log(`  ↳ screenshots in ${OUT}`);
  process.exit(fail === 0 ? 0 : 1);
})();
