#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Operations Readiness · visual verification.
//
// Exists because tsc, 693 unit tests, Guardian, the journeys and the parity check
// have ALL passed while a shipped admin surface was crashing into an error boundary.
// Twice. A screen is only verified when something has actually looked at it.
//
// Signs in as super admin, opens the two new operational surfaces, and asserts they
// render real controls — not an empty shell, not an error boundary.
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const { mkdirSync } = require('fs');
const { join } = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const OUT = join(__dirname, 'e2e_shots', 'ops');
const SUPER_ADMIN = '+201000000005';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (name, extra = '') => { pass++; console.log(`  ✔ ${name}${extra ? ' — ' + extra : ''}`); };
const bad = (name, why) => { fail++; console.log(`  ✖ ${name} — ${why}`); };

async function signInAdmin(page) {
  // Onboarding gates the account gateway — seed it the same way experience_shots does.
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'en'); } catch (e) {}
  });
  await page.goto(`${BASE}/app?console=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[id^="acct_"]', { timeout: 30000 });
  await sleep(400);
  await page.evaluate(() => {
    const el = document.querySelector('#acct_admin') || document.querySelector('[id^="acct_"]');
    el.click();
  });
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
  await sleep(1900);
  return found;
};

/** A surface is "rendered" only if it is present, visible, sized and has real text. */
async function inspect(page, sel) {
  return page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return { present: false };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      present: true,
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.01,
      w: Math.round(r.width), h: Math.round(r.height),
      text: (el.innerText || '').trim().length,
      controls: el.querySelectorAll('button, input, select, [role="button"]').length,
    };
  }, sel);
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const errors = [];
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 950 });
  page.on('pageerror', (e) => errors.push(String(e.message || e)));

  try {
    console.log('\n── Sign in ───────────────────────');
    await signInAdmin(page);
    ok('Super admin signed in');

    // ── Go-Live Command Center ──
    console.log('\n── Go-Live Command Center ────────');
    const navGolive = await clickSidebar(page, 'Go-Live') || await clickSidebar(page, 'غرفة الإطلاق');
    navGolive ? ok('Go-Live nav entry reachable') : bad('Go-Live nav entry reachable', 'sidebar item not found');

    const golive = await inspect(page, '#golive_center');
    if (!golive.present) bad('Go-Live Center renders', 'not in the DOM');
    else if (!golive.visible || golive.h < 100) bad('Go-Live Center renders', `visible=${golive.visible} h=${golive.h}`);
    else ok('Go-Live Center renders', `${golive.w}x${golive.h}, ${golive.text} chars, ${golive.controls} controls`);

    const verdict = await inspect(page, '#golive_verdict');
    verdict.present && verdict.text > 0
      ? ok('Go/No-Go verdict rendered', `${verdict.text} chars`)
      : bad('Go/No-Go verdict rendered', 'missing or empty');

    // The demo build must report NO-GO. This is the single most important assertion
    // in the file: a sandbox build reporting GO would be a catastrophic false signal.
    const verdictText = await page.evaluate(() => {
      const el = document.querySelector('#golive_verdict');
      return el ? (el.innerText || '') : '';
    });
    /NO-GO|غير جاهز/.test(verdictText)
      ? ok('Demo build correctly reports NO-GO')
      : bad('Demo build correctly reports NO-GO', `verdict read: ${verdictText.slice(0, 80)}`);

    const blockers = await inspect(page, '#golive_blockers');
    blockers.present && blockers.text > 0
      ? ok('Blocking reasons listed', `${blockers.text} chars`)
      : bad('Blocking reasons listed', 'no blockers shown on a NO-GO verdict');

    for (const [sel, label] of [
      ['#golive_alerts', 'Alerts panel'],
      ['#golive_queues', 'Queue status panel'],
      ['#golive_providers', 'Provider status panel'],
      ['#golive_incidents', 'Incidents panel'],
      ['#golive_documents', 'Documents panel'],
      ['#golive_checklists', 'Checklists panel'],
    ]) {
      const r = await inspect(page, sel);
      r.present && r.visible && r.text > 0
        ? ok(`${label} rendered`, `${r.text} chars`)
        : bad(`${label} rendered`, r.present ? `visible=${r.visible} text=${r.text}` : 'absent');
    }

    // Checklist must be interactive, and a tick must persist across a re-render.
    const boxCount = await page.evaluate(() => document.querySelectorAll('#golive_checklists input[type=checkbox]').length);
    boxCount > 0 ? ok('Launch checklist is interactive', `${boxCount} items`) : bad('Launch checklist is interactive', 'no checkboxes');

    if (boxCount > 0) {
      const before = await page.evaluate(() => document.querySelector('#golive_checklists input[type=checkbox]').checked);
      await page.evaluate(() => document.querySelector('#golive_checklists input[type=checkbox]').click());
      await sleep(700);
      const after = await page.evaluate(() => document.querySelector('#golive_checklists input[type=checkbox]').checked);
      after !== before ? ok('Checklist item toggles') : bad('Checklist item toggles', 'state unchanged after click');
    }

    const rollbackTab = await page.$('#golive_tab_rollback');
    if (rollbackTab) {
      await rollbackTab.click(); await sleep(900);
      const rb = await page.evaluate(() => (document.querySelector('#golive_checklists')?.innerText || ''));
      /Rollback|Declare|تراجع|أعلن/.test(rb)
        ? ok('Rollback checklist renders')
        : bad('Rollback checklist renders', 'rollback content not found');
      await page.screenshot({ path: join(OUT, 'golive-rollback.png') });
      await page.click('#golive_tab_launch'); await sleep(600);
    } else bad('Rollback checklist renders', 'tab missing');

    await page.screenshot({ path: join(OUT, 'golive-center.png'), fullPage: true });

    // ── Incident Center ──
    console.log('\n── Incident Center ──────────────');
    const navInc = await clickSidebar(page, 'Incident Center') || await clickSidebar(page, 'مركز الحوادث');
    navInc ? ok('Incident Center nav entry reachable') : bad('Incident Center nav entry reachable', 'sidebar item not found');

    const inc = await inspect(page, '#ops_incident_center');
    if (!inc.present) bad('Incident Center renders', 'not in the DOM');
    else if (!inc.visible || inc.h < 100) bad('Incident Center renders', `visible=${inc.visible} h=${inc.h}`);
    else ok('Incident Center renders', `${inc.w}x${inc.h}, ${inc.controls} controls`);

    // Create a real incident through the UI and verify it lands in the list.
    const newBtn = await page.evaluate(() => {
      const el = [...document.querySelectorAll('#ops_incident_center button')]
        .find(b => /New incident|حادث جديد/.test(b.textContent || ''));
      if (el) { el.click(); return true; }
      return false;
    });
    await sleep(700);
    newBtn ? ok('New-incident form opens') : bad('New-incident form opens', 'button not found');

    if (await page.$('#incident_title')) {
      const title = `Verification incident ${Date.now()}`;
      await page.type('#incident_title', title, { delay: 4 });
      await page.select('#incident_sev', 'sev2');
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('#incident_create_form button')]
          .find(b => /Create incident|إنشاء/.test(b.textContent || ''));
        if (el) el.click();
      });
      await sleep(1500);

      const listed = await page.evaluate((t) => (document.querySelector('#incident_list')?.innerText || '').includes(t), title);
      listed ? ok('Incident created and listed') : bad('Incident created and listed', 'not found in the list');

      // Open it and confirm the lifecycle controls and timeline exist.
      if (listed) {
        await page.evaluate((t) => {
          const el = [...document.querySelectorAll('#incident_list button')].find(b => (b.textContent || '').includes(t));
          if (el) el.click();
        }, title);
        await sleep(1100);

        const timeline = await inspect(page, '#incident_timeline');
        timeline.present && timeline.text > 0
          ? ok('Incident timeline rendered', `${timeline.text} chars`)
          : bad('Incident timeline rendered', 'missing or empty');

        const hasRootCause = await page.$('#incident_root_cause');
        const hasResolution = await page.$('#incident_resolution');
        hasRootCause && hasResolution
          ? ok('Root cause + resolution capture present')
          : bad('Root cause + resolution capture present', 'fields missing');

        // Close-out must REFUSE without a root cause — the rule that makes the field mean something.
        await page.evaluate(() => {
          const el = [...document.querySelectorAll('button')].find(b => /Mark resolved|تسجيل الحل/.test(b.textContent || ''));
          if (el) el.click();
        });
        await sleep(900);
        const stillOpen = await page.evaluate(() => !!document.querySelector('#incident_root_cause'));
        stillOpen
          ? ok('Close-out refused without a root cause')
          : bad('Close-out refused without a root cause', 'incident resolved with empty root cause');

        await page.screenshot({ path: join(OUT, 'incident-detail.png') });
        await page.keyboard.press('Escape');
        await page.evaluate(() => { const b = document.querySelector('[role="dialog"]'); if (b) b.parentElement?.click(); });
        await sleep(500);
      }
    } else bad('New-incident form opens', 'title field absent');

    await page.screenshot({ path: join(OUT, 'incident-center.png'), fullPage: true });

    // ── Mobile ──
    console.log('\n── Responsive ───────────────');
    await page.setViewport({ width: 390, height: 844 });
    await sleep(1200);
    const overflow = await page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
    overflow <= 2 ? ok('No horizontal overflow at 390px', `overflow=${overflow}`) : bad('No horizontal overflow at 390px', `overflow=${overflow}px`);
    await page.screenshot({ path: join(OUT, 'incident-center-mobile.png') });
    await page.setViewport({ width: 1440, height: 950 });

    // ── Runtime ──
    console.log('\n── Runtime ─────────────────');
    errors.length === 0 ? ok('No uncaught page errors') : bad('No uncaught page errors', errors.slice(0, 3).join(' | '));
  } catch (e) {
    bad('ops readiness run completed', String(e && e.message ? e.message : e));
  } finally {
    await browser.close();
  }

  console.log(`\n═══ ${pass} passed · ${fail} failed ═══`);
  console.log(`  ↳ screenshots in ${OUT}`);
  process.exit(fail === 0 ? 0 : 1);
})();
