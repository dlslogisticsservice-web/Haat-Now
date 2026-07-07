#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Production environment validator (Production Activation Sprint).
// Fails fast, BEFORE a live deploy, when the client build is missing required env.
// It reads process.env (the deploy context: Vercel/CI inject env there), determines
// whether this is a LIVE build, and enforces the required VITE_* client vars.
//
//   node scripts/check-env.cjs            → validate current env
//   HAAT_LIVE_BACKEND=1 node scripts/...  → force live-mode validation
//
// Exit 0 = ok (or sandbox demo build — nothing required).  Exit 1 = missing required vars.
// Server-side secrets (Supabase service role, Moyasar, SMS provider) are NOT part of the
// web build — they live in Supabase/Edge config and are tracked in the activation checklist.
// ─────────────────────────────────────────────────────────────────────────────

const env = process.env;

// Live when the operator opts in (HAAT_LIVE_BACKEND=1, as scripts/live.cjs sets) or the auth
// mode is explicitly non-sandbox. The sandbox demo build requires no external configuration.
const isLive = env.HAAT_LIVE_BACKEND === '1' || (env.VITE_AUTH_MODE && env.VITE_AUTH_MODE !== 'sandbox');

const REQUIRED = [
  { key: 'VITE_SUPABASE_URL', test: v => /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(v), hint: 'https://<project-ref>.supabase.co' },
  { key: 'VITE_SUPABASE_ANON_KEY', test: v => v.length > 20 && !/^(MY_|<|\?|changeme)/i.test(v), hint: 'the project publishable/anon key' },
];

// Recommended — warned about (non-fatal): the build works, the feature is degraded without them.
const RECOMMENDED = [
  { key: 'VITE_SENTRY_DSN', why: 'error/crash monitoring (Sentry) is disabled without it' },
  { key: 'VITE_GOOGLE_MAPS_API_KEY', why: 'tracking map tiles are degraded without it' },
  { key: 'VITE_ANALYTICS_URL', why: 'analytics ingestion endpoint (optional)' },
];

function main() {
  if (!isLive) {
    console.log('✓ check-env: sandbox demo build — no external env required.');
    process.exit(0);
  }

  const missing = [];
  const invalid = [];
  for (const r of REQUIRED) {
    const v = (env[r.key] || '').trim();
    if (!v) missing.push(r);
    else if (r.test && !r.test(v)) invalid.push(r);
  }

  for (const r of RECOMMENDED) {
    if (!(env[r.key] || '').trim()) console.warn(`⚠ ${r.key} not set — ${r.why}.`);
  }

  if (missing.length === 0 && invalid.length === 0) {
    console.log('✓ check-env: live build — all required client env vars present.');
    process.exit(0);
  }

  console.error('\n✗ check-env: live build is missing required environment configuration:\n');
  for (const r of missing) console.error(`  MISSING  ${r.key}   (e.g. ${r.hint})`);
  for (const r of invalid) console.error(`  INVALID  ${r.key}   (expected ${r.hint})`);
  console.error('\nSet these in the deploy environment (Vercel → Settings → Environment Variables),');
  console.error('then re-run. See docs/launch/PRODUCTION_ACTIVATION_CHECKLIST.md.\n');
  process.exit(1);
}

main();
