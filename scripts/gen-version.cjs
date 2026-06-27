// Emits dist/version.json so the deployed build can be verified (SHA + timestamp).
// Runs after `vite build`. Uses Vercel's commit SHA when building on Vercel, else git.
const fs = require('fs');
const cp = require('child_process');
const path = require('path');

let sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
if (!sha) { try { sha = cp.execSync('git rev-parse HEAD').toString().trim(); } catch { sha = 'unknown'; } }

const pkg = require('../package.json');
const out = {
  name: 'haat-now',
  version: pkg.version || '1.0.0',
  sha,
  short: sha.slice(0, 7),
  builtAt: new Date().toISOString(),
  env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'production',
};

const dist = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(dist)) { console.error('dist/ not found — run vite build first'); process.exit(0); }
fs.writeFileSync(path.join(dist, 'version.json'), JSON.stringify(out, null, 2) + '\n');
// health.json doubles as a liveness probe (static 200 + JSON).
fs.writeFileSync(path.join(dist, 'health.json'), JSON.stringify({ status: 'ok', sha: out.short, at: out.builtAt }) + '\n');
console.log('wrote dist/version.json + health.json @', out.short);
