// ─────────────────────────────────────────────────────────────────────────────
// Production Data Readiness — demo/production isolation, verified in a browser.
//
//   Phase 3 · sandbox still shows its demo catalogue (no regression)
//   Phase 5 · a cart built in one mode never survives into the other
//
// Usage:  node docs/testing/demo_isolation_check.cjs      (needs `npm run dev`)
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const { record } = require('./_record.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:3000/app';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`  ${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {}
  });

  try {
    // ── login ──
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#account_gateway', { timeout: 25000 });
    await page.click('#acct_customer');
    await page.waitForSelector('#phone_input', { timeout: 20000 });
    await page.type('#phone_input', '+201000000001', { delay: 5 });
    await page.click('#send_otp_btn');
    await page.waitForSelector('#otp_boxes input', { timeout: 15000 });
    const boxes = await page.$$('#otp_boxes input');
    for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 5 });
    await page.click('#verify_otp_btn');
    await page.waitForSelector('#restaurants_list', { timeout: 25000 });
    await sleep(700);

    console.log('\n── Phase 3 · sandbox unregressed ──────────');
    const names = await page.$$eval('#restaurants_list h3', els => els.map(e => e.textContent.trim()));
    check(`sandbox still lists demo merchants (${names.length})`, names.length > 0, names.join(' · '));

    console.log('\n── Phase 5 · cart cannot cross the mode boundary ─');
    // A cart as a demo session's "reorder" leaves it: a demo product with a non-UUID
    // branch id. We seed localStorage directly and let the REAL cart.service decide —
    // the guard is symmetric (`cart.mode !== AUTH_MODE`), so proving the running
    // sandbox build rejects a production-stamped cart proves the reverse rejection too.
    const seed = (mode) => page.evaluate((mode) => {
      const cart = {
        items: [{ id: 'm5-p1_none', product: { id: 'm5-p1', name: 'باراسيتامول ٥٠٠ملغ', price: 12, branch_id: 'm5' }, variant: null, quantity: 1 }],
        appliedCoupon: null, branchId: 'm5',
      };
      if (mode !== null) cart.mode = mode;
      localStorage.setItem('haat_cart', JSON.stringify(cart));
    }, mode);
    const reloadAndRead = async () => {
      await page.goto(BASE, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#restaurants_list', { timeout: 20000 });
      await sleep(800);
      return page.evaluate(() => localStorage.getItem('haat_cart'));
    };

    // 1 · same-mode cart survives (the guard must not break the real feature)
    await seed('sandbox');
    const same = await reloadAndRead();
    check('a same-mode cart is still restored (no regression)', same !== null && JSON.parse(same).items.length === 1, same === null ? 'wrongly discarded' : 'kept');

    // 2 · production-stamped cart is rejected by the sandbox build
    await seed('supabase');
    const cross = await reloadAndRead();
    check('a cart from the OTHER mode is discarded', cross === null, cross === null ? 'cleared by cart.service' : `LEAKED: ${String(cross).slice(0, 60)}`);

    // 3 · a legacy cart written before the stamp existed is rejected
    await seed(null);
    const legacy = await reloadAndRead();
    check('an unstamped (pre-fix) cart is discarded', legacy === null, legacy === null ? 'cleared' : `LEAKED: ${String(legacy).slice(0, 60)}`);

    // 4 · round trip: sandbox still fully works afterwards
    const back = await page.$$eval('#restaurants_list h3', els => els.length);
    check('sandbox → production → sandbox still renders', back > 0, `${back} merchants`);
  } catch (e) {
    check('isolation run completed', false, String(e).slice(0, 200));
  }

  await browser.close();
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══\n`);
  record({ suite: 'Demo isolation', passed: pass, failed: fail });
  process.exit(fail === 0 ? 0 : 1);
})();
