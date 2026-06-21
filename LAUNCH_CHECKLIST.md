# LAUNCH_CHECKLIST.md — HAAT NOW

Gate to go-live. Backend live-verified (migrations 0000–0022, RLS, admin scoping, auth, RBAC). This checklist covers deploy + launch. Scope per launch type noted (**SA COD soft-launch** is the nearest milestone).

## ✅ Already done (verified live)
- DB migrations applied + recorded; RLS + admin country scoping + feature RPCs live-verified.
- Phone auth enabled (Test OTP); 6 role accounts provisioned + verified.
- Production build strips sandbox (proven 0/6); app builds clean.

## 🔴 MUST-HAVE before launch
- [ ] **Choose host + commit deploy config** (`vercel.json` / `netlify.toml` / CF Pages) with `dist` + SPA rewrite.
- [ ] **Set build env vars** on the host: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, **`VITE_AUTH_MODE=supabase`** (critical).
- [ ] **Deploy** and confirm: sandbox stripped, demo `123456` rejected for non-provisioned phones, real OTP→JWT login works.
- [ ] **Update Supabase `site_url`** to the prod domain + add to `uri_allow_list`.
- [ ] **Real SMS provider (Twilio)** configured in Supabase Auth; **remove Test OTP** numbers. *(Or knowingly launch closed-beta with Test OTP.)*
- [ ] **Run `E2E_TEST_PLAN.md`** for all 4 roles on the deployed build → all PASS.
- [ ] **Payment path decided:**
  - COD-only soft-launch → COD verified end-to-end (no gateway needed), **or**
  - Card payments → gateway keys (frontend `VITE_*_PUBLIC_KEY` + Edge secrets + `PAYMENT_MODE=production`) + webhook wired + a real test charge.
- [ ] **Rotate the Supabase access token** used during cutover (it was shared in plaintext; gitignored in `.mcp.json`).
- [ ] **EG geography seeded** — *only if launching the Egypt market* (SA is ready; EG has no zones/cities).
- [ ] Basic **monitoring**: Supabase logs/alerts; host build/deploy alerts.

## 🟡 SHOULD-HAVE before launch
- [ ] **`VITE_GOOGLE_MAPS_API_KEY`** set (referrer-restricted) → interactive maps; else fallback ships.
- [ ] **Custom domain + HTTPS** + `www`/apex redirect.
- [ ] Tune **auth rate limits** (`rate_limit_otp`/`rate_limit_sms_sent`) for expected volume.
- [ ] **Provision real operator accounts** (replace demo phones for staff merchants/drivers/admins).
- [ ] **Error tracking** (Sentry or similar) on the frontend.
- [ ] **Backups/PITR** confirmed on the Supabase project; review project tier for prod load.
- [ ] Rename `package.json` `name` from `react-example` (cosmetic).
- [ ] Privacy policy / terms links live (Profile → support already wired).
- [ ] Smoke-test on real devices (iOS/Android browsers), RTL/AR + EN.

## 🟢 POST-LAUNCH items
- [ ] **Push notification delivery** (FCM/APNs) on top of existing token registration + center.
- [ ] **EG market** rollout (seed geography, EG merchants/drivers, EG payment provider).
- [ ] Real **SMS cost monitoring** + fraud/rate controls.
- [ ] Loyalty tiers / redemption catalog; coupon analytics.
- [ ] Inventory: bulk import, supplier management.
- [ ] Move project off `haat-now-dev` naming / dedicated prod project if desired; promote migrations via CI (`supabase db push`, ledger already consistent).
- [ ] Performance: image CDN, bundle analysis, caching headers.
- [ ] Analytics/observability dashboards for orders, GMV, driver utilization.

## Launch decision gate
**SA COD soft-launch = GO** when all 🔴 MUST-HAVE (COD path) are checked and `E2E_TEST_PLAN.md` passes. Card payments, EG market, and push delivery follow as their MUST/POST items complete.

> Planning only — no code or database changes made in this sprint.
