# HAAT NOW — Production Security Audit Report

Read-only pre-launch security review. Scope: application code, the production Supabase
backend (`haat-now-prod` · `ckmqxhjdrfztkunqprax`), edge functions, CI/CD, dependencies,
and store/privacy compliance. No code changed, nothing deployed.

**Evidence base:** Supabase security advisors (prod, 206 findings), `npm audit`, live
response headers, source review, and prior LR/PA phase verifications.

---

## Executive summary
- **No Critical or Error-level defects** were confirmed: RLS is enabled on **all 150 tables** (0 disabled), no secrets are committed, no `service_role` key reaches the client, payment webhooks verify HMAC-SHA256 (fail-closed), payment amounts are server-authoritative + idempotent, and strong security headers (HSTS preload, CSP, X-Frame DENY, COOP) are served live.
- **The dominant risk is one HIGH finding:** **78 `SECURITY DEFINER` RPCs are granted `EXECUTE` to the `anon` (unauthenticated) role** — including `assign_user_role`, `revoke_user_role`, `ban_entity`, `suspend_entity`, `review_kyc`, `create_order`, `generate_*_settlement`, `complete_delivery_payout`. Most have internal RBAC guards, but the exposure is unverified per-function and violates least-privilege. **Elevates to CRITICAL if any one lacks an internal authorization check.**
- **Operational gaps** (HIGH): no production backups/PITR (free-tier prod project) and no active monitoring/alerting (Sentry seam only).
- **Verdict:** **GO WITH CONDITIONS for a COD-only Closed Beta** (small trusted cohort) after the P0 checklist; **NO-GO for Public Launch** until the High/Medium DB-security items, backups, and monitoring are remediated. See `GO_NO_GO_REPORT.md`.

> Context: the currently-deployed `haatnow.app` is still the **sandbox demo**, not the prod backend. This audit covers the code + prod backend that a real launch would serve.

---

## Findings register

| # | Finding | Severity | Area |
|---|---|---|---|
| F1 | 78 SECURITY DEFINER RPCs executable by `anon` | **HIGH** (Critical-if-unguarded) | RLS/RPC/API |
| F2 | No production backups / PITR (free-tier prod) | **HIGH** | Backup/DR |
| F3 | No active monitoring/alerting (Sentry DSN unset) | **HIGH** | Monitoring |
| F4 | CSP `script-src 'unsafe-inline'` | Medium | CSP/XSS |
| F5 | 3 always-true INSERT RLS policies (campaign_events, order_status_history, search_analytics) | Medium | RLS |
| F6 | 13 `SECURITY DEFINER` functions with mutable `search_path` | Medium | RPC/Injection |
| F7 | 6 public storage buckets allow listing (enumerable) | Medium | Storage/Buckets |
| F8 | Wildcard CORS (`*`) on JWT-gated payment edge functions | Medium | CORS/API |
| F9 | Component-platform raw-HTML block not sanitized | Medium | XSS |
| F10 | `tar` critical npm advisory (build-time transitive dep) | Low | Supply chain |
| F11 | `pg_trgm` extension in `public` schema | Low | DB hardening |
| F12 | Leaked-password protection / OTP-expiry not confirmed enabled | Low | Auth config |
| F13 | `supabase/.temp` tracked in git (project metadata, not secrets) | Info | Secrets hygiene |
| F14 | GitHub secret-scanning / Dependabot not verified | Info | Supply chain |

### F1 — Anon-executable SECURITY DEFINER RPCs — **HIGH**
- **Root cause:** functions are `SECURITY DEFINER` (run with owner rights, bypassing RLS) and inherit the default `GRANT EXECUTE … TO public`, so the `anon` role can call them via `POST /rest/v1/rpc/<fn>`. 78 functions affected (advisor `anon_security_definer_function_executable`), incl. privileged ones (`assign_user_role`, `ban_entity`, `generate_accounting_export`, `complete_delivery_payout`, `create_order`).
- **Risk:** an unauthenticated caller could invoke a privileged operation if that function's internal guard is missing or bypassable; SECURITY DEFINER means table-level RLS does not protect it. Potential privilege escalation, fraudulent orders/settlements, RLS bypass.
- **Recommended fix:** `REVOKE EXECUTE ON FUNCTION …() FROM anon` (and `public`) on every non-public RPC; keep EXECUTE only on genuinely public read RPCs (`trending_products`, `search_catalog`, `recommended_merchants`, `order_tracking` if intended). Then audit each remaining function for an explicit internal check (`auth.uid()`, `auth_is_admin`, `auth_has_permission`). Prefer `SECURITY INVOKER` where feasible.
- **Estimated fix time:** 1–2 days (one revoke migration + per-function guard review).

### F2 — No production backups / PITR — **HIGH**
- **Root cause:** the prod project is on the Supabase **free** plan, which has no Point-in-Time Recovery and limited/again-unverified backups; no restore drill has been run.
- **Risk:** unrecoverable loss of real customer, order, wallet, and payment data on corruption/incident.
- **Recommended fix:** upgrade the org to **Pro**, enable daily backups + PITR, and run one restore drill to a scratch project.
- **Estimated fix time:** 0.5 day (+ billing action).

### F3 — No active monitoring/alerting — **HIGH**
- **Root cause:** `monitoring.service` is a seam that POSTs to `VITE_SENTRY_DSN` only when set; the DSN is unset and no SDK is bundled, so errors stay in an in-memory ring buffer. No alert rules exist.
- **Risk:** production incidents (auth failures, payment errors, RPC abuse) go unseen during launch.
- **Recommended fix:** set `VITE_SENTRY_DSN` (or wire a real SDK) + define alert rules (error rate, auth failure spike, dead-letter growth). The auth + email platforms already emit structured events into the seam.
- **Estimated fix time:** 0.5 day.

### Medium findings (fixes)
- **F4 CSP unsafe-inline:** move to nonce/hash-based `script-src`; remove `'unsafe-inline'`. ~0.5–1 day (inline bootstrap refactor).
- **F5 always-true INSERT policies:** replace `WITH CHECK (true)` with owner/tenant-scoped predicates. ~2–4h.
- **F6 mutable search_path:** `ALTER FUNCTION … SET search_path = ''` on the 13 functions. ~2–4h.
- **F7 listable buckets:** drop the broad `SELECT`/list policy on `storage.objects` for the 6 public buckets (object URLs still work). ~1–2h. *(kyc-documents is correctly private.)*
- **F8 wildcard CORS:** restrict `Access-Control-Allow-Origin` to the app origin(s) on `payment-initiate`/`payment-verify` (mitigated today by required JWT + no cookie auth). ~1–2h.
- **F9 raw-HTML block:** the `component-platform` `html` component renders author HTML unsanitized (the `website-platform` renderer IS escaped + href-scheme-restricted). Sanitize or restrict authoring to trusted roles. ~2–4h.

### Low / Informational
- **F10 tar advisory:** build-time transitive dep (not in the browser bundle); `npm audit fix`/upgrade. ~0.5h.
- **F11 pg_trgm in public:** move to `extensions` schema. ~1h.
- **F12 auth config:** confirm + enable leaked-password protection; verify OTP expiry (not in the DB advisor dataset — dashboard check). ~15m.
- **F13 supabase/.temp tracked:** add `supabase/.temp/` to `.gitignore` (contains project ref/pooler URL — not credentials). ~15m.
- **F14 GitHub scanning:** enable secret scanning + Dependabot in repo settings. ~15m.

---

## Coverage — all 40 areas

| # | Area | Status | Notes |
|---|---|---|---|
| 1 | OWASP Top 10 | 🟡 | Strong headers/RLS/crypto; A01 (broken access control) → F1; A05 (misconfig) → F4/F7 |
| 2 | OWASP API Top 10 | 🟡 | API1 BOLA / API5 BFLA → F1 (anon RPC EXECUTE) |
| 3 | Authentication | ✅ | Email OTP, server-authoritative, rate-limit + lockout, masked telemetry |
| 4 | Authorization (RBAC) | 🟡 | `role_permissions` + `auth_has_permission`/`auth_is_admin`; verify each anon RPC guard (F1) |
| 5 | Supabase RLS | ✅ | **All 150 tables RLS-enabled, 0 disabled**; 3 permissive INSERT policies (F5) |
| 6 | JWT security | ✅ | Supabase-managed (HS256, short access TTL, refresh rotation); no service_role in client |
| 7 | Session security | ✅ | supabase-js session; logout audited; sandbox isolated |
| 8 | Rate limiting | ✅ | Client OTP guard + Supabase server-side; edge/webhook rely on Supabase |
| 9 | Replay protection | ✅ | OTP single-use/consumed; payment idempotency keys; webhook_events dedup |
| 10 | Webhook signature | ✅ | HMAC-SHA256, fail-closed (503 if secret missing); ensure `WEBHOOK_ALLOW_UNSIGNED` never set in prod |
| 11 | Payment security | ✅ | Idempotency, server-authoritative amount, refund saga, COD-only gate |
| 12 | Storage security | ✅ | kyc-documents private; 23 storage policies |
| 13 | Bucket policies | 🟡 | 6 public buckets allow listing (F7) |
| 14 | Upload validation | 🟡 | Client accept + max-size (partner docs); confirm server-side/storage MIME+size enforcement |
| 15 | CSP | 🟡 | Strong CSP served; `script-src 'unsafe-inline'` (F4) |
| 16 | XSS | ✅ | Website renderer escapes all fields + href scheme allow-list + security test; raw-HTML block (F9) |
| 17 | CSRF | ✅ | Token (JWT header) auth, not cookies → CSRF surface minimal; `form-action`/`frame-ancestors` set |
| 18 | Clickjacking | ✅ | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| 19 | CORS | 🟡 | Wildcard on JWT-gated payment fns (F8) |
| 20 | Secrets management | ✅ | None committed; `.env*` gitignored; publishable keys removed (LR-1); no service_role client-side |
| 21 | Environment variables | ✅ | Server secrets non-`VITE_`; client vars are publishable-only |
| 22 | Edge functions | ✅ | payment-* JWT/HMAC as designed; not yet on prod project (deploy step) |
| 23 | Database security | ✅ | RLS enabled; PII-lockdown migration; audit tables |
| 24 | SQL injection | ✅ | Parameterized (PostgREST/RPC); no raw string SQL in client |
| 25 | RPC security | 🔴→🟡 | F1 (anon EXECUTE) + F6 (search_path) |
| 26 | Triggers | ✅ | Trigger fns are SECURITY DEFINER; covered by F1/F6 remediation |
| 27 | Monitoring | 🟡 | Seam only, DSN unset (F3) |
| 28 | Logging | ✅ | Structured audit_logs/operation_events + monitoring seam (masked) |
| 29 | Incident response | 🟡 | Runbooks exist; alerting gap (F3) |
| 30 | Disaster recovery | 🟡 | Rollback runbook; restore drill not run (F2) |
| 31 | Backup strategy | 🔴 | No PITR on free-tier prod (F2) |
| 32 | Dependency audit | 🟡 | `tar` advisory, build-time (F10); 16 runtime deps |
| 33 | npm supply chain | 🟡 | Pin + `npm audit fix`; enable Dependabot (F14) |
| 34 | GitHub secret scanning | ⚪ | Not verifiable here — enable in repo settings (F14) |
| 35 | Apple App Store compliance | ✅ | Account deletion, privacy policy present; OTP auth; no private-API use in web |
| 36 | Google Play compliance | ✅ | Same; data-safety form to complete at submission |
| 37 | Privacy policy compliance | ✅ | `src/config/legal.ts` (privacy + terms, ar/en) |
| 38 | Account deletion | ✅ | `delete_my_account` RPC + migration + `account.service` (store-required) |
| 39 | Penetration test checklist | 🟡 | Provided in `PRODUCTION_LAUNCH_CHECKLIST.md`; run after F1 fix |
| 40 | Launch readiness | 🟡 | Closed Beta go-with-conditions; public launch blocked on F1–F3 |

Legend: ✅ pass · 🟡 needs work · 🔴 blocker · ⚪ unverifiable here.

---

## Strengths (verified)
Enabled RLS on every table; no committed secrets / no client-side service_role; HMAC-verified fail-closed webhooks; idempotent, server-authoritative payments; strong live security headers (HSTS preload, CSP, X-Frame DENY, COOP, Permissions-Policy); escaped website rendering; parameterized DB access; implemented account deletion + legal content; clean architecture (0 dep cycles / 0 violations / 777 tests).

## Remediation priority
**P0 (before ANY real traffic):** F1, F5. **P0 (before public launch):** F2, F3, F6, F7, F8, F4. **P1:** F9, F10, F11, F12. **P2/Info:** F13, F14. None require feature work; all are configuration/SQL/ops.
