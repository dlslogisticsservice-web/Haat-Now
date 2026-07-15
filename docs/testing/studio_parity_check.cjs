// Proves the Studio↔Public parity fix at the content-store level in a real browser.
// Public renders `published`, Studio renders `draft` (runtime.ts:22). After the fix, an
// untouched stranded draft refreshes to the baseline on re-seed (parity); a genuinely-edited
// (dirty) draft is preserved. We assert on the record the app actually re-seeds (seedVersion
// advanced to the current baseline) — orphaned fallback keys are ignored.
const puppeteer = require('puppeteer');
const BASE = process.env.BASE_URL || 'http://localhost:3001';
const LS_KEY = 'haat_sb_website_v1';
const sig = (s) => JSON.stringify((s?.pages || []).map(p => ({ path: p.path, secs: (p.sections || []).length, t: p.title })));

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  let pass = 0, fail = 0;
  const check = (n, ok) => { console.log(`  ${ok ? '✔' : '✖'} ${n}`); ok ? pass++ : fail++; };

  // Stabilize: boot + reload so tenants seed and the canonical tenant record exists.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 1200));
  await page.reload({ waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 1200));
  const CUR = await page.evaluate((K) => { const s = JSON.parse(localStorage.getItem(K) || '{}'); return Object.values(s).map(r => r.seedVersion).sort().pop(); }, LS_KEY);
  console.log('current SEED_VERSION in bundle:', CUR);

  const corruptAll = (dirty, hero) => page.evaluate((K, dirty, hero) => {
    const s = JSON.parse(localStorage.getItem(K));
    for (const id of Object.keys(s)) { const r = s[id]; r.seedVersion = 'OLD.0'; r.draft.pages[0].sections = [{ type: 'richtext', heading: hero, body: 'x' }]; if (dirty) r.draftDirty = true; else delete r.draftDirty; }
    localStorage.setItem(K, JSON.stringify(s));
  }, LS_KEY, dirty, hero);

  // read records the app RE-SEEDED (seedVersion === current) after a reload
  const reseeded = (hero) => page.evaluate((K, CUR, sigSrc, hero) => {
    const sig = eval('(' + sigSrc + ')');
    const recs = Object.values(JSON.parse(localStorage.getItem(K))).filter(r => r.seedVersion === CUR);
    return { count: recs.length, anyHero: recs.some(r => JSON.stringify(r.draft).includes(hero)), allParity: recs.every(r => sig(r.draft) === sig(r.published)) };
  }, LS_KEY, CUR, sig.toString(), hero);

  // SCENARIO A — untouched stranded draft must REFRESH to parity.
  await corruptAll(false, 'OLD_STRANDED_HERO');
  await page.reload({ waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 1000));
  const A = await reseeded('OLD_STRANDED_HERO');
  check(`A: re-seeded record exists (count=${A.count})`, A.count >= 1);
  check('A: stranded sentinel removed from re-seeded draft', !A.anyHero);
  check('A: re-seeded draft == published (Studio==Public parity)', A.allParity);

  // SCENARIO B — genuinely edited (dirty) draft must be PRESERVED across re-seed.
  await corruptAll(true, 'AUTHOR_EDIT_KEEP');
  await page.reload({ waitUntil: 'domcontentloaded' }); await new Promise(r => setTimeout(r, 1000));
  const B = await reseeded('AUTHOR_EDIT_KEEP');
  check('B: edited draft PRESERVED across re-seed (sentinel intact)', B.anyHero);
  check('B: dirty draft differs from published (unpublished edit)', !B.allParity);

  await browser.close();
  console.log(`\nSTUDIO PARITY CHECK: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
