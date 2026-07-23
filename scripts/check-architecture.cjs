#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Architecture boundary guard.
//
// Rule 1 — Data access layering:  UI → Hooks → Services → Repositories → Supabase.
//   Feature code (src/features/**) must NOT import the Supabase client directly.
//
// Rule 2 — Feature isolation (migration M2):  a file under src/features/<A>/ must NOT
//   statically import from a sibling feature src/features/<B>/ (A ≠ B). Cross-app code
//   meets only at neutral seams: components/, services/, contexts/, hooks/, config/,
//   experience-*, runtime/, website-platform/. The Studio reaches apps ONLY through
//   runtime/registry (via dynamic import in an adapter) — dynamic import() is the
//   sanctioned escape hatch and is intentionally NOT scanned here, which is why this
//   invariant coexists with Guardian's "0 cycles" guarantee.
//
//   This makes admin↔merchant↔driver cycles structurally impossible, not merely absent.
//
// Fails (exit 1) on any violation. Wired into `npm run lint`, so it runs locally and in CI.
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FEATURES = path.join(ROOT, 'src', 'features');
const SUPABASE_RE = /from\s+['"][^'"]*lib\/supabase['"]/;
// Static `import … from '…'` / `export … from '…'` (NOT dynamic import('…')).
const FROM_RE = /(?:import\b[^;]*?\bfrom|export\b[^;]*?\bfrom)\s*['"]([^'"]+)['"]/g;

// Allowlist of legitimate cross-feature edges pending a migration step. EMPTY as of M6:
// the Runtime Migration is complete — no feature imports a sibling feature. Any new entry
// MUST name the migration step that deletes it; the goal state is {} (total isolation).
const FEATURE_BOUNDARY_ALLOW = {};

function walk(dir) {
  let files = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files = files.concat(walk(p));
    else if (/\.(ts|tsx)$/.test(e.name)) files.push(p);
  }
  return files;
}

const rel = p => path.relative(ROOT, p).replace(/\\/g, '/');
const featureOf = absFile => path.relative(FEATURES, absFile).split(path.sep)[0];

const supabaseViolations = [];
const boundaryViolations = [];

for (const file of walk(FEATURES)) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split(/\r?\n/);
  const srcFeature = featureOf(file);

  // Rule 1 — no direct Supabase import from features.
  lines.forEach((line, i) => {
    if (SUPABASE_RE.test(line)) supabaseViolations.push(`${rel(file)}:${i + 1}: ${line.trim()}`);
  });

  // Rule 2 — no static import of a sibling feature (unless allowlisted).
  let m;
  FROM_RE.lastIndex = 0;
  while ((m = FROM_RE.exec(src))) {
    const spec = m[1];
    if (spec[0] !== '.') continue; // bare/alias imports are not feature-relative
    const abs = path.resolve(path.dirname(file), spec);
    const relToFeatures = path.relative(FEATURES, abs);
    if (relToFeatures.startsWith('..') || path.isAbsolute(relToFeatures)) continue; // outside features/
    const tgtFeature = relToFeatures.split(path.sep)[0];
    if (!tgtFeature || tgtFeature === srcFeature) continue; // intra-feature
    const allowed = (FEATURE_BOUNDARY_ALLOW[srcFeature] || []).includes(tgtFeature);
    if (!allowed) {
      const lineNo = src.slice(0, m.index).split(/\r?\n/).length;
      boundaryViolations.push(`${rel(file)}:${lineNo}: features/${srcFeature} imports sibling features/${tgtFeature} → '${spec}'`);
    }
  }
}

let failed = false;

if (supabaseViolations.length) {
  failed = true;
  console.error('✖ Architecture boundary violation — features must NOT import lib/supabase directly.');
  console.error('  Route data access through a repository (src/repositories/*) via a service or hook.');
  console.error('  UI → Hooks → Services → Repositories → Supabase\n');
  supabaseViolations.forEach(v => console.error('  ' + v));
  console.error('');
}

if (boundaryViolations.length) {
  failed = true;
  console.error('✖ Feature isolation violation — a feature must NOT import a sibling feature.');
  console.error('  Share code via components/ services/ hooks/ contexts/ config/ runtime/ (not features/<other>).');
  console.error('  The Studio reaches apps only through runtime/registry (dynamic import in an adapter).\n');
  boundaryViolations.forEach(v => console.error('  ' + v));
  console.error('');
}

if (failed) process.exit(1);

const allowCount = Object.values(FEATURE_BOUNDARY_ALLOW).reduce((n, a) => n + a.length, 0);
console.log('✓ Architecture boundary OK — 0 feature files import lib/supabase.');
console.log(`✓ Feature isolation OK — 0 unlisted sibling-feature imports (${allowCount} allowlisted edge${allowCount === 1 ? '' : 's'} pending migration).`);
