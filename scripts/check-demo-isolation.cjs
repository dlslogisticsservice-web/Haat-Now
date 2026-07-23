#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Demo isolation guard (Production Data Readiness sprint).
//
// A production customer must never see invented merchants, invented offers or
// invented money. That rule held only as long as every author remembered it, and
// it had already been forgotten three times (Home merchants, Home banners, wallet
// transactions all rendered fabricated rows whenever real data came back empty).
//
// This guard makes the rule structural. It enforces:
//
//   1. REGISTERED   — every fabricated dataset is listed below, on purpose.
//   2. GATED        — each one is only ever read behind DEMO_CONTENT_ENABLED.
//   3. MODE-KEYED   — demo mode is decided by the BUILD (VITE_AUTH_MODE), never by
//                     `!supabase`, which would flip a misconfigured production
//                     deploy into serving demo data.
//   4. NO STRAYS    — a new MOCK_/DEMO_/FAKE_/SAMPLE_/FALLBACK_/STATIC_ dataset in
//                     features/services must be registered, forcing a decision.
//
// Fails (exit 1) on any violation. Wired into `npm run lint`, so it runs in CI.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GATE = 'DEMO_CONTENT_ENABLED';

/**
 * The complete inventory of fabricated content. `file` declares it; every read of
 * `ident` outside the declaration must sit inside a GATE-guarded expression.
 * Adding an entry here is a deliberate act — that is the point.
 */
const DEMO_DATASETS = [
  { file: 'src/features/home/HomeScreen.tsx',     ident: 'FALLBACK_MERCHANTS',   what: 'demo merchants shown when the catalogue is empty' },
  { file: 'src/features/home/HomeScreen.tsx',     ident: 'STATIC_BANNERS',       what: 'demo offer banners shown when there are no live offers' },
  { file: 'src/features/wallet/WalletScreen.tsx', ident: 'SAMPLE_TRANSACTIONS',  what: 'sample wallet transactions shown when the wallet is empty' },
  { file: 'src/features/admin/AppRuntimePreview.tsx', ident: 'DEMO_IDENTITY', what: 'sandbox preview identities (customer/merchant/driver) that drive the App Studio Live App runtime screens' },
];

/** Scanned for stray unregistered datasets. */
const SCAN_DIRS = [path.join('src', 'features'), path.join('src', 'services')];
const STRAY_RE = /^\s*const\s+((?:MOCK|DEMO|FAKE|SAMPLE|FALLBACK|STATIC|DUMMY)_[A-Z0-9_]+)\s*(?::|=)/;

/** Type-position / declaration references are not runtime reads. */
const isDeclaration = (line, ident) => new RegExp(`^\\s*const\\s+${ident}\\b`).test(line);
const isTypePosition = (line, ident) => new RegExp(`typeof\\s+${ident}\\b`).test(line);

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
function walk(dir) {
  let out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out = out.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const violations = [];

// ── 1 + 2 · every registered dataset is imported-gated and read only behind the gate ──
for (const { file, ident, what } of DEMO_DATASETS) {
  const abs = path.join(ROOT, file);
  if (!fs.existsSync(abs)) { violations.push(`${file}: registered demo dataset '${ident}' — file not found (update the registry)`); continue; }
  const src = fs.readFileSync(abs, 'utf8');
  const lines = src.split(/\r?\n/);

  if (!new RegExp(`import\\s*\\{[^}]*\\b${GATE}\\b`).test(src)) {
    violations.push(`${file}: declares '${ident}' (${what}) but never imports ${GATE}`);
    continue;
  }
  lines.forEach((line, i) => {
    if (!new RegExp(`\\b${ident}\\b`).test(line)) return;
    if (isDeclaration(line, ident) || isTypePosition(line, ident)) return;
    // The gate must appear in the same expression: this line, or the 4 lines above it
    // (a ternary is routinely wrapped across lines by the formatter).
    const window = lines.slice(Math.max(0, i - 4), i + 1).join('\n');
    if (!window.includes(GATE)) {
      violations.push(`${file}:${i + 1}: '${ident}' is read without a ${GATE} gate → ${what}\n      ${line.trim()}`);
    }
  });
}

// ── 3 · demo mode must key off the build, never off client presence ──
for (const dir of SCAN_DIRS.concat([path.join('src', 'experience'), path.join('src', 'lib')])) {
  for (const f of walk(path.join(ROOT, dir))) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      if (/\|\|\s*!supabase/.test(line) && !line.trim().startsWith('//')) {
        violations.push(`${rel(f)}:${i + 1}: demo mode must not depend on '!supabase' — a production deploy with missing env vars would serve demo data.\n      ${line.trim()}`);
      }
    });
  }
}

// ── 4 · no unregistered fabricated dataset ──
const registered = new Set(DEMO_DATASETS.map(d => `${d.file}::${d.ident}`));
for (const dir of SCAN_DIRS) {
  for (const f of walk(path.join(ROOT, dir))) {
    const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = STRAY_RE.exec(line);
      if (!m) return;
      if (registered.has(`${rel(f)}::${m[1]}`)) return;
      violations.push(`${rel(f)}:${i + 1}: '${m[1]}' looks like fabricated content but is not registered in scripts/check-demo-isolation.cjs.\n      Register it (and gate it behind ${GATE}), or rename it if it is real product data.`);
    });
  }
}

// ── 5 · fabricated commercial signals on real data ──
// The prefixed-const guard (§4) is blind to component-scope literals — which is exactly
// how invented ratings/fees/ETAs slipped onto real merchants (Home + Restaurant screens).
// These signatures are narrow enough to avoid false positives: a synthesized star rating
// (`4.x + … .toFixed`) and arrays of ≥3 quoted rating-like decimals.
const FABRICATED_SIGNATURES = [
  { re: /\b[345]\.\d\s*\+[^;]*\.toFixed\s*\(/, what: 'a synthesized rating (e.g. 4.3 + idx%…).toFixed()' },
  { re: /\[\s*['"][345]\.\d['"]\s*,\s*['"][345]\.\d['"]\s*,\s*['"][345]\.\d['"]/, what: 'an array of hardcoded rating values' },
];
for (const f of walk(path.join(ROOT, path.join('src', 'features')))) {
  const lines = fs.readFileSync(f, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;
    for (const { re, what } of FABRICATED_SIGNATURES) {
      if (re.test(line)) {
        violations.push(`${rel(f)}:${i + 1}: looks like ${what} — a fabricated commercial claim on real data.\n      ${line.trim()}`);
      }
    }
  });
}

if (violations.length) {
  console.error('✖ Demo isolation violation — production could show fabricated content.');
  console.error('  Demo data may render ONLY when DEMO_CONTENT_ENABLED (src/config/runtime.ts) is true.');
  console.error('  An empty catalogue in production is an EMPTY STATE, never invented content.');
  console.error('');
  violations.forEach(v => console.error('  ' + v));
  process.exit(1);
}
console.log(`✓ Demo isolation OK — ${DEMO_DATASETS.length} fabricated datasets, all gated behind ${GATE}; 0 strays.`);
