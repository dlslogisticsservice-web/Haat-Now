#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Architecture boundary guard (Phase-2 stabilization).
//
// Enforces the layered architecture:  UI → Hooks → Services → Repositories → Supabase.
// Feature code (src/features/**) must NOT import the Supabase client directly — all data
// access goes through a repository (src/repositories/*), reached via a service or hook.
//
// Fails (exit 1) on any violation. Wired into `npm run lint`, so it runs locally and in CI.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'src', 'features');
const IMPORT_RE = /from\s+['"][^'"]*lib\/supabase['"]/;

function walk(dir) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
  return files;
}

const violations = [];
for (const file of walk(FEATURES)) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (IMPORT_RE.test(line)) violations.push(`${path.relative(ROOT, file).replace(/\\/g, '/')}:${i + 1}: ${line.trim()}`);
  });
}

if (violations.length) {
  console.error('✖ Architecture boundary violation — features must NOT import lib/supabase directly.');
  console.error('  Route data access through a repository (src/repositories/*) via a service or hook.');
  console.error('  UI → Hooks → Services → Repositories → Supabase');
  console.error('');
  violations.forEach(v => console.error('  ' + v));
  process.exit(1);
}
console.log('✓ Architecture boundary OK — 0 feature files import lib/supabase.');
