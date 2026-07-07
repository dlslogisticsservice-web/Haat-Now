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

// Advisory environment validation — surfaces missing LIVE client env (Supabase URL/key)
// early. Non-fatal on purpose: CI compiles the live bundle without secrets, and the deploy
// host injects real env. A production deploy should gate on `npm run check:env` (exit code).
spawnSync('node', ['scripts/check-env.cjs'], { stdio: 'inherit', env, shell: process.platform === 'win32' });

if (mode === 'dev') {
  run('vite', ['--port=3000', '--host=0.0.0.0']);
} else {
  run('vite', ['build']);
  run('node', ['scripts/gen-version.cjs']);
}
