# Production Cutover Runbook — FINAL (Closed Beta)

The exact operator procedure to take HAAT NOW live for a **COD Closed Beta** on the certified
backend `haat-now-prod` (`ckmqxhjdrfztkunqprax`). Everything up to deployment is done and verified
(security, backend activation, operational bootstrap, backend E2E). The steps below are the
**operator-credential** actions this automation cannot perform. Estimated time: **~45–60 min**.

**Roles:** Release Captain · On-call Engineer. **Rollback is always available** (revert to sandbox).

---

## 0. Prerequisites (accounts/keys you provide)
- Vercel access to the `haat-now` project (linked to `haatnow.app`).
- A **Resend** account + API key + a verified sending domain (or another SMTP).
- A **Google Cloud** Maps JavaScript API key (`VITE_GOOGLE_MAPS_API_KEY`), HTTP-referrer-restricted.
- (Recommended) a **Sentry** project DSN (`VITE_SENTRY_DSN`).

## 1. Configure Supabase Auth email (Resend SMTP) — fixes multi-user OTP
1. Supabase → `haat-now-prod` → **Authentication → Emails → SMTP Settings** → enable custom SMTP:
   host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender =
   your verified domain (e.g. `no-reply@haatnow.app`).
2. Authentication → **URL Configuration**: set Site URL to your closed-beta URL and add it to
   Redirect URLs. Keep **Confirm email = ON** (OTP verification; `mailer_autoconfirm` stays false).
3. (Optional) Authentication → Providers → Email: restrict to existing users if you want an
   invite-only beta.

## 2. Set Vercel production environment variables
Vercel → `haat-now` → Settings → Environment Variables (Production):
```
VITE_SUPABASE_URL       = https://ckmqxhjdrfztkunqprax.supabase.co
VITE_SUPABASE_ANON_KEY  = sb_publishable_pUyE65V6ehQLaIs-WzokPg_zWRJlyti   # public publishable key
VITE_AUTH_MODE          = supabase                                         # live backend
PAYMENT_MODE            = cod
HAAT_LIVE_BACKEND       = 1                                                # forces the live build
VITE_GOOGLE_MAPS_API_KEY= <your Google Maps JS API key>
VITE_SENTRY_DSN         = <your Sentry DSN>                                # optional but recommended
```
> The publishable key is client-safe by design. **Never** set the service-role key in the web build.

## 3. Deploy the live build
- If Vercel's build command is `npm run build`, override it (Project → Settings → Build) to
  `npm run build:live`, **or** rely on `HAAT_LIVE_BACKEND=1` (step 2) which makes `npm run build`
  emit the live bundle. Either yields `VITE_AUTH_MODE=supabase`.
- Deploy: `vercel --prod` (or "Promote to Production" from a preview). Do **not** delete the
  current (sandbox) deployment — it is the rollback target.

## 4. Verify the deployment
- `curl https://<closed-beta-url>/version.json` → `sha` == the commit you deployed, `env=production`.
- `curl https://<closed-beta-url>/health.json` → `{"status":"ok",…}`.
- Load the site: no CSP console errors; **no sandbox/demo banner** (confirms live mode).

## 5. Smoke test sequence (P0 = rollback if it fails)
Use the operator's own Gmail `+tag` accounts already seeded (admin / `+merchant1` / `+driver1`)
plus a fresh `+customer1`:
- [ ] **P0** Customer registration + **email OTP** received (real inbox) + login → customer app.
- [ ] **P0** Browse merchant "Cairo Eats" + products (Koshari/Chicken/Drink) render.
- [ ] **P0** Place a **COD** order → appears as `pending`.
- [ ] **P0** Merchant login (`+merchant1`) → accept the order.
- [ ] **P0** Admin login (operator email) → dashboard loads; dispatch the order to the driver.
- [ ] **P0** Driver login (`+driver1`) → accept → mark on_the_way → complete delivery → `delivered`.
- [ ] **P0** **Realtime**: order status + driver location update live on the customer screen.
- [ ] **P1** Live tracking map renders (Maps key). Delete-account flow works. RLS: a 2nd customer
      cannot see the first's order.
- **After smoke:** delete the test order/customer so production starts clean (or leave the seed
  order as the first beta order — your call).

## 6. Monitoring (first 60 min intensive, 24 h heightened)
- `/health.json` + `/version.json` (sha correct). Supabase → Logs (api/auth/postgres) for 4xx/5xx.
- Auth: OTP request→verify success rate; Resend dashboard for bounces/deliverability.
- Orders: `select status,count(*) from orders group by status;` progresses; nothing stuck.
- `select * from cron.job_run_details order by end_time desc limit 20;` sweeps succeed.
- Ledger sanity: `select coalesce(sum(debit-credit),0) from ledger_entries;` == 0.
- Sentry (if set) crash-free sessions.
- **Alert/page:** 5xx > 2% (5 min) · OTP verify < 90% · order stuck > 15 min · DB CPU > 80%.

## 7. Rollback (< 10 min, always safe)
1. **Frontend:** Vercel → promote the **previous (sandbox) deployment** — instant. Or set
   `VITE_AUTH_MODE=sandbox` and redeploy. Confirm `/version.json` reverts.
2. **No destructive DB action.** This cutover applies **no schema change** (migrations were
   applied/certified earlier). Seed data is additive; if a bad seed row is implicated, disable it —
   do not drop tables. Migrations are forward-only (a fix is a new migration, never a down-migration).
3. Comms: post status; pause beta invites. File an incident (§8) before retrying.

## 8. Incident response
- SEV1 (outage / auth down / data-integrity) → page on-call → Release Captain declares → rollback
  (§7) → 15-min status updates → RCA after stabilization.
- **Security incident:** capture evidence read-only; the regression suites (`supabase/tests/*`) are
  the reference for expected protections; never hot-patch prod without a migration + regression test.
- Contacts: Release Captain → On-call Engineer → Ops Admin (fill real names/pagers before launch).

## 9. Post-cutover
- 24 h: error rate, OTP success, order completion, cron success, ledger balance.
- Before **public** launch: fill legal-entity placeholders; host Universal/App-Link files; deploy
  the payment webhook + activate Paymob; fix the settlement-cron authorization; provision FCM/APNs;
  re-run the full security certification.

---

### Appendix — verified state (as of cutover prep)
- Backend `haat-now-prod`: 7 security migrations, 4 active cron, RLS/RPC enforced, storage kyc-private.
- Seed: 1 super admin (EG), Egypt/Cairo + 2 zones + fees, approved merchant "Cairo Eats" + 3
  products, 1 driver; **0 orders / 0 customers**.
- Backend E2E: full order→delivery verified (earnings/wallet/ledger correct).
- Bundle: `build:live` targets `haat-now-prod` only (0 dev refs), COD-only.
