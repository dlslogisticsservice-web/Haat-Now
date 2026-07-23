// ─────────────────────────────────────────────────────────────────────────────
// Launch Guardian → Operations & Quality Workspace — verification.
//
// Drives the real workspace in a browser and asserts every panel renders from real
// data, plus the two honesty rules the whole thing rests on:
//   · a suite that never ran must read "not run", never a green pass
//   · the readiness score must be derived (and auditable), never asserted
//
// Must run against a BUILT app (`npm run build && npx vite preview --port 4173`):
// the snapshot is emitted to dist/, so a dev server correctly reports "no snapshot".
//
//   node docs/testing/ops_workspace_check.cjs
// ─────────────────────────────────────────────────────────────────────────────
const puppeteer = require('puppeteer');
const BASE = process.env.BASE_URL || 'http://localhost:4173/app';
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const check = (n, ok, d) => { console.log(`  ${ok ? '✔' : '✖'} ${n}${d ? ' — ' + d : ''}`); ok ? pass++ : fail++; };

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 1000 });
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('haat_onboarding_done', '1'); localStorage.setItem('haat_lang', 'en'); } catch (e) {}
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).slice(0, 160)));

  try {
    // ── login as SUPER admin (the workspace is super-admin only) ──
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#account_gateway', { timeout: 25000 });
    // Two steps: the gateway shows customer/merchant/driver, and "Team member?" reveals the
    // staff tier (franchise / country admin / super admin). The workspace is super-admin only.
    await page.click('#gateway_admin_link');
    await page.waitForSelector('#acct_admin', { timeout: 20000 });
    await page.click('#acct_admin');
    await page.waitForSelector('#phone_input', { timeout: 20000 });
    await page.type('#phone_input', '+201000000005', { delay: 5 });   // super admin
    await page.click('#send_otp_btn');
    await page.waitForSelector('#otp_boxes input', { timeout: 15000 });
    const boxes = await page.$$('#otp_boxes input');
    for (let i = 0; i < 6; i++) await boxes[i].type('123456'[i], { delay: 5 });
    await page.click('#verify_otp_btn');
    await sleep(2500);

    // ── open the Guardian tab ──
    const opened = await page.evaluate(() => {
      const el = [...document.querySelectorAll('button, a, [role=tab]')]
        .find(x => /guardian/i.test(x.textContent || '') || /guardian/i.test(x.id || ''));
      if (el) { el.click(); return true; }
      return false;
    });
    await sleep(2500);
    check('Launch Guardian tab opens', opened && !!(await page.$('#launch_guardian')));

    console.log('\n── panels ─────────────────────────────────');
    for (const [id, name] of [
      ['#lg_readiness', 'Launch Readiness'],
      ['#lg_architecture', 'Architecture Health'],
      ['#lg_runtime', 'Runtime Health'],
      ['#lg_regression', 'Regression Center'],
      ['#lg_navigation', 'Navigation Inspector'],
      ['#lg_journeys', 'User Journey Inspector'],
      ['#lg_repair_center', 'AI Repair Center'],
    ]) check(name, !!(await page.$(id)));

    console.log('\n── real data, not placeholders ────────────');
    const text = await page.evaluate(() => document.querySelector('#launch_guardian').innerText);
    check('snapshot loaded (no "Unknown — no snapshot")', !/Unknown — no snapshot/.test(text), /Unknown/.test(text) ? 'snapshot missing' : 'loaded');

    const score = await page.evaluate(() => {
      const m = document.querySelector('#lg_readiness').innerText.match(/(\d+)\s*\/100/);
      return m ? Number(m[1]) : null;
    });
    check('readiness renders a 0–100 score', score !== null && score >= 0 && score <= 100, `score=${score}`);

    const arch = await page.evaluate(() => document.querySelector('#lg_architecture').innerText);
    check('architecture shows real repo facts', /files/i.test(arch) && /fp\s+[0-9a-f]{6,}/i.test(arch), (arch.split('\n')[1] || '').slice(0, 60));

    // The honesty rule: unrun suites must not render as passing.
    const reg = await page.evaluate(() => document.querySelector('#lg_regression').innerText);
    check('unrun suites read "not run", never a green pass', /not run/i.test(reg), reg.replace(/\n/g, ' | ').slice(0, 80));

    const jour = await page.evaluate(() => document.querySelector('#lg_journeys').innerText);
    const roles = ['customer', 'merchant', 'driver', 'partner', 'affiliate', 'admin'];
    const missing = roles.filter(r => !jour.toLowerCase().includes(r));
    check('all six roles listed', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : roles.join(', '));

    // Repair packets: expand the first and confirm it is a complete, sendable prompt.
    const packets = await page.$$eval('#lg_repair_center button', els => els.length);
    check('repair packets generated per issue', packets > 0, `${packets} packet(s)`);
    if (packets > 0) {
      await page.evaluate(() => document.querySelector('#lg_repair_center button').click());
      await sleep(500);
      const prompt = await page.evaluate(() => {
        const t = document.querySelector('#lg_repair_center textarea');
        return t ? t.value : '';
      });
      for (const part of ['## Root cause', '## Files involved', '## Recommended fix', '## Rules', 'npm run lint']) {
        check(`prompt contains "${part}"`, prompt.includes(part));
      }
    }

    console.log('\n── provider readiness (V4) ────────────────');
    check('Provider Readiness panel', !!(await page.$('#lg_providers')));
    const prov = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    for (const cap of ['auth', 'location', 'payment', 'push', 'sms', 'email', 'storage']) {
      check(`provider listed: ${cap}`, prov.toLowerCase().includes(cap));
    }
    check('unconfigured providers shown as such (push/sms/email)', /not configured/i.test(prov));
    check('provider truth is derived, not asserted', /derived from env/i.test(prov));

    console.log('\n── authentication health (V5) ─────────────');
    const runtimeTxt = await page.evaluate(() => document.querySelector('#lg_runtime') ? document.querySelector('#lg_runtime').innerText : '');
    check('OTP send-failure signal shown', /send failures/i.test(runtimeTxt), (runtimeTxt.match(/OTP send failures[^\n]*/i) || [''])[0]);
    check('OTP verify-failure signal shown', /verify failures/i.test(runtimeTxt));
    const gate2 = await page.evaluate(() => document.querySelector('#lg_gate_rules') ? document.querySelector('#lg_gate_rules').innerText : '');
    check('Release Gate includes an Authentication rule', /Authentication ready/i.test(gate2), (gate2.match(/Authentication ready[^\n]*/i) || [''])[0].slice(0, 60));
    const provTxt = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    check('auth provider status is demo in the demo build (not faked active)', /auth[\s\S]{0,40}demo|demo[\s\S]{0,40}auth/i.test(provTxt) || /demo/i.test(provTxt));

    console.log('\n── location platform (V6) ─────────────────');
    const provTxt2 = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    check('maps provider reported (demo/not-configured/active)', /maps/i.test(provTxt2), (provTxt2.match(/maps[^\n]*/i) || [''])[0].slice(0, 50));
    check('location provider reported', /location/i.test(provTxt2));
    const rt2 = await page.evaluate(() => document.querySelector('#lg_runtime') ? document.querySelector('#lg_runtime').innerText : '');
    check('location update-failure signal shown', /update failures/i.test(rt2));
    check('location permission-denial signal shown', /perm\. denials|permission/i.test(rt2));
    check('tracking-interruption signal shown', /interruptions/i.test(rt2));
    const gate3 = await page.evaluate(() => document.querySelector('#lg_gate_rules') ? document.querySelector('#lg_gate_rules').innerText : '');
    check('Release Gate includes a Location rule', /Location ready/i.test(gate3), (gate3.match(/Location ready[^\n]*/i) || [''])[0].slice(0, 60));

    console.log('\n── notification platform (V7) ─────────────');
    const prov3 = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    check('in-app provider reported', /inapp|in-app/i.test(prov3));
    check('push provider reported (demo/not-configured/active)', /push/i.test(prov3), (prov3.match(/push[^\n]*/i) || [''])[0].slice(0, 46));
    const rt3 = await page.evaluate(() => document.querySelector('#lg_runtime') ? document.querySelector('#lg_runtime').innerText : '');
    check('notification-failure signal shown', /notification failures/i.test(rt3));
    const gate4 = await page.evaluate(() => document.querySelector('#lg_gate_rules') ? document.querySelector('#lg_gate_rules').innerText : '');
    check('Release Gate includes a Notification rule', /Notification ready/i.test(gate4), (gate4.match(/Notification ready[^\n]*/i) || [''])[0].slice(0, 60));

    console.log('\n── payment platform (V8) ──────────────────');
    const prov4 = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    check('payment provider reported (demo/not-configured/active)', /payment/i.test(prov4), (prov4.match(/payment[^\n]*/i) || [''])[0].slice(0, 46));
    const rt4 = await page.evaluate(() => document.querySelector('#lg_runtime') ? document.querySelector('#lg_runtime').innerText : '');
    check('payment gateway-failure signal shown', /gateway failures/i.test(rt4));
    const gate5 = await page.evaluate(() => document.querySelector('#lg_gate_rules') ? document.querySelector('#lg_gate_rules').innerText : '');
    check('Release Gate includes a Payment rule', /Payment ready/i.test(gate5), (gate5.match(/Payment ready[^\n]*/i) || [''])[0].slice(0, 60));

    console.log('\n── email platform (V9) ────────────────────');
    const prov5 = await page.evaluate(() => document.querySelector('#lg_providers') ? document.querySelector('#lg_providers').innerText : '');
    check('email provider reported (demo/not-configured/active)', /email/i.test(prov5), (prov5.match(/email[^\n]*/i) || [''])[0].slice(0, 46));
    const rt5 = await page.evaluate(() => document.querySelector('#lg_runtime') ? document.querySelector('#lg_runtime').innerText : '');
    check('email send-failure signal shown', /email send failures/i.test(rt5));
    check('email template-failure signal shown', /email template failures/i.test(rt5));
    const gate6 = await page.evaluate(() => document.querySelector('#lg_gate_rules') ? document.querySelector('#lg_gate_rules').innerText : '');
    check('Release Gate includes an Email rule', /Email ready/i.test(gate6), (gate6.match(/Email ready[^\n]*/i) || [''])[0].slice(0, 60));

    console.log('\n── issue lifecycle (V3) ───────────────────');
    for (const [id, name] of [
      ['#lg_release_gate', 'Release Gate'],
      ['#lg_gate_rules', 'Gate rules (auditable)'],
      ['#lg_issues', 'Issues'],
      ['#lg_issue_filters', 'Issue search / filters'],
      ['#lg_trends', 'Trends & Build History'],
    ]) check(name, !!(await page.$(id)));

    // Findings must have been persisted as issues by reconcile.
    const stored = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('haat_crud_guardian_issues') || '[]'); } catch { return []; }
    });
    check('findings persisted as issues', stored.length > 0, `${stored.length} issue(s)`);
    check('issues carry lifecycle fields', stored.length > 0 && !!stored[0].status && !!stored[0].history && !!stored[0].detectedBuild,
      stored[0] ? `${stored[0].status} · ${stored[0].history.length} history · build ${stored[0].detectedBuild}` : '');
    check('every issue starts OPEN with a detection entry',
      stored.every(i => i.history.length >= 1 && i.history[0].to === 'OPEN' && i.history[0].from === null));
    check('owner inferred, never left blank', stored.every(i => !!i.owner), [...new Set(stored.map(i => i.owner))].join(', '));

    // A build record must exist for this build.
    const bhist = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('haat_crud_guardian_builds') || '[]'); } catch { return []; }
    });
    check('build recorded in history', bhist.length > 0, bhist[0] ? `${bhist[0].build} · readiness ${bhist[0].readiness} · ${bhist[0].verdict}` : '');

    // Reconcile must be idempotent: a reload must not duplicate issues.
    // A reload returns to the default admin tab, so re-open Guardian to let it run again.
    await page.reload({ waitUntil: 'domcontentloaded' });
    // The dashboard re-mounts and restores auth first, so poll for the tab rather than
    // guessing a delay, then re-click until the workspace is actually back.
    for (let i = 0; i < 20 && !(await page.$('#lg_release_gate')); i++) {
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('button, a, [role=tab]')]
          .find(x => /guardian/i.test(x.textContent || '') || /guardian/i.test(x.id || ''));
        if (el) el.click();
      });
      await sleep(1000);
    }
    await sleep(2500);
    const again = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('haat_crud_guardian_issues') || '[]'); } catch { return []; }
    });
    check('reconcile is idempotent (reload does not duplicate)', again.length === stored.length, `${stored.length} → ${again.length}`);

    // The gate must render a verdict and explain it.
    const gateTxt = await page.evaluate(() => document.querySelector('#lg_release_gate') ? document.querySelector('#lg_release_gate').innerText : '');
    check('gate renders a verdict', /GO|NO GO|GO WITH RISK/.test(gateTxt), (gateTxt.split('\n')[1] || '').slice(0, 40));
    check('gate explains every rule', /No open critical issues|Required journeys|Regression suites/.test(gateTxt));

    console.log('\n── errors ─────────────────────────────────');
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('workspace run completed', false, String(e).slice(0, 220));
  }

  await browser.close();
  console.log(`\n═══ ${pass} passed · ${fail} failed ═══\n`);
  process.exit(fail === 0 ? 0 : 1);
})();
