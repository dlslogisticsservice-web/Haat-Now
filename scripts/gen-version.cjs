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

// Version the service-worker cache name by build SHA so each deploy installs a NEW
// service worker and its `activate` handler purges the previous shell cache → no
// stale PWA cache. The cache name becomes a verifiable SW/PWA version identifier.
const swPath = path.join(dist, 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/haat-shell-v[\w.]+/g, `haat-shell-${out.short}`);
  fs.writeFileSync(swPath, sw);
  console.log('stamped dist/sw.js cache -> haat-shell-' + out.short);
}
console.log('wrote dist/version.json + health.json @', out.short);
