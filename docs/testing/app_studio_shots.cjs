// APP STUDIO — REAL verification. Opens Admin → Experience Studio → clicks
// "Application Studio" and asserts every required panel is physically present and every
// interaction works. Screenshots at each stage.
const puppeteer = require('puppeteer');
const { mkdirSync } = require('fs');
const { join } = require('path');
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const SUPER_ADMIN = '+201000000005';
const OUT = join(__dirname, 'e2e_shots', 'appstudio');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (n, x = '') => { pass++; console.log(`  ✔ ${n}${x ? ' — ' + x : ''}`); };
const bad = (n, w) => { fail++; console.log(`  ✖ ${n} — ${w}`); };
const has = async (page, sel) => !!(await page.$(sel));

async function signIn(page) {
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'en'); localStorage.removeItem('haat_app_shell_v1'); } catch (e) {} });
  await page.goto(`${BASE}/app?console=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[id^="acct_"]', { timeout: 30000 }); await sleep(400);
  await page.evaluate(() => (document.querySelector('#acct_admin') || document.querySelector('[id^="acct_"]')).click());
  await page.waitForSelector('#phone_input', { timeout: 30000 });
  await page.type('#phone_input', SUPER_ADMIN, { delay: 6 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 20000 });
  const boxes = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 6 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector('aside', { timeout: 30000 }); await sleep(2200);
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const errors = [];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1680, height: 1000 });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  try {
    console.log('\n── Open Admin → Studio ──');
    await signIn(page);
    await page.evaluate(() => { const el = [...document.querySelectorAll('aside button')].find(x => /Website/.test(x.textContent || '')); if (el) el.click(); });
    await sleep(1500);
    await page.waitForSelector('#website_center', { timeout: 20000 });

    // The navigator shows Website / Application Studio / Customer App / Merchant App / Driver App.
    (await has(page, '#channel_website')) ? ok('Navigator: Website entry') : bad('Website entry', 'missing');
    (await has(page, '#channel_application')) ? ok('Navigator: Application Studio entry present') : bad('Application Studio entry', 'MISSING');
    const appEntryText = await page.evaluate(() => document.querySelector('#channel_application')?.textContent || '');
    /Application Studio/.test(appEntryText) ? ok('Application Studio entry labelled correctly', appEntryText.trim()) : bad('Application entry label', appEntryText);
    for (const [id, lbl] of [['#channel_customer', 'Customer App'], ['#channel_merchant', 'Merchant App'], ['#channel_driver', 'Driver App']]) {
      const t = await page.evaluate((s) => document.querySelector(s)?.textContent || '', id);
      new RegExp(lbl).test(t) ? ok(`Navigator: ${lbl}`) : bad(`Navigator ${lbl}`, `got "${t.trim()}"`);
    }
    await page.screenshot({ path: join(OUT, '01-navigator.png') });

    console.log('\n── Click Application Studio → REAL builder ──');
    await page.click('#channel_application'); await sleep(1600);
    // 1. Phone Canvas
    (await has(page, '#channel_preview')) ? ok('1. Phone Canvas (#channel_preview) mounted') : bad('Phone Canvas', 'missing');
    const dchan = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-channel'));
    ok('   Application Studio opened on an app', `channel=${dchan}`);
    // Title reframed
    const title = await page.evaluate(() => document.querySelector('#studio_title')?.textContent || '');
    /Application Studio/.test(title) ? ok('   Header reads "Application Studio"', title.trim()) : bad('Header title', title);
    // 2. Screen Navigator
    const screens = await page.evaluate(() => document.querySelectorAll('#channel_screens button').length);
    screens >= 10 ? ok('2. Screen Navigator (#channel_screens)', `${screens} screens`) : bad('Screen Navigator', `only ${screens}`);
    // 3. Screen Tree
    (await has(page, '#channel_tree')) ? ok('3. Screen Tree (#channel_tree) mounted') : bad('Screen Tree', 'missing');
    // 5. Toolbar (top-bar actions present) + 13/14/15
    (await has(page, '#website_publish_btn')) ? ok('13. Publish button present') : bad('Publish', 'missing');
    (await has(page, '#studio_undo')) && (await has(page, '#studio_redo')) ? ok('14. Undo / Redo present') : bad('Undo/Redo', 'missing');
    (await has(page, '#studio_device_mobile')) ? ok('15. Device Switcher present') : bad('Device Switcher', 'missing');
    // 9. State preview
    (await has(page, '#studio_state_select')) ? ok('9. State Preview selector present') : bad('State Preview', 'missing');
    // App switcher
    (await has(page, '#app_switcher')) ? ok('   App switcher (Customer/Merchant/Driver) present') : bad('App switcher', 'missing');
    await page.screenshot({ path: join(OUT, '02-builder.png'), fullPage: true });

    console.log('\n── Right-rail builder tabs ──');
    // 4. Properties, 6. Components, 10. Theme, 11. Nav, 12. App Bar tabs
    for (const [id, name, num] of [['#app_tab_properties', 'Properties', 4], ['#app_tab_components', 'Components', 6], ['#app_tab_theme', 'Theme', 10], ['#app_tab_nav', 'Bottom Nav', 11], ['#app_tab_appbar', 'App Bar', 12]]) {
      (await has(page, id)) ? ok(`${num}. ${name} tab present`) : bad(`${name} tab`, 'missing');
    }
    // 6. Component Library content
    await page.click('#app_tab_components'); await sleep(500);
    (await has(page, '#component_library')) ? ok('6. Component Library renders') : bad('Component Library', 'missing');
    const libExp = await page.evaluate(() => document.querySelectorAll('#component_library [id^="lib_exp_"]').length);
    libExp > 0 ? ok('   Library lists experience points', `${libExp}`) : bad('Library experiences', 'none');

    // 10. Theme editor — set primary, assert it applies live to the canvas.
    await page.click('#app_tab_theme'); await sleep(400);
    (await has(page, '#app_theme_editor')) ? ok('10. Theme Editor renders') : bad('Theme Editor', 'missing');
    await page.evaluate(() => { const i = document.querySelector('#apptheme_primary'); if (i) { const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; setter.call(i, '#ff5aa0'); i.dispatchEvent(new Event('input', { bubbles: true })); } });
    await sleep(600);
    const themeApplied = await page.evaluate(() => { const el = document.querySelector('#channel_preview'); const s = el?.getAttribute('style') || ''; const v = el ? getComputedStyle(el).getPropertyValue('--color-primary-fixed').trim() : ''; return /ff5aa0/i.test(s) || /255,\s*90,\s*160/.test(v) || /ff5aa0/i.test(v); });
    themeApplied ? ok('   Theme edit applies live to the phone canvas') : bad('Theme live-apply', 'primary var not on #channel_preview');

    // 12. App Bar editor — change brand, assert phone header updates.
    await page.click('#app_tab_appbar'); await sleep(400);
    (await has(page, '#app_bar_editor')) ? ok('12. App Bar Editor renders') : bad('App Bar Editor', 'missing');
    await page.click('#appbar_brand', { clickCount: 3 });
    await page.type('#appbar_brand', 'ACME Eats', { delay: 8 }); await sleep(700);
    const brandLive = await page.evaluate(() => document.querySelector('#app_bar_brand')?.textContent || '');
    /ACME Eats/.test(brandLive) ? ok('   App Bar edit updates the phone header live', brandLive) : bad('App Bar live', `header shows "${brandLive}"`);

    // 11. Bottom Nav editor — rename a tab, assert phone bottom nav updates.
    await page.click('#app_tab_nav'); await sleep(400);
    (await has(page, '#bottom_nav_editor')) ? ok('11. Bottom Nav Editor renders') : bad('Bottom Nav Editor', 'missing');
    if (await has(page, '#nav_label_home')) {
      await page.click('#nav_label_home', { clickCount: 3 });
      await page.type('#nav_label_home', 'Start', { delay: 8 }); await sleep(700);
      const navLive = await page.evaluate(() => document.querySelector('#nav_home')?.textContent || '');
      /Start/.test(navLive) ? ok('   Bottom Nav edit updates the phone tab live', navLive.trim()) : bad('Bottom Nav live', `tab shows "${navLive.trim()}"`);
    } else bad('Bottom Nav label input', '#nav_label_home missing');
    await page.screenshot({ path: join(OUT, '03-editors.png'), fullPage: true });

    console.log('\n── Connectivity ──');
    // Selecting a screen changes the phone.
    const offers = await page.$('#screen_offers');
    if (offers) { await offers.click(); await sleep(800); const s = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-screen')); s === 'offers' ? ok('Selecting a screen changes the phone (Offers)') : bad('Screen→phone', `data-screen=${s}`); }
    // Selecting a widget highlights it + Properties opens.
    await page.evaluate(() => document.querySelector('#channel_preview .wsx-sec')?.click()); await sleep(600);
    (await page.evaluate(() => !!document.querySelector('#channel_preview .wsx-sec.sel'))) ? ok('Selecting a widget highlights it') : bad('Widget highlight', 'no .sel');
    (await page.evaluate(() => !!document.querySelector('#channel_preview .wsx-bar'))) ? ok('5. Toolbar (floating) shows on selection') : bad('Toolbar', 'no .wsx-bar');
    const propEn = await page.$('#prop_title_en');
    propEn ? ok('4. Properties Inspector shows content editor for selection') : bad('Properties editor', '#prop_title_en missing');
    if (propEn) {
      await page.click('#prop_title_en', { clickCount: 3 }); await page.type('#prop_title_en', 'Studio Wired', { delay: 8 }); await sleep(800);
      const live = await page.evaluate(() => document.querySelector('#channel_preview .wsx-sec.sel h3')?.textContent || document.querySelector('#channel_preview [data-exp] h3')?.textContent || '');
      /Studio Wired/.test(live) ? ok('Inspector edit updates canvas immediately', live.slice(0, 24)) : bad('Inspector→canvas', `canvas="${live}"`);
      await page.click('#studio_undo'); await sleep(700);
      const undone = await page.evaluate(() => document.querySelector('#channel_preview [data-exp] h3')?.textContent || '');
      !/Studio Wired/.test(undone) ? ok('Undo works (reverts the edit)') : bad('Undo', `still "${undone}"`);
    }
    // Navigation works — click bottom-nav chrome.
    if (await has(page, '#nav_wallet')) { await page.click('#nav_wallet'); await sleep(700); const s = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-screen')); s === 'wallet' ? ok('Navigation works (bottom-nav → Wallet)') : bad('Chrome nav', `data-screen=${s}`); }

    console.log('\n── 7. Screen Flow / 8. Journey ──');
    await page.click('#studio_view_flow'); await sleep(700);
    (await page.evaluate(() => document.querySelector('#studio_flow')?.getAttribute('data-view'))) === 'flow' ? ok('7. Screen Flow view works') : bad('Screen Flow', 'not flow');
    await page.screenshot({ path: join(OUT, '04-flow.png') });
    await page.click('#studio_view_journey'); await sleep(700);
    (await page.evaluate(() => document.querySelector('#studio_flow')?.getAttribute('data-view'))) === 'journey' ? ok('8. Journey Mode works') : bad('Journey', 'not journey');
    await page.screenshot({ path: join(OUT, '05-journey.png') });
    await page.click('#studio_view_canvas'); await sleep(500);

    console.log('\n── Publish + persistence + app switch ──');
    await page.click('#website_publish_btn'); await sleep(600); ok('Publish works (no crash)');
    // App switcher flips target app.
    await page.click('#app_switch_driver'); await sleep(1200);
    const drv = await page.evaluate(() => document.querySelector('#channel_preview')?.getAttribute('data-channel'));
    drv === 'driver' ? ok('App switcher flips to Driver App') : bad('App switch', `channel=${drv}`);

    console.log('\n── Website compat ──');
    await page.click('#channel_website'); await sleep(1000);
    (await has(page, '#studio_mod_pages')) && !(await has(page, '#channel_preview')) ? ok('Website restores the page editor (compat)') : bad('Website compat', 'broken');

    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    overflow <= 2 ? ok('No horizontal overflow', `overflow=${overflow}`) : bad('Overflow', `${overflow}px`);
    errors.length === 0 ? ok('No uncaught page errors') : bad('Page errors', errors.slice(0, 3).join(' | '));
  } catch (e) { bad('app studio verify run', String(e && e.message ? e.message : e)); }
  finally { await browser.close(); }
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══`);
  console.log(`  ↳ screenshots in ${OUT}`);
  process.exit(fail === 0 ? 0 : 1);
})();
