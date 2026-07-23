// ─────────────────────────────────────────────────────────────────────────────
// Emits dist/guardian-snapshot.json — the architecture facts the ops workspace reads.
//
// WHY A BUILD STEP: Guardian's discovery engine analyzes the repository, and a browser
// has no repository. The node/fs reader is deliberately excluded from the browser bundle
// (discovery/adapters/nodeRepositoryReader.ts), so the analysis runs ONCE here and ships
// as a static artifact. This is not a second analyzer — it is the same DiscoveryEngine,
// serialized through src/guardian/ops/types.ts.
//
// Runs after `vite build` (see package.json). NEVER fails the build: a missing snapshot
// degrades the workspace to "unknown", which it reports honestly.
//
//   npx tsx scripts/gen-guardian-snapshot.ts
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { DiscoveryEngine } from '../src/guardian/discovery/engine';
import { createNodeRepositoryReader } from '../src/guardian/discovery/adapters/nodeRepositoryReader';
import { diffFingerprint } from '../src/guardian/discovery/fingerprint';
import type { GuardianSnapshot, SuiteResult, JourneyResult } from '../src/guardian/ops/types';
import { SNAPSHOT_SCHEMA } from '../src/guardian/ops/types';

const ROOT = join(dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const DIST = join(ROOT, 'dist');
const BASELINE = join(ROOT, 'docs', 'guardian', 'baseline.json');

const sha = (() => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  try { return execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim(); } catch { return 'unknown'; }
})();

/**
 * Journeys the repo's runners actually cover. `status` is only ever 'passing' when a
 * recorded result proves it — an unproven journey reports 'not-verified', never 'passing'.
 */
const JOURNEY_COVERAGE: Omit<JourneyResult, 'status'>[] = [
  { role: 'customer', journey: 'Home → Category/Search/Offer → Merchant → Product → Cart → Checkout', evidence: 'docs/testing/home_wiring_journeys.cjs (52 checks) + sprint_final_verification.cjs' },
  { role: 'merchant', journey: 'Login → Branch → Orders → Accept/Reject', evidence: 'docs/testing/e2e_runner.cjs' },
  { role: 'driver', journey: 'Login → Shift → Assigned order → Deliver', evidence: 'docs/testing/e2e_runner.cjs' },
  { role: 'admin', journey: 'Login → Workspaces → CRUD → Audit', evidence: 'docs/testing/e2e_runner.cjs' },
  { role: 'partner', journey: 'Partner Center → Application → Submit', evidence: 'no dedicated automated runner found' },
  { role: 'affiliate', journey: 'Referral capture → Attribution → Payout', evidence: 'no dedicated automated runner found' },
];

type RecordedResult = { suite: string; passed: number; failed: number; at?: string; journeys?: { role: string; status: string }[] };

const RESULTS_FILE = join(ROOT, 'docs', 'testing', 'guardian-results.json');

function readRecorded(): RecordedResult[] {
  if (!existsSync(RESULTS_FILE)) return [];
  try {
    const raw = JSON.parse(readFileSync(RESULTS_FILE, 'utf8'));
    return Array.isArray(raw) ? raw : [];
  } catch { return []; }   // malformed → stays unrecorded, which the UI reports as unknown
}

/**
 * Journey status comes ONLY from a recorded run. A role with no evidence stays
 * 'not-verified' — the workspace never upgrades "we didn't check" into "it works".
 */
function readJourneys(recorded: RecordedResult[]): JourneyResult[] {
  const proven = new Map<string, string>();
  for (const r of recorded) for (const j of r.journeys ?? []) proven.set(j.role, j.status);
  return JOURNEY_COVERAGE.map(j => {
    const status = proven.get(j.role);
    return {
      ...j,
      status: status === 'passing' ? 'passing' : status === 'failing' ? 'failing' : 'not-verified',
    } as JourneyResult;
  });
}

/** Suites whose results the workspace surfaces. `recorded:false` ⇒ "not run", never a pass. */
function readSuites(): SuiteResult[] {
  const suites: SuiteResult[] = [
    { suite: 'Unit + integration', cmd: 'npm run test:website', passed: 0, failed: 0, recorded: false },
    { suite: 'Product journeys', cmd: 'node docs/testing/home_wiring_journeys.cjs', passed: 0, failed: 0, recorded: false },
    { suite: 'Demo isolation', cmd: 'node docs/testing/demo_isolation_check.cjs', passed: 0, failed: 0, recorded: false },
    { suite: 'Ops simulation', cmd: 'node docs/testing/ops_simulation.cjs', passed: 0, failed: 0, recorded: false },
  ];
  // Results are written by the runners themselves (docs/testing/_record.cjs).
  // An absent entry leaves recorded:false ⇒ the workspace shows "not run".
  for (const r of readRecorded()) {
    const hit = suites.find(s => s.suite === r.suite);
    if (hit) { hit.passed = r.passed; hit.failed = r.failed; hit.at = r.at; hit.recorded = true; }
  }
  return suites;
}

/**
 * "No inbound import" ≠ dead. These are reachable by means the import graph cannot see,
 * so reporting them would be crying wolf. Each exclusion states how the file IS reached.
 */
const NOT_DEAD: { re: RegExp; because: string }[] = [
  { re: /^(?!src\/)/,                       because: 'not app code — build config, CLI script, doc tool' },
  { re: /^supabase\/functions\//,           because: 'edge function — invoked by Supabase, never imported' },
  { re: /\/index\.ts$/,                     because: 'barrel — a public API surface, imported from outside by design' },
  { re: /\.d\.ts$/,                         because: 'ambient type declarations — consumed by tsc, not imported' },
  { re: /__bench__|__tests__/,              because: 'test/benchmark entry point — run directly by a runner' },
];

/** Genuine dead-code candidates: unreferenced AND not reachable by another mechanism. */
function realDeadCode(unused: string[]): string[] {
  return unused.filter(p => !NOT_DEAD.some(x => x.re.test(p)));
}

function main(): void {
  const engine = new DiscoveryEngine({ ports: { repository: createNodeRepositoryReader({ root: ROOT }) } });
  const now = new Date().toISOString();
  const r = engine.discover(now, 0);
  const f = r.findings;
  if (!f) { console.warn('[guardian] no repository findings — snapshot skipped'); return; }

  // ── drift vs the committed baseline ──
  let drift: GuardianSnapshot['drift'] = { hasBaseline: false, changed: false, architectureChanged: false, dependencyChanged: false, summary: 'no baseline recorded' };
  if (existsSync(BASELINE)) {
    try {
      const base = JSON.parse(readFileSync(BASELINE, 'utf8')) as { fingerprint: any; at: string };
      const d = diffFingerprint(base.fingerprint, r.fingerprint);
      drift = {
        hasBaseline: true,
        changed: d.changed,
        architectureChanged: d.architecture,
        dependencyChanged: d.dependency,
        summary: d.summary,
        baselineAt: base.at,
      };
    } catch { /* unreadable baseline → treated as absent */ }
  } else {
    mkdirSync(dirname(BASELINE), { recursive: true });
    writeFileSync(BASELINE, JSON.stringify({ at: now, sha, fingerprint: r.fingerprint }, null, 2) + '\n');
    console.log('[guardian] no baseline found — recorded one at docs/guardian/baseline.json');
  }

  // ── navigation ──
  const routes = r.inventory.routes;
  const seen = new Map<string, number>();
  for (const rt of routes) seen.set(rt.path, (seen.get(rt.path) ?? 0) + 1);
  const duplicateRoutes = [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p).sort();

  // `unreachable` is deliberately EMPTY, not computed.
  //
  // The obvious heuristic — "a route with no outgoing `renders` edge is unreachable" —
  // is invalid against this graph. buildGraph (registry.ts) only maps public→website and
  // admin/console→admin; an `app`-surface route can never receive a `renders` edge, so the
  // check flagged `/app` — the main, demonstrably working role application — as unreachable.
  // That is a defect in the question, not in the app. Reporting it would train the reader to
  // ignore this panel. Reachability needs a real render-graph (or the DOM crawl the journey
  // runners already do); until then this inspector reports only what it can prove.
  const unreachable: string[] = [];

  const snapshot: GuardianSnapshot = {
    schema: SNAPSHOT_SCHEMA,
    generatedAt: now,
    sha,
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
    architecture: {
      files: f.files,
      totalLoc: f.totalLoc,
      circular: f.circular,
      layerViolations: f.layerViolations,
      duplicates: f.duplicates,
      deadCode: realDeadCode(f.unusedFiles),
      largeFiles: f.largeFiles.slice(0, 15),
      coupling: f.coupling.slice(0, 15),
    },
    navigation: { routes, duplicateRoutes, unreachable },
    fingerprint: {
      composite: r.fingerprint.composite,
      architecture: r.fingerprint.architecture,
      dependency: r.fingerprint.dependency,
      repository: r.fingerprint.repository,
    },
    drift,
    suites: readSuites(),
    journeys: readJourneys(readRecorded()),
    inventory: {
      services: r.inventory.services.length,
      features: r.inventory.features.length,
      routes: routes.length,
      apis: r.inventory.apis.length,
      events: r.inventory.events.length,
      permissions: r.inventory.permissions.length,
      integrations: r.inventory.integrations.length,
      envKeys: r.inventory.env.length,
    },
  };

  if (!existsSync(DIST)) { console.warn('[guardian] dist/ not found — run vite build first; snapshot skipped'); return; }
  writeFileSync(join(DIST, 'guardian-snapshot.json'), JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`[guardian] snapshot → dist/guardian-snapshot.json (${f.files} files · ${f.circular.length} cycles · ${f.layerViolations.length} violations · fp ${r.fingerprint.composite})`);
}

try { main(); } catch (e) {
  // Never break the build over telemetry.
  console.warn('[guardian] snapshot generation failed (non-fatal):', e instanceof Error ? e.message : String(e));
}
