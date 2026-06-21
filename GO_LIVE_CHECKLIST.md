# GO_LIVE_CHECKLIST.md — HAAT NOW

Operational sequence to take HAAT NOW live on Vercel. Backend is live + verified; DB untouched here.

## Pre-deploy
- [ ] Branch pushed to GitHub (`feat/auth-recovery-frontend-sprint` or merged to `main`).
- [ ] `vercel.json` present (build `npm run build`, output `dist`, SPA rewrites) ✅ committed.
- [ ] Vercel project created/imported; framework = Vite (auto).
- [ ] **Env vars set in Vercel (Production):** `VITE_AUTH_MODE=supabase`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (+ Maps/payment keys if used) — see `VERCEL_ENV_SETUP.md`.
- [ ] (If cards) Supabase Edge Function payment secrets set; `PAYMENT_MODE=production`.
- [ ] Local sanity: `npm run build` exits 0 (already verified).

## Deploy
- [ ] Trigger deploy (Git push or `vercel --prod`).
- [ ] Build log: success; output `dist` published.
- [ ] Note the production URL.

## Post-deploy (Supabase config — `SUPABASE_PRODUCTION_CONFIG.md`)
- [ ] Set **Site URL** = the deployed domain.
- [ ] Add domain (+ `*.vercel.app` if previews) to **Redirect URLs**.
- [ ] (Public launch) configure **Twilio** + remove **Test OTP**.
- [ ] **Rotate the Supabase access token** used during cutover.

## Smoke tests (on the deployed URL — fast gate)
- [ ] App loads; no console errors; AR/RTL renders.
- [ ] **Sandbox absent:** demo `123456` rejected for a NON-provisioned phone; bundle has no `DEMO_ACCOUNTS`.
- [ ] **Customer login:** +201000000001 + `123456` (Test OTP) → home; refresh keeps session; `localStorage` has `sb-…-auth-token`, no `haat_sandbox_session`.
- [ ] **Customer flow:** browse → add to cart → checkout (COD) → order placed → appears in Orders → tracking renders.
- [ ] **Merchant:** +201000000002 → portal loads; sees own-branch order; inventory adjust persists.
- [ ] **Driver:** +201000000003 → portal loads; can go online; accept + complete a job → wallet credited.
- [ ] **Admin:** +201000000005 (super) → analytics load; create a coupon. **Saudi Admin** sees SA orders only; **Egypt Admin** sees none (isolation); no `42501`/recursion.
- [ ] **Wallet/Loyalty/Notifications:** balances load; points awarded on delivery; notification drawer updates.

## Go / No-Go
- **GO** when: deploy succeeds, sandbox-absent verified, and the 4 role smoke tests pass with no authorization errors.
- Full validation: run `E2E_TEST_PLAN.md` before opening to real users.

## Rollback
- Vercel → Deployments → **promote the previous deployment** (instant). No DB rollback needed (config-only changes; revert `site_url` if necessary).
