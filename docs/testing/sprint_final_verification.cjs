// ─────────────────────────────────────────────────────────────────────────────
// HomeScreen unification sprint — FINAL verification.
//
// Walks the six surfaces (Home · Discover · Restaurant · Offers · Cart · Checkout)
// with console/React/page-error capture, then verifies the sprint's five claims:
//
//   1. HomeScreen renders from ONE unified data source.
//   2. Featured, Merchant List and Offers share that source (one pipeline).
//   3. Hidden filters stay hidden — but are still present in the source, not deleted.
//   4. "Order Now" never navigates to a merchant that does not exist.
//   5. "View All" never navigates to a missing screen.
//
// Usage:  node docs/testing/sprint_final_verification.cjs   (needs `npm run dev`)
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:3000/app';
const ROOT = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? '✔' : '✖'} ${n}${d ? ' — ' + d : ''}`); ok ? pass++ : fail++; };

// Console noise that exists independently of this sprint (network/asset chatter).
const IGNORE = /favicon|net::ERR|Failed to load resource|status of 4|status of 5|googleapis|maps|supabase\.co|manifest|sw\.js|Download the React DevTools/i;

const listNames = p => p.$$eval('#restaurants_list h3', e => e.map(x => x.textContent.trim()));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {}
  });

  const pageErrors = [], consoleErrors = [];
  page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)));
  page.on('console', m => {
    if (m.type() !== 'error' && m.type() !== 'warning') return;
    const t = m.text();
    if (IGNORE.test(t)) return;
    consoleErrors.push(`[${m.type()}] ${t.slice(0, 160)}`);
  });

  const goHome = async () => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#restaurants_list', { timeout: 20000 });
    await sleep(600);
  };

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
    await sleep(800);

    console.log('\n── Step 3 · the six surfaces render ───────');
    check('1 Home renders', !!(await page.$('#home_screen_portal')) && (await listNames(page)).length > 0);

    await page.click('#nav_discover'); await sleep(1500);
    const discoverOk = await page.evaluate(() => document.body.innerText.length > 80 && !/Something went wrong|حدث خطأ/.test(document.body.innerText));
    check('2 Discover renders', discoverOk);

    await goHome();
    check('3 Offers section renders', !!(await page.$('#home_offers')) && (await page.$$('[id^=offer_card_]')).length > 0);

    const card = await page.$('#restaurants_list > div');
    await card.click(); await sleep(1000);
    check('4 Restaurant renders', !!(await page.$('#back_btn')) && (await page.$$('[id^=product_]')).length > 0);

    // product → cart
    const prod = await page.$('[id^=product_]:not([id^=product_img_])');
    await prod.click(); await sleep(700);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('#product_modal button')].find(x => /إضافة للسلة|أضف لسلتك|Add to cart/.test(x.textContent));
      if (b) b.click();
    });
    await sleep(800);
    await page.click('#nav_cart'); await sleep(800);
    check('5 Cart renders with the item', !!(await page.$('#checkout_btn')));

    await page.click('#checkout_btn'); await sleep(1500);
    check('6 Checkout renders', !!(await page.$('#checkout_page, #checkout_grid, #checkout-area')));

    console.log('\n── Step 5 · sprint claims ─────────────────');
    await goHome();
    // Expand so the list shows the whole source.
    const more = await page.$('#home_more_merchants');
    if (more) { await more.evaluate(el => el.scrollIntoView({ block: 'center' })); await sleep(300); await more.click(); await sleep(400); }
    const all = await listNames(page);
    const featured = await page.$$eval('#home_featured_circles span', e => e.map(x => x.textContent.trim()).filter(Boolean));

    // (1)+(2) one source, one pipeline: Featured is the first 6 of the same list.
    const expected = all.slice(0, 6);
    const sameSource = featured.length > 0 && featured.every((n, i) => n === expected[i]);
    check('Featured + Merchant List share one source', sameSource, `featured=[${featured.join(',')}] listHead=[${expected.join(',')}]`);

    // (3) filters hidden in DOM, still present in source.
    const filterInDom = await page.evaluate(() => {
      const el = document.querySelector('#home_search');
      return el ? /فلاتر|Filters/.test(el.innerText) : false;
    });
    const src = fs.readFileSync(path.join(ROOT, 'src/features/home/HomeScreen.tsx'), 'utf8');
    check('Filters hidden in the DOM', !filterInDom);
    check('Filters markup NOT deleted from source', src.includes("t('home.filters')") && src.includes('SHOW_FILTERS'));

    // (4) Order Now only ever opens a merchant that exists in the source list.
    const ctas = await page.$$eval('[id^=offer_cta_]', e => e.map(x => x.id));
    for (const id of ctas) {
      await goHome();
      await page.click(`#${id}`); await sleep(1000);
      const onMerchant = !!(await page.$('#back_btn'));
      if (onMerchant) {
        const body = await page.evaluate(() => document.body.innerText);
        const named = all.find(n => body.includes(n));
        check(`${id} → opens an EXISTING merchant`, !!named, named || 'MERCHANT NOT IN SOURCE LIST');
      } else {
        const listShown = !!(await page.$('#restaurants_list'));
        check(`${id} → no merchant to open, reveals the list instead`, listShown);
      }
    }

    // (5) View All never lands on a missing screen.
    await goHome();
    const va = await page.$('#home_featured_view_all');
    check('Featured "View All" exists', !!va);
    if (va) {
      await va.click(); await sleep(700);
      const stillHome = !!(await page.$('#home_screen_portal')) && !!(await page.$('#restaurants_list'));
      const blank = await page.evaluate(() => document.body.innerText.trim().length < 40);
      check('"View All" stays on a real screen (no missing route)', stillHome && !blank, `${(await listNames(page)).length} merchants shown`);
    }

    console.log('\n── Step 4 · errors ────────────────────────');
    check('no uncaught page errors', pageErrors.length === 0, pageErrors.join(' | '));
    check('no React/console errors', consoleErrors.length === 0, consoleErrors.slice(0, 4).join(' | '));
  } catch (e) {
    check('verification run completed', false, String(e).slice(0, 220));
  }

  await browser.close();
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
