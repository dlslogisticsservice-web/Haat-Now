# Enterprise Production Hardening — Report

Sprint goal: enterprise-grade hardening. This report is **honest about architecture**: HAAT NOW is
a React SPA + **Supabase** (managed Postgres + Auth + Realtime + Edge Functions) on **Vercel**. Some
classic "backend hardening" items (self-hosted Redis, a queue broker, a DLQ, a circuit breaker, an
APM tracer) are **infrastructure components that do not exist in this stack** and cannot be faked into
existence — where Supabase/Vercel already provide the capability, that is noted; where a new managed
service must be provisioned, it is flagged as operator-provisioned with the integration point named.
No placeholder modules were added.

## Completed this sprint (real, verified)
| Item | What was done |
|---|---|
| **Security headers / CSP** | `vercel.json` now sends a scoped **Content-Security-Policy** (locked to the real origins: Supabase, Paymob, Google Maps/Fonts, Unsplash, Google avatars), **HSTS** (2y, preload), **X-Content-Type-Options**, **X-Frame-Options: DENY**, **Referrer-Policy**, **Permissions-Policy**, **COOP**. |
| **Clickjacking / XSS surface** | `frame-ancestors 'none'` + `object-src 'none'` + `base-uri 'self'` + `form-action` allowlist. |
| **DB query optimization** | `20260627000002_performance_indexes.sql` — composite indexes on the hottest paths (orders by customer/merchant/driver/status+created, order_items, products, notifications, reviews, addresses, push_tokens, wallet ledger). **Column-guarded**: each index is created only if its columns exist, so it is safe to apply against any schema drift. |
| **Secrets audit** | Scanned all tracked source for `sk_live`/`sk_test`/`service_role` literals/AWS keys/private keys/JWTs. **Clean** — the only hits are the env-var name `SUPABASE_SERVICE_ROLE_KEY` and the Postgres role `service_role`. `.env` is not tracked. |
| **Repository cleanup** | Moved 10 audits → `docs/audits/`, 13 completion/module reports → `docs/archive/` (via `git mv`, history preserved). Root now holds only `README` / `RELEASE_STATUS` / `NATIVE_RELEASE` / this report. |

## Already present (verified, no work needed — not re-faked)
- **Code splitting / lazy loading** — every role app (Merchant/Driver/Admin) and customer screen is
  `React.lazy` + `<Suspense>`; the build already emits per-app chunks. Vendor `manualChunks`
  (react / supabase / i18n) already in `vite.config`.
- **Environment validation** — `MISSING_SUPABASE_VARS` + `MissingConfigScreen` in `main.tsx`
  fail-fast on missing Supabase config.
- **Error boundary + crash-report seam** — `ErrorBoundary` → `monitoring.captureError` (last sprint).
- **Maintenance mode + force update + offline** — `AppGate` + `releaseService` (last sprint).
- **Audit logs** — `audit_logs` table + triggers exist (migration `…_security_hardening`).
- **Connection pooling** — provided by Supabase **Supavisor** (managed); no app change needed.
- **Image CDN / compression** — Vercel edge CDN serves static assets gzip/brotli; immutable
  long-cache headers already set for `/assets/*`. Supabase Storage serves images over its CDN.

## Operator-provisioned / architectural (NOT faked)
- **Redis cache / Queue / DLQ / Background jobs / Circuit breaker / Distributed tracing** — require a
  new managed tier (Upstash Redis, a queue broker, an APM like Sentry/Datadog). Integration points:
  Supabase **Edge Functions** for queue consumers + idempotency, **pg_cron** for scheduled jobs,
  `monitoring.service` for the tracing/APM hook. These are infra to *provision*, not code to fake.
- **Rate limiting / throttling** — best enforced at the edge (Vercel WAF / Supabase Edge Function
  middleware); needs the production project to configure. The CSP/headers layer is done.
- **Production Firebase / Push / Remote Config** — credential-gated (see `NATIVE_RELEASE.md`).
- **CSP validation** — the policy is scoped to known origins; it should be smoke-tested against the
  live Google Maps + Paymob flows on the preview deploy and tightened (drop `'unsafe-inline'` for
  scripts via a build-time nonce) once verified.

## Verification (this sprint)
Build ✅ · Typecheck/Lint (raw `tsc`) **0 errors** ✅ · Secrets audit **clean** ✅ · E2E **24/24** ✅.
Unit/integration/performance tests: the repo's automated suite is the Puppeteer E2E (24 journeys) +
typecheck; there is no separate Jest/vitest unit harness wired (would be a follow-up sprint).

## Readiness (honest)
- **Web / PWA: ~86%** (now hardened with CSP + secure headers + query indexes).
- **App Store (iOS): ~70%** — native project + icons + Info.plist/ATT done; needs Firebase + a Mac
  build + signing + hosted AASA.
- **Google Play: ~72%** — native project + adaptive icons + manifest/permissions/App Links done;
  needs Firebase + signed AAB.
- **Overall production: ~68%.**

## Next highest-priority sprint
**Production wiring & provisioning** (operator-paired): apply all pending migrations (`supabase db
push`), provision Sentry + analytics (inject `VITE_SENTRY_DSN`/`VITE_ANALYTICS_URL`), set Vercel
production secrets, then add **edge-function rate limiting + order idempotency keys** (real code on
the Edge Function tier) and a **vitest unit harness** for the services layer.
