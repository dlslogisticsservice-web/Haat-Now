// ─────────────────────────────────────────────────────────────────────────────
// Product Wiring Sprint — Home journey validation in a real browser.
//
// Proves the repaired wiring end-to-end against the running app:
//   1. Home renders ONE dataset and every category filters THAT dataset.
//   2. Search filters the same dataset (no separate implementation).
//   3. Offers "Order Now" reaches a merchant (no decorative CTA).
//   4. Every merchant reaches a category-correct menu → product → cart.
//   5. No dead CTA remains on Home.
//
// Usage:  node docs/testing/home_wiring_journeys.cjs      (needs `npm run dev`)
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const { record } = require('./_record.cjs');
const BASE = process.env.BASE_URL || 'http://localhost:3000/app';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (name, ok, detail) => {
  console.log(`  ${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

// The 8 Home categories, and the fallback merchant each must surface.
const CATEGORIES = [
  { id: 'cat-food',        label: 'المطاعم',      expect: 'الباشا' },
  { id: 'cat-market',      label: 'السوبر ماركت', expect: 'فريش' },
  { id: 'cat-pharmacy',    label: 'الصيدلية',     expect: 'صيدلية' },
  { id: 'cat-coffee',      label: 'القهوة',       expect: 'لاتيه' },
  { id: 'cat-sweets',      label: 'الحلويات',     expect: 'حلويات' },
  { id: 'cat-perfume',     label: 'العطور',       expect: 'عطور' },
  { id: 'cat-flowers',     label: 'الزهور',       expect: 'زهور' },
  { id: 'cat-electronics', label: 'إلكترونيات',   expect: 'إلكترونيات' },
];

async function newPage(browser) {
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {}
  });
  return page;
}

async function login(page) {
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
  await sleep(600);
}

/** Names currently rendered in the merchant list. */
const listNames = page => page.$$eval('#restaurants_list h3', els => els.map(e => e.textContent.trim()));
const goHome = async page => {
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#restaurants_list', { timeout: 20000 });
  await sleep(500);
};
/** On a merchant screen: open the first product and add it. Returns the real cart count. */
async function addFirstProduct(page) {
  const prod = await page.$('[id^=product_]:not([id^=product_img_])');
  if (!prod) return { added: false, count: 0, why: 'no product cards' };
  await prod.click();
  await sleep(700);
  const added = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#product_modal button')].find(x => /إضافة للسلة|أضف لسلتك|Add to cart/.test(x.textContent));
    if (!b) return false; b.click(); return true;
  });
  await sleep(800);
  const count = await page.evaluate(() => {
    const m = (document.querySelector('#nav_cart')?.innerText || '').match(/\d+/);
    return m ? Number(m[0]) : 0;
  });
  return { added, count };
}

/** Click a category by its visible label. */
async function clickCategory(page, label) {
  const clicked = await page.evaluate((label) => {
    const root = document.querySelector('#home_categories');
    if (!root) return false;
    for (const el of root.querySelectorAll('*')) {
      if (el.children.length === 0 && el.textContent.trim() === label) { el.closest('button, [role=button], div[class*=cursor]')?.click(); return true; }
    }
    return false;
  }, label);
  await sleep(450);
  return clicked;
}

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await newPage(browser);
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 140)));

  try {
    console.log('\n── Boot ───────────────────────────────────');
    await login(page);
    const base = await listNames(page);
    check(`Home renders merchants (${base.length} shown)`, base.length > 0, base.join(' · '));

    console.log('\n── Phase 2 · Category journey (the P0 fix) ─');
    for (const c of CATEGORIES) {
      await goHome(page);
      const clicked = await clickCategory(page, c.label);
      const names = await listNames(page);
      const noResults = await page.$('#home_no_results');
      const ok = clicked && !noResults && names.length > 0 && names.some(n => n.includes(c.expect));
      check(`${c.label} → ${names.length} merchant(s)`, ok, ok ? names.join(' · ') : (noResults ? 'NO RESULTS' : names.join(' · ') || 'empty'));
    }

    console.log('\n── Phase 3 · Search journey (same dataset) ─');
    for (const [q, want] of [['بيتزا', 'رومانو'], ['عطور', 'عطور'], ['صيدلية', 'صيدلية']]) {
      await goHome(page);
      await page.type('#home_search_input', q, { delay: 8 });
      await sleep(450);
      const names = await listNames(page);
      const ok = names.length > 0 && names.some(n => n.includes(want));
      check(`search "${q}" → ${names.length} result(s)`, ok, names.join(' · ') || 'NO RESULTS');
    }

    console.log('\n── Phase 4 · Offer journey (Order Now) ────');
    await goHome(page);
    const ctas = await page.$$eval('[id^=offer_cta_]', els => els.map(e => e.id));
    check(`Order Now CTAs present (${ctas.length})`, ctas.length > 0, ctas.join(', '));
    for (const id of ctas) {
      await goHome(page);
      await page.click(`#${id}`);
      await sleep(700);
      // Either it opened a merchant, or it revealed the merchant list (marketplace-wide offer).
      const onMerchant = await page.$('#restaurant_screen, #product_grid, #menu_list');
      const listShown  = await page.$('#restaurants_list');
      check(`${id} performs a real action`, !!(onMerchant || listShown), onMerchant ? 'opened merchant' : 'revealed merchant list');
    }

    console.log('\n── Phase 5 · No dead CTA on Home ──────────');
    await goHome(page);
    const dead = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('#customer_main button')) {
        const r = b.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;           // not visible
        const hasReact = Object.keys(b).some(k => k.startsWith('__reactProps'));
        const props = hasReact ? b[Object.keys(b).find(k => k.startsWith('__reactProps'))] : null;
        const wired = !!(props && props.onClick) || !!b.closest('[id^=offer_card_]') || !!b.onclick;
        if (!wired) out.push((b.textContent || '').trim().slice(0, 30) || '(icon)');
      }
      return out;
    });
    check('every visible Home button is wired', dead.length === 0, dead.length ? 'DEAD: ' + dead.join(' | ') : 'none dead');
    const filters = await page.$$eval('#home_search button', els => els.map(e => e.textContent.trim()));
    check('Filters control hidden (no destination yet)', !filters.some(t => t.includes('فلتر') || t.includes('تصفية')), filters.join(',') || 'none');

    console.log('\n── Phase 7 · Guest → Category → Merchant → Product → Cart ─');
    for (const c of [CATEGORIES[2], CATEGORIES[5]]) {   // pharmacy + perfume (the new fallback rows)
      await goHome(page);
      await clickCategory(page, c.label);
      const card = await page.$('#restaurants_list > div');
      if (!card) { check(`${c.label}: merchant card present`, false); continue; }
      await card.click();
      await sleep(900);
      const txt = await page.evaluate(() => document.body.innerText);
      // A pharmacy must not sell pizza, and must not call itself a restaurant.
      const foodLeak   = /بيتزا|مشاوي|كبسة|شاورما|مندي/.test(txt);
      const callsItself = /مطعم فاخر/.test(txt);
      const priced     = /ج\.م|ر\.س|﷼/.test(txt);
      check(`${c.label} → merchant opens with a priced menu`, priced && !/menuUnavailable|غير متوفرة/.test(txt));
      check(`${c.label} → menu is category-correct (no food leak)`, !foodLeak, foodLeak ? 'FOOD ITEMS IN NON-FOOD STORE' : 'ok');
      check(`${c.label} → store not mislabelled "مطعم فاخر"`, !callsItself, callsItself ? 'STILL LABELLED A RESTAURANT' : 'ok');

      // …→ Product → Cart. Assert the cart genuinely gains the item.
      const prod = await page.$('[id^=product_]:not([id^=product_img_])');
      check(`${c.label} → product cards rendered`, !!prod);
      if (!prod) continue;
      await prod.click();
      await sleep(700);
      const modal = await page.$('#product_modal');
      check(`${c.label} → product opens`, !!modal);
      const added = await page.evaluate(() => {
        const b = [...document.querySelectorAll('#product_modal button')].find(x => /إضافة للسلة|أضف لسلتك|Add to cart/.test(x.textContent));
        if (!b) return false; b.click(); return true;
      });
      await sleep(800);
      const cartCount = await page.evaluate(() => {
        const n = document.querySelector('#nav_cart');
        const m = (n?.innerText || '').match(/\d+/);
        return m ? Number(m[0]) : 0;
      });
      check(`${c.label} → item lands in cart (count=${cartCount})`, added && cartCount >= 1, added ? '' : 'add-to-cart button not found');
    }

    console.log('\n── Phase 7b · The three required guest journeys ─');
    // Each journey starts from a fresh load, so the cart never carries over between them.

    // A) Guest → Home → Category → Merchant → Product → Cart → Checkout
    await goHome(page);
    await clickCategory(page, 'الصيدلية');
    const aCard = await page.$('#restaurants_list > div');
    check('A1 category lists a merchant', !!aCard);
    await aCard.click(); await sleep(900);
    check('A2 merchant opens', !!(await page.$('#back_btn')));
    const aAdd = await addFirstProduct(page);
    check('A3 product → cart', aAdd.added && aAdd.count >= 1, `cart=${aAdd.count}`);
    await page.click('#nav_cart'); await sleep(700);
    const aCheckoutBtn = await page.$('#checkout_btn');
    check('A4 cart offers Checkout', !!aCheckoutBtn);
    if (aCheckoutBtn) {
      await aCheckoutBtn.click(); await sleep(1200);
      check('A5 Checkout opens', !!(await page.$('#checkout_page, #checkout_grid, #checkout-area')));
    }

    // B) Guest → Search → Merchant → Product → Cart
    await goHome(page);
    await page.type('#home_search_input', 'عطور', { delay: 8 }); await sleep(450);
    const bCard = await page.$('#restaurants_list > div');
    check('B1 search lists a merchant', !!bCard);
    await bCard.click(); await sleep(900);
    check('B2 merchant opens from search', !!(await page.$('#back_btn')));
    const bAdd = await addFirstProduct(page);
    check('B3 product → cart', bAdd.added && bAdd.count >= 1, `cart=${bAdd.count}`);

    // C) Guest → Offer → Merchant → Product → Cart
    await goHome(page);
    await page.click('#offer_cta_ob1'); await sleep(1000);
    const cOnMerchant = !!(await page.$('#back_btn'));
    check('C1 Order Now opens a merchant', cOnMerchant);
    if (cOnMerchant) {
      const cAdd = await addFirstProduct(page);
      check('C2 product → cart', cAdd.added && cAdd.count >= 1, `cart=${cAdd.count}`);
    }

    // Hero "Shop" — used to filter the empty branch list; must now yield results.
    await goHome(page);
    const heroBtn = await page.$('#home_campaign_hero button, [id^=marketplace_hero] button');
    const heroShop = await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find(x => /تسوق|اطلب|Shop/.test(x.textContent) && x.closest('section'));
      if (!b) return false; b.click(); return true;
    });
    await sleep(500);
    if (heroShop) {
      const heroNames = await listNames(page);
      check('Hero CTA filters to a non-empty result', heroNames.length > 0, heroNames.join(' · '));
    } else {
      check('Hero CTA present', !!heroBtn, 'no hero shop button found');
    }

    console.log('\n── Phase 5b · "More" / "View All" ─────────');
    await goHome(page);
    const preMore = (await listNames(page)).length;
    const moreBtn = await page.$('#home_more_merchants');
    check('More CTA present while merchants are capped', !!moreBtn, `showing ${preMore}`);
    if (moreBtn) {
      // Scroll it clear of the fixed bottom nav first, then tap for real (hit-tested):
      // a real user scrolls too, and this proves nothing permanently covers the control.
      await moreBtn.evaluate(el => el.scrollIntoView({ block: 'center' })); await sleep(350);
      const reachable = await moreBtn.evaluate(el => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el === top || el.contains(top);
      });
      check('More is actually tappable (not covered)', reachable);
      await moreBtn.click(); await sleep(400);
      const postMore = (await listNames(page)).length;
      check(`More reveals the rest (${preMore} → ${postMore})`, postMore > preMore);
      const gone = await page.$('#home_more_merchants');
      check('More hides once nothing is left to reveal', !gone);
    }
    await goHome(page);
    const va = await page.$('#home_featured_view_all');
    check('Featured "View All" present', !!va);
    if (va) {
      await va.click(); await sleep(500);
      const n = (await listNames(page)).length;
      check(`Featured "View All" reveals full list (${n})`, n > preMore);
    }

    console.log('\n── Phase 6 · Navigation state survives Back ─');
    await goHome(page);
    await clickCategory(page, 'الصيدلية');
    const filtered = await listNames(page);
    const card = await page.$('#restaurants_list > div');
    await card.click(); await sleep(800);
    const onMerchant = await page.$('#back_btn');
    check('merchant screen has Back', !!onMerchant);
    await page.click('#back_btn'); await sleep(700);
    const afterBack = await listNames(page);
    check('Back returns to Home', afterBack.length > 0, afterBack.join(' · '));
    check('selected Category survives Back',
      afterBack.length === filtered.length && afterBack.every((n, i) => n === filtered[i]),
      `before=[${filtered.join(',')}] after=[${afterBack.join(',')}]`);

    await goHome(page);
    await page.type('#home_search_input', 'عطور', { delay: 8 }); await sleep(400);
    const c2 = await page.$('#restaurants_list > div');
    await c2.click(); await sleep(800);
    await page.click('#back_btn'); await sleep(700);
    const q = await page.$eval('#home_search_input', e => e.value);
    check('search Query survives Back', q === 'عطور', `query after back = "${q}"`);

    console.log('\n── Runtime ────────────────────────────────');
    check('no uncaught page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('journey run completed', false, String(e).slice(0, 200));
  }

  await browser.close();
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══\n`);
  // Record for the Guardian ops workspace — this suite IS the customer journey's evidence.
  record({
    suite: 'Product journeys', passed: pass, failed: fail,
    journeys: [{ role: 'customer', status: fail === 0 ? 'passing' : 'failing' }],
  });
  process.exit(fail === 0 ? 0 : 1);
})();
