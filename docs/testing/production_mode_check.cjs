// ─────────────────────────────────────────────────────────────────────────────
// Production Data Readiness — Phase 6, the PRODUCTION half.
//
// Boots the real live artifact (HAAT_LIVE_BACKEND=1) and asserts that nothing
// fabricated reaches the DOM, and that the build-mode flag really did flip.
//
//   #sandbox_hint is rendered behind a bare `import.meta.env.VITE_AUTH_MODE ===
//   'sandbox'`, which Vite replaces with a literal at build time. Its ABSENCE from a
//   live build is direct evidence that VITE_AUTH_MODE === 'supabase' in the shipped
//   bundle — and therefore that DEMO_CONTENT_ENABLED (src/config/runtime.ts, which
//   reads the same variable) is false in production.
//
// SCOPE (stated honestly): the Home/merchant journey cannot be exercised here,
// because live mode requires a real Supabase phone OTP. This covers the surface a
// production build reaches without credentials. Home's demo-freedom is guaranteed by
// the flag proven here + scripts/check-demo-isolation.cjs, which proves every
// fabricated dataset is read only behind DEMO_CONTENT_ENABLED.
//
// Usage:
//   npm run build:live && npx vite preview --port 4173
//   node docs/testing/production_mode_check.cjs
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const BASE = process.env.BASE_URL || 'http://localhost:4173/app';
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Every fabricated string a production customer must never see. */
const DEMO_STRINGS = [
  'مطعم الباشا', 'بيتزا رومانو', 'كافيه لاتيه', 'سوبر فريش', 'صيدلية الشفاء',
  'حلويات أصيل', 'عطور الشرق', 'زهور المدينة', 'إلكترونيات المستقبل',
  'خصم 50%', 'توصيل مجاني', 'باراسيتامول',
];

let pass = 0, fail = 0;
const check = (name, ok, detail) => { console.log(`  ${ok ? '✔' : '✖'} ${name}${detail ? ' — ' + detail : ''}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'ar'); } catch (e) {}
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 120)));

  console.log('\n── Phase 6 · production build (live artifact) ─');
  try {
    await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);
    const text = await page.evaluate(() => document.body.innerText);
    const html = await page.evaluate(() => document.documentElement.outerHTML);

    check('live build boots to the real login', await page.evaluate(() => !!document.querySelector('#account_gateway, #phone_input')));
    check('no missing-config screen (env wired)', !/FATAL CONFIG|env var|MISSING_SUPABASE/i.test(text));
    check('VITE_AUTH_MODE flipped to supabase (#sandbox_hint dead-code-eliminated)',
      !(await page.evaluate(() => !!document.querySelector('#sandbox_hint'))));

    const leaked = DEMO_STRINGS.filter(d => text.includes(d) || html.includes(d));
    check('no fabricated content rendered', leaked.length === 0, leaked.length ? 'LEAKED: ' + leaked.join(', ') : 'none');
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('production run completed', false, String(e).slice(0, 200));
  }

  await browser.close();
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
