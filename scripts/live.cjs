#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Phase 9 · P0-1 — cross-platform live-backend runner.
// Sets HAAT_LIVE_BACKEND=1 (which vite.config.ts reads to select VITE_AUTH_MODE=supabase)
// then runs vite. Works identically on Windows (cmd/PowerShell) and POSIX shells, where an
// inline `HAAT_LIVE_BACKEND=1 vite …` prefix would not.
//
// Usage:  node scripts/live.cjs dev     → live dev server
//         node scripts/live.cjs build   → live production build (+ version stamp)
// ─────────────────────────────────────────────────────────────────────────────
const { spawnSync } = require('child_process');

const mode = process.argv[2] === 'dev' ? 'dev' : 'build';
const env = { ...process.env, HAAT_LIVE_BACKEND: '1' };

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

// Environment validation. For a real production BUILD this is a HARD gate — a bundle that
// ships with a missing/invalid Supabase URL or anon key would boot to `supabase = null` and
// a fatal console error for every user. CI (which compiles the live bundle without secrets)
// and local `dev` opt out via HAAT_ENV_ADVISORY=1; a production deploy must NOT set that.
{
  const envCheck = spawnSync('node', ['scripts/check-env.cjs'], { stdio: 'inherit', env, shell: process.platform === 'win32' });
  const advisory = process.env.HAAT_ENV_ADVISORY === '1' || mode === 'dev';
  if (envCheck.status !== 0) {
    if (advisory) console.warn('[live] check:env failed — continuing (advisory: dev or HAAT_ENV_ADVISORY=1).');
    else { console.error('[live] check:env failed — refusing to build a production bundle with invalid env. Set HAAT_ENV_ADVISORY=1 only for CI compile checks.'); process.exit(envCheck.status ?? 1); }
  }
}

if (mode === 'dev') {
  run('vite', ['--port=3000', '--host=0.0.0.0']);
} else {
  run('vite', ['build']);
  run('node', ['scripts/gen-version.cjs']);
}
