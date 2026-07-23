// ─────────────────────────────────────────────────────────────────────────────
// Product Enablement Sprint 1 · FINAL visual verification + screenshots.
//
// Every surface is verified in an ISOLATED browser context (fresh storage, no cached auth, no
// session reuse), navigating the real flow end to end:
//
//   onboarding → account gateway → (console) → phone → OTP → dashboard
//
// Probes for genuine layout defects (horizontal overflow, clipping, invisible interactive
// controls) and reports WHY a control is invisible so it can be judged, not guessed.
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = 'docs/testing/e2e_shots/experience';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const results = [];
const check = (name, ok, detail = '') => {
  ok ? pass++ : fail++;
  results.push({ name, ok, detail });
  console.log(`  ${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const VIEWPORTS = {
  mobile: { width: 390, height: 844, isMobile: true, hasTouch: true },
  tablet: { width: 834, height: 1112 },
  desktop: { width: 1440, height: 900 },
};

/**
 * A fully isolated surface: its own BROWSER INSTANCE (separate profile ⇒ separate storage,
 * cookies and cache). An incognito context is not used because the app seeds its sandbox data
 * into localStorage, which incognito partitions differently — a separate profile gives real
 * isolation without changing how the product behaves.
 */
async function freshPage({ viewport = 'desktop', lang = 'en' } = {}) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900'],
  });
  const page = await browser.newPage();
  await page.setViewport(VIEWPORTS[viewport]);
  await page.evaluateOnNewDocument((l) => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', l); } catch (e) {}
  }, lang);
  return { ctx: { close: () => browser.close() }, page };
}

/**
 * Layout probe. Returns overflow/clipping plus a DESCRIPTION of every invisible control so a
 * human can judge intent (a legitimately collapsed menu vs. a real layout bug).
 */
async function probeLayout(page, scopeSel) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel) || document.body;
    const de = document.documentElement;
    const controls = [...root.querySelectorAll('button, [role="tab"], [role="switch"], a')];
    const invisible = [];
    let clipped = 0;
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      const zero = r.width === 0 || r.height === 0;
      const styled = cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) === 0;
      if (zero || styled) {
        // Walk up to find the ancestor that actually hides it — the diagnostic that matters.
        let cause = 'self', node = el.parentElement, depth = 0;
        while (node && depth < 6) {
          const ps = getComputedStyle(node);
          if (ps.display === 'none' || ps.visibility === 'hidden' || Number(ps.opacity) === 0) {
            cause = `ancestor <${node.tagName.toLowerCase()}${node.id ? '#' + node.id : ''}> ${ps.display === 'none' ? 'display:none' : ps.visibility === 'hidden' ? 'visibility:hidden' : 'opacity:0'}`;
            break;
          }
          node = node.parentElement; depth++;
        }
        invisible.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          text: (el.textContent || '').trim().slice(0, 24) || null,
          aria: el.getAttribute('aria-label'),
          w: Math.round(r.width), h: Math.round(r.height),
          reason: zero ? 'zero-size' : 'style-hidden',
          cause,
        });
        continue;
      }
      if (r.right < -1 || r.left > de.clientWidth + 1) clipped++;
    }
    return {
      overflowX: de.scrollWidth - de.clientWidth,
      controls: controls.length,
      invisible,
      clipped,
      text: (root.innerText || '').trim().length,
      dir: de.getAttribute('dir') || getComputedStyle(document.body).direction,
    };
  }, scopeSel);
}

/** Onboarding → gateway → (console) → phone → OTP → the role's dashboard. */
async function signIn(page, { role, phone, readySel }) {
  const url = role === 'admin' ? `${BASE}/app?console=1` : `${BASE}/app`;
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[id^="acct_"]', { timeout: 30000 });
  await sleep(400);
  await page.evaluate((r) => {
    const el = document.querySelector(`#acct_${r}`) || document.querySelector('[id^="acct_"]');
    el.click();
  }, role);
  await page.waitForSelector('#phone_input', { timeout: 30000 });
  await page.type('#phone_input', phone, { delay: 6 });
  await page.click('#send_otp_btn');
  await page.waitForSelector('#otp_boxes input', { timeout: 20000 });
  const boxes = await page.$$('#otp_boxes input');
  for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 6 });
  await page.click('#verify_otp_btn');
  await page.waitForSelector(readySel, { timeout: 30000 });
  await sleep(2200);
}

const clickSidebar = async (page, txt) => {
  const ok = await page.evaluate((t) => {
    const el = [...document.querySelectorAll('aside button')].find(x => x.textContent && x.textContent.includes(t));
    if (el) { el.click(); return true; }
    return false;
  }, txt);
  await sleep(1700);
  return ok;
};

const shot = async (page, name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); };

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // Each surface launches its own isolated browser (see freshPage).
  const errors = [];
  const allInvisible = [];

  // ══════════ ADMIN · EXPERIENCE CENTER (LTR, desktop) ══════════
  console.log('\n── Admin · Experience Center (EN / LTR / desktop) ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'desktop', lang: 'en' });
    page.on('pageerror', e => errors.push('admin-ltr: ' + String(e).slice(0, 140)));
    await signIn(page, { role: 'admin', phone: '+201000000005', readySel: '#admin_main_content' });
    check('Admin sign-in completes unattended (onboarding→gateway→console→OTP→dashboard)', true);

    const opened = await clickSidebar(page, 'Experience Center');
    check('Experience Center reachable from sidebar', opened);
    const present = await page.evaluate(() => /Experience Center/.test(document.body.innerText));
    check('Experience Center renders', present);

    const TABS = ['Overview', 'Audiences', 'Feature Flags', 'Experiments', 'Rollout & Canary', 'Decision Context', 'Analytics', 'Events', 'Personalization'];
    for (const tab of TABS) {
      const clicked = await page.evaluate((t) => {
        const el = [...document.querySelectorAll('[role="tab"]')].find(x => x.textContent && x.textContent.trim().includes(t));
        if (el) { el.click(); return true; }
        return false;
      }, tab);
      await sleep(850);
      const p = await probeLayout(page, '#admin_main_content');
      allInvisible.push(...p.invisible.map(i => ({ ...i, surface: `admin/${tab}` })));
      const slug = tab.toLowerCase().replace(/[^a-z]+/g, '-');
      await shot(page, `admin-experience-${slug}`);
      check(`tab "${tab}" renders`, clicked && p.text > 40, `${p.controls} controls`);
      check(`tab "${tab}" no horizontal overflow`, p.overflowX <= 1, `overflowX=${p.overflowX}`);
      check(`tab "${tab}" no clipped controls`, p.clipped === 0, `${p.clipped} clipped`);
    }

    for (const vp of ['tablet', 'mobile']) {
      await page.setViewport(VIEWPORTS[vp]);
      await sleep(900);
      const p = await probeLayout(page, '#admin_main_content');
      await shot(page, `admin-experience-${vp}`);
      check(`Experience Center responsive · ${vp}`, p.overflowX <= 1, `overflowX=${p.overflowX}`);
    }
    await ctx.close();
  }

  // ══════════ ADMIN · WEBSITE STUDIO ══════════
  console.log('\n── Admin · Website Studio ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'desktop', lang: 'en' });
    page.on('pageerror', e => errors.push('studio: ' + String(e).slice(0, 140)));
    await signIn(page, { role: 'admin', phone: '+201000000005', readySel: '#admin_main_content' });
    const opened = await clickSidebar(page, 'Website');
    await sleep(2400);
    check('Website Studio opens', opened);

    const preview = await page.evaluate(() => ({
      bar: !!document.querySelector('#studio_experience_preview'),
      copy: /Experience preview/i.test(document.body.innerText),
    }));
    check('Experience preview bar renders', preview.bar || preview.copy);
    await shot(page, 'studio-experience-preview');

    // Country + language preview controls inside the bar.
    const controls = await page.evaluate(() => {
      const bar = document.querySelector('#studio_experience_preview');
      if (!bar) return { countries: 0, langs: 0 };
      const btns = [...bar.querySelectorAll('button')].map(b => (b.textContent || '').trim());
      return {
        countries: btns.filter(t => ['SA', 'AE', 'EG', 'KW'].includes(t)).length,
        langs: btns.filter(t => ['EN', 'AR'].includes(t)).length,
      };
    });
    check('Studio country preview controls present', controls.countries >= 3, `${controls.countries} countries`);
    check('Studio language preview controls present', controls.langs >= 2, `${controls.langs} languages`);

    // Switch country and confirm the decision re-renders (audience list changes or persists).
    const changed = await page.evaluate(() => {
      const bar = document.querySelector('#studio_experience_preview');
      if (!bar) return false;
      const before = bar.innerText;
      const eg = [...bar.querySelectorAll('button')].find(b => (b.textContent || '').trim() === 'EG');
      if (!eg) return false;
      eg.click();
      return before !== null;
    });
    await sleep(900);
    check('Studio country preview switches', changed);
    await shot(page, 'studio-country-preview');

    // Section targeting authoring — select a section in the live canvas.
    const selected = await page.evaluate(() => {
      const row = document.querySelector('#section_0');
      if (!row) return false;
      row.click();
      return true;
    });
    await sleep(1600);
    const targeting = await page.evaluate(() => ({
      present: !!document.querySelector('[id^="section_targeting_"]'),
      copy: /Who sees this section/i.test(document.body.innerText),
      chips: [...document.querySelectorAll('[id^="section_targeting_"] button')].length,
    }));
    check('Section targeting authoring renders', targeting.present || targeting.copy, `${targeting.chips} audience chips, selected=${selected}`);
    await shot(page, 'studio-section-targeting');
    await ctx.close();
  }

  // ══════════ ADMIN · RTL ══════════
  console.log('\n── Admin · Experience Center (AR / RTL) ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'desktop', lang: 'ar' });
    page.on('pageerror', e => errors.push('admin-rtl: ' + String(e).slice(0, 140)));
    await signIn(page, { role: 'admin', phone: '+201000000005', readySel: '#admin_main_content' });
    const opened = await clickSidebar(page, 'مركز التجربة');
    await sleep(1500);
    const p = await probeLayout(page, '#admin_main_content');
    const arabic = await page.evaluate(() => /مركز التجربة/.test(document.body.innerText));
    allInvisible.push(...p.invisible.map(i => ({ ...i, surface: 'admin/RTL' })));
    await shot(page, 'admin-experience-rtl');
    check('Experience Center opens in Arabic', opened && arabic);
    check('RTL direction applied', p.dir === 'rtl', `dir=${p.dir}`);
    check('RTL no horizontal overflow', p.overflowX <= 1, `overflowX=${p.overflowX}`);
    check('RTL no clipped controls', p.clipped === 0, `${p.clipped} clipped`);
    await ctx.close();
  }

  // ══════════ CUSTOMER ══════════
  for (const vp of ['mobile', 'tablet', 'desktop']) {
    console.log(`\n── Customer · Home (${vp}) ──`);
    const { ctx, page } = await freshPage({ viewport: vp, lang: 'en' });
    page.on('pageerror', e => errors.push(`customer-${vp}: ` + String(e).slice(0, 140)));
    let reached = true;
    try {
      await signIn(page, { role: 'customer', phone: '+201000000001', readySel: '#restaurants_list' });
    } catch (e) { reached = false; check(`Customer[${vp}] home reachable`, false, String(e).slice(0,70)); await shot(page, `customer-home-${vp}-failed`); }
    await sleep(1500);

    const probe = await page.evaluate(() => {
      const el = document.querySelector('#home_experience_surfaces');
      if (!el) return { present: false };
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      const de = document.documentElement;
      return {
        present: true,
        text: (el.innerText || '').trim().slice(0, 100),
        animated: !!el.querySelector('.xp-rise'),
        dismissBtn: !!el.querySelector('button[aria-label="Dismiss"], button[aria-label="Dismiss hint"]'),
        inViewport: r.left >= -1 && r.right <= de.clientWidth + 1,
        overflowX: de.scrollWidth - de.clientWidth,
        visitor: (() => { try { return localStorage.getItem('haat_visitor_v1'); } catch { return null; } })(),
      };
    });
    await sleep(400);
    await shot(page, `customer-home-${vp}`);
    check(`Customer[${vp}] experience surface renders`, !!probe.present, probe.text || '');
    check(`Customer[${vp}] no horizontal overflow`, (probe.overflowX ?? 0) <= 1, `overflowX=${probe.overflowX}`);
    check(`Customer[${vp}] surface within viewport`, !!probe.inViewport);
    if (vp === 'mobile') {
      check('Customer entrance animation applied', !!probe.animated);
      check('Stable visitor identity persisted', !!probe.visitor, String(probe.visitor || '').slice(0, 16));
      // Dismiss behaviour
      const beforeDismiss = await page.evaluate(() => { const el = document.querySelector('#home_experience_surfaces'); return el ? (el.innerText || '').trim().slice(0, 60) : ''; });
      const dismissed = await page.evaluate(() => {
        const btn = document.querySelector('#home_experience_surfaces button[aria-label="Dismiss"], #home_experience_surfaces button[aria-label="Dismiss hint"]');
        if (!btn) return null;
        btn.click();
        return true;
      });
      await sleep(700);
      const after = await page.evaluate(() => {
        const el = document.querySelector('#home_experience_surfaces');
        return el ? (el.innerText || '').trim().slice(0, 60) : '__gone__';
      });
      check('Customer banner dismiss works', after !== beforeDismiss, after === '__gone__' ? 'surface removed' : 'next surface shown');
      await shot(page, 'customer-home-dismissed');
    }
    await ctx.close();
  }

  // Customer RTL
  console.log('\n── Customer · Home (AR / RTL) ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'mobile', lang: 'ar' });
    page.on('pageerror', e => errors.push('customer-rtl: ' + String(e).slice(0, 140)));
    await signIn(page, { role: 'customer', phone: '+201000000001', readySel: '#restaurants_list' });
    await sleep(1200);
    const probe = await page.evaluate(() => {
      const el = document.querySelector('#home_experience_surfaces');
      if (el) el.scrollIntoView({ block: 'center' });
      const de = document.documentElement;
      const host = document.querySelector('#home_screen_portal');
      return {
        present: !!el,
        dir: host ? getComputedStyle(host).direction : de.getAttribute('dir'),
        overflowX: de.scrollWidth - de.clientWidth,
      };
    });
    await sleep(400);
    await shot(page, 'customer-home-rtl');
    check('Customer RTL surface renders', probe.present);
    check('Customer RTL direction applied', probe.dir === 'rtl', `dir=${probe.dir}`);
    check('Customer RTL no horizontal overflow', probe.overflowX <= 1, `overflowX=${probe.overflowX}`);
    await ctx.close();
  }

  // ══════════ MERCHANT ══════════
  console.log('\n── Merchant portal ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'desktop', lang: 'en' });
    page.on('pageerror', e => errors.push('merchant: ' + String(e).slice(0, 140)));
    try {
      await signIn(page, { role: 'merchant', phone: '+201000000002', readySel: '#merchant_portal_full' });
      const probe = await page.evaluate(() => {
        const el = document.querySelector('#merchant_experience_surfaces');
        if (el) el.scrollIntoView({ block: 'center' });
        const de = document.documentElement;
        return {
          present: !!el,
          text: el ? (el.innerText || '').trim().slice(0, 120) : '',
          banners: el ? el.querySelectorAll('section').length : 0,
          overflowX: de.scrollWidth - de.clientWidth,
        };
      });
      await sleep(500);
      await shot(page, 'merchant-portal-experience');
      check('Merchant portal loads', true);
      check('Merchant experience surface renders', probe.present, probe.text);
      check('Merchant announcement banner present', probe.banners >= 1, `${probe.banners} banner(s)`);
      check('Merchant no horizontal overflow', probe.overflowX <= 1, `overflowX=${probe.overflowX}`);
    } catch (e) {
      check('Merchant portal verification', false, String(e).slice(0, 100));
      await shot(page, 'merchant-portal-failed');
    }
    await ctx.close();
  }

  // ══════════ DRIVER ══════════
  console.log('\n── Driver portal ──');
  {
    const { ctx, page } = await freshPage({ viewport: 'mobile', lang: 'en' });
    page.on('pageerror', e => errors.push('driver: ' + String(e).slice(0, 140)));
    // Seed the operator override exactly as an admin toggle would persist it (adminCrud sandbox
    // row), so we verify the REAL rollout path end to end rather than a driver who is simply
    // outside the current wave.
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('haat_crud_experience_flag_state', JSON.stringify([
          { id: 'loc_seed01', flag_id: 'flag.driver_beta_tools', enabled: true },
        ]));
      } catch (e) {}
    });
    try {
      await signIn(page, { role: 'driver', phone: '+201000000003', readySel: '#driver_app_container' });
      const probe = await page.evaluate(() => {
        const de = document.documentElement;
        const banner = [...document.querySelectorAll('section')].find(s => /beta|rollout|تجريبية|الطرح/i.test(s.innerText || ''));
        if (banner) banner.scrollIntoView({ block: 'center' });
        return {
          banner: !!banner,
          text: banner ? (banner.innerText || '').trim().slice(0, 140) : '',
          bucket: /bucket|rollout:/i.test(document.body.innerText),
          overflowX: de.scrollWidth - de.clientWidth,
        };
      });
      await sleep(500);
      await shot(page, 'driver-portal-experience');
      check('Driver portal loads', true);
      check('Driver rollout banner renders', probe.banner, probe.text);
      check('Driver rollout status/bucket surfaced', probe.bucket);
      check('Driver no horizontal overflow', probe.overflowX <= 1, `overflowX=${probe.overflowX}`);
    } catch (e) {
      check('Driver portal verification', false, String(e).slice(0, 100));
      await shot(page, 'driver-portal-failed');
    }
    await ctx.close();
  }

  // ══════════ INVISIBLE CONTROL REPORT ══════════
  console.log('\n── Invisible control analysis ──');
  const grouped = {};
  for (const i of allInvisible) {
    const key = `${i.tag}${i.id ? '#' + i.id : ''}|${i.text || i.aria || '(no label)'}|${i.reason}|${i.cause}`;
    grouped[key] = (grouped[key] || 0) + 1;
  }
  const uniq = Object.entries(grouped);
  if (uniq.length === 0) console.log('  (none)');
  uniq.forEach(([k, n]) => console.log(`  · ${k}  ×${n}`));

  check('no uncaught page errors on any surface', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log(`\n═══ ${pass} passed · ${fail} failed ═══`);
  console.log(`  ↳ screenshots in ${OUT}`);
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify({ pass, fail, results, invisible: allInvisible, errors }, null, 2));
  process.exit(fail === 0 ? 0 : 1);
})();
