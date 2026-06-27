# RELEASE_STATUS — HAAT NOW (RC phase)

Release-manager view. Honest percentages. Builds on the audit reports
(`01`–`07`, `CI_PIPELINE_FIX_REPORT`, `MERCHANT_*`).

## This sprint — Critical item delivered: **Account Deletion (all 3 roles)** ✅ REAL
Apple Guideline 5.1.1(v) + Google Play data-deletion are **hard store-submission blockers**. Was a
`mailto:` request (non-compliant) → now a real backend deletion.
- **DB/RPC:** `supabase/migrations/20260627000001_account_deletion.sql` — `delete_my_account()`
  SECURITY DEFINER: anonymizes transactional profiles (customers/drivers/merchants by `auth.uid()`),
  hard-deletes personal rows (addresses/push_tokens/reviews), removes the `auth.users` identity.
  `grant execute … to authenticated` (uid from JWT, not args — a user can only delete themselves).
- **Service:** `src/services/account.service.ts` — `deleteMyAccount()` calls the RPC + `auth.signOut()`;
  sandbox clears local state.
- **UI (all roles):** Customer (`ProfileScreen` Privacy hub — real delete + logout), Merchant
  (`#merchant_delete_account`), Driver (`#driver_delete_account`). Bilingual + danger confirm dialog.
- Build ✅ · Typecheck ✅ (raw, 0 errors) · E2E 24/24 ✅.
- **Apply note:** MCP is read-only, so the migration is committed but **not yet applied to the live
  DB** — run `supabase db push` (or apply mig 0001 + 20260626000001/2/3 + this). Until applied, the
  sandbox path works; the production RPC activates on apply.

## Release checklist (STEP 8) — status
| Item | Status |
|---|---|
| Customer / Merchant / Driver account deletion + Delete endpoint | ✅ this sprint (RPC + UI) |
| Export personal data | ✅ (client JSON export in Privacy hub) |
| Privacy / Terms / Cookie / Refund / Cancellation / Licenses | ✅ in-app summaries (full lawyer text = owner legal dep, blocked) |
| Permissions disclosure + iOS ATT + age 16+ | ✅ |
| Apple / Google compliance (deletion + privacy + permissions) | 🟡 mostly; needs native build + store listing |
| CI/CD (typecheck/build/E2E/edge-functions) | ✅ GREEN (verified run 28267201287) |
| Offline / Service worker / PWA manifest | ✅ shell SW + manifest |
| Error boundary | ✅ |
| **App icons / Adaptive icons** | ✅ generated from brand (PWA + Android all densities + adaptive); `npm run gen:icons` |
| **Native android/ + ios/ projects** | ✅ generated (`cap add`); committed (compilable with SDK/Xcode) |
| **iOS Info.plist (usage desc + ATT + export compliance + URL scheme)** | ✅ |
| **AndroidManifest (deep links + App Links + permissions)** | ✅ |
| Deep links (custom scheme) | ✅ `haatnow://` (Android + iOS) |
| Push (FCM) / Universal Links / App Links verification | 🟡 prepared; needs Firebase configs + hosted `assetlinks.json`/`AASA` (operator) — see `NATIVE_RELEASE.md` |
| Splash / Launch screens | 🟡 Capacitor defaults present; brand splash = operator asset |
| **Version checker / Force update / Maintenance mode** | ✅ `AppGate` + `releaseService` (reads `settings` rows) |
| **Offline detection** | ✅ `AppGate` offline banner (navigator online/offline) |
| **Crash reporting / Analytics / Production logging** | ✅ `monitoring.service` seam (env-gated POST; ErrorBoundary wired) — operator sets `VITE_SENTRY_DSN`/`VITE_ANALYTICS_URL` |
| Rate / Share App | ❌ not built |
| Backup / Restore / Disaster recovery | 🟡 Supabase-managed PITR (provider-level); no app runbook |

## Critical blockers (ranked)
1. **Mobile release assets** — app icon PNGs missing, no native `android/ios` projects, push not
   wired. Blocks store submission. (Needs design assets + `npx cap add`.)
2. **Apply pending migrations** to the live DB (account deletion, audit-logs grant, platform/store
   settings). MCP read-only → operator runs `supabase db push`.
3. **Full legal text** (lawyer-reviewed) — owner legal dependency.
4. **Vercel production secrets** — `VERCEL_TOKEN`/`ORG`/`PROJECT` for auto-promote on `main`.

## Next sprint (auto-selected, blocker-free)
- **Force-update + version checker + maintenance gate** (reads `settings`/`platform_*` — already
  exists; pure frontend + a flag). Then **Variant Manager** (merchant; `product_variants` table
  exists, needs a write service — no migration).

## Enterprise hardening (this sprint) — see `ENTERPRISE_HARDENING_REPORT.md`
- ✅ Security headers + scoped **CSP** (Supabase/Paymob/Maps/Fonts/Unsplash) in `vercel.json`; HSTS,
  X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy, COOP.
- ✅ DB **performance indexes** (`20260627000002`, column-guarded) on orders/notifications/reviews/etc.
- ✅ **Secrets audit** clean; ✅ repo cleanup (audits→`docs/audits`, reports→`docs/archive`).
- ✅ Verified already-present: code splitting/lazy, env validation, audit logs, Supavisor pooling, CDN.
- 🟡 Operator/infra: Redis/queue/DLQ/circuit-breaker/tracing = provision a managed tier (not faked);
  rate limiting = edge config; Firebase/push = credentials.

## Production readiness (honest)
- **Web / PWA: ~86%** (hardened: CSP + secure headers + query indexes; CI green).
- **App Store (iOS): ~70%** · **Google Play: ~72%** (native projects + icons + manifests done;
  Firebase + signed builds + hosted link files remain).
- **Multi-tenant SaaS: ~20%** (registry foundation only).
- **Overall: ~68%** — gated on credential injection + applying migrations + signed native builds,
  none of which are code-architecture problems.
