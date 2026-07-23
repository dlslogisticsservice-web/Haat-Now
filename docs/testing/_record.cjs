// ─────────────────────────────────────────────────────────────────────────────
// Shared result recorder for the Guardian ops workspace.
//
// The browser cannot run node suites, so a suite's state is only known if the runner
// writes it down. Runners call record() on exit; scripts/gen-guardian-snapshot.ts reads
// the file at build time. A suite absent from this file reports "not run" in the
// workspace — deliberately, because unknown is not a pass.
//
//   const { record } = require('./_record.cjs');
//   record({ suite: 'Product journeys', passed, failed, journeys: [{ role: 'customer', status: 'passing' }] });
// ─────────────────────────────────────────────────────────────────────────────
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'guardian-results.json');

/** Merge one suite's result into the shared file (keeps other suites intact). */
function record({ suite, passed, failed, journeys }) {
  let all = [];
  try { if (fs.existsSync(FILE)) all = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { all = []; }
  if (!Array.isArray(all)) all = [];

  const entry = { suite, passed, failed, at: new Date().toISOString() };
  if (journeys) entry.journeys = journeys;

  const i = all.findIndex(x => x && x.suite === suite);
  if (i >= 0) all[i] = entry; else all.push(entry);

  try {
    fs.writeFileSync(FILE, JSON.stringify(all, null, 2) + '\n');
    console.log(`  ↳ recorded "${suite}" ${passed}/${passed + failed} → docs/testing/guardian-results.json`);
  } catch (e) {
    console.warn('  ↳ could not record result (non-fatal):', e.message);
  }
}

module.exports = { record, FILE };
