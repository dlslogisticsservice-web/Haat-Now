# Production Cutover Checklist
**HaaT Now — Phase 5 of the Enterprise Production Stabilization Program**
Date: 2026-07-05. **This phase PREPARES production only.** No live service was contacted, no live DB modified, no live payments/SMS enabled, nothing deployed. Every step that touches a live environment is marked **🔒 GATED → Production Activation sprint** and must not be run until that explicit, separately-approved sprint.

Legend: ✅ ready (done in Phases 1–4) · 📋 prepare now (staging-safe, no live access) · 🔒 GATED (live action — Production Activation sprint only).

---

## 0. Golden rules
- **Staging first, always.** Every 🔒 action runs on a **staging** Supabase/Vercel project and passes its verification before any production equivalent.
- **Nothing in this checklist is executed in Phase 5.** Phase 5 delivers the runbook + staging-safe config; execution is the Production Activation sprint.
- Take a production snapshot/backup immediately before any 🔒 write.

---

## 1. Supabase (database + auth)
| # | Step | Status |
|---|---|---|
| 1.1 | Corrected migration chain applies cleanly from zero (Phase-1 fix of `000005`) | ✅ authored — `supabase db reset` on **staging** must pass | 🔒 verify on staging |
| 1.2 | Apply the pending `000626/000627` batch (brings `tenants`, `payment_idempotency`, indexes, tenant-isolation foundation `000010`) | 🔒 staging → prod (`supabase db push`) |
| 1.3 | Run the Phase-1 smoke suite (`DATABASE_MIGRATION_PLAN.md §P1.6`) | 🔒 staging |
| 1.4 | Enable RLS on `driver_performance` + `shift_breaks` (`§P1.3`) after write-path smoke | 🔒 staging → prod |
| 1.5 | Live `pg_policies` / `pg_indexes` audit; reconcile drift (`vehicles_read`), commit canonical `schema.sql` (`§P1.5`) | 📋 prepare queries / 🔒 run |
| 1.6 | **Auth (SMS/OTP):** enable the Supabase phone provider (Twilio/etc.) | 🔒 GATED — **do not activate live SMS** until this sprint |
| 1.7 | Build with `HAAT_LIVE_BACKEND=1` so `VITE_AUTH_MODE=supabase` | 🔒 GATED (Launch Blocker C1/C2) |
| 1.8 | Multi-tenancy Stage B/C (backfill `tenant_id`, per-tenant RLS) | 🔒 GATED — `MULTI_TENANCY_REPORT.md`; **no 2nd tenant until Stage C validated** |

## 2. Storage
| # | Step | Status |
|---|---|---|
| 2.1 | 5 buckets + owner-scoped RLS (`{uid}/…`) authored | ✅ (`storage_foundation` migration) |
| 2.2 | Create buckets on staging; verify owner-scoped upload/read; confirm public/private per bucket | 🔒 staging |
| 2.3 | CORS/allowed-origins on storage; max file sizes | 📋 prepare config / 🔒 apply |

## 3. Payments
| # | Step | Status |
|---|---|---|
| 3.1 | Moyasar integration real; edge functions verify caller JWT | ✅ |
| 3.2 | **Webhook fails closed** on missing secret (Phase-4 S2 fix) | ✅ |
| 3.3 | Set edge secrets: `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL`, `PAYMENT_WEBHOOK_SECRET` (`supabase secrets set …`) | 🔒 GATED — **do not enable live payments** until this sprint |
| 3.4 | **Never** set `WEBHOOK_ALLOW_UNSIGNED` in staging-prod/prod | ✅ policy |
| 3.5 | Keep `PAYMENT_MODE=sandbox` until go-live; flip to `production` in the activation sprint | 🔒 GATED |
| 3.6 | Staging webhook test: signed event → order paid; unsigned/forged → 401/503 | 🔒 staging |
| 3.7 | Other providers (Stripe/Paymob/Mada/Apple/Google Pay) are catalog placeholders in `.env.example` — activate only if in launch scope | 📋 decide scope |

## 4. Notifications
| # | Step | Status |
|---|---|---|
| 4.1 | In-app notifications + `broadcast_notification` RPC | ✅ (real; sandbox short-circuits) |
| 4.2 | Push delivery (FCM/APNs) — **not implemented**; `push_tokens` table + upsert exist | 📋 build if in scope |
| 4.3 | Email provider — **not wired** (`GrowthCenter` notes "requires a provider") | 📋 build if in scope / 🔒 activate |
| 4.4 | Per-tenant branded notifications depend on Multi-tenancy Stage B | 🔒 GATED |

## 5. Analytics
| # | Step | Status |
|---|---|---|
| 5.1 | DB-aggregate analytics (`analytics.service`) | ✅ (RLS-scoped) |
| 5.2 | Product telemetry → `VITE_ANALYTICS_URL` (env-gated, off by default) | 📋 set env if used |
| 5.3 | Website measurement id (SEO) wiring | 📋 per-tenant config |

## 6. Logging
| # | Step | Status |
|---|---|---|
| 6.1 | Edge functions structured logging (`_shared/log.ts`) | ✅ |
| 6.2 | `audit_logs` (RLS-enabled live, admin-read) | ✅ |
| 6.3 | Client error logging currently console-only unless Sentry set (see Monitoring) | 📋 |

## 7. Monitoring
| # | Step | Status |
|---|---|---|
| 7.1 | Provider-agnostic seam (`monitoring.service`), sends to `VITE_SENTRY_DSN` when set | ✅ seam |
| 7.2 | Provision a monitoring project; set `VITE_SENTRY_DSN`; verify a test error arrives | 🔒 staging → prod |
| 7.3 | Uptime/health checks against `/health.json` (emitted by build) | 📋 prepare monitors |

## 8. CI/CD
| # | Step | Status |
|---|---|---|
| 8.1 | CI: typecheck+**arch guard** (Phase-2 S8), build, Deno edge-fn type-check, Puppeteer E2E, Vercel preview | ✅ (`.github/workflows/ci.yml`) |
| 8.2 | Add a CI job: `supabase db reset` from zero (catches migration-chain breaks like the old `000005`) — `§P1.5` | 📋 prepare workflow |
| 8.3 | Production deploy is `main`-gated on `VERCEL_*` secrets; keep prod on `main` only | ✅ (feature branch untouched) |
| 8.4 | Security headers (CSP/HSTS/COOP) in `vercel.json` | ✅ |
| 8.5 | Staging Vercel + Supabase projects provisioned as the rehearsal target | 🔒 GATED (create in activation sprint) |

## 9. Backups & recovery
| # | Step | Status |
|---|---|---|
| 9.1 | Enable Supabase PITR / scheduled backups on staging + prod | 🔒 GATED |
| 9.2 | Document restore runbook + RPO/RTO targets | 📋 prepare |
| 9.3 | Pre-cutover production snapshot immediately before any 🔒 write | 🔒 GATED |
| 9.4 | Rollback migrations prepared for the RLS-enforcement steps (tenancy Stage C, ops-table RLS) | 📋 prepare |

---

## 10. Environment variables (prepare templates now; set real values in the activation sprint)
**Client (`VITE_`-prefixed — public by nature):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (publishable), `VITE_GOOGLE_MAPS_API_KEY`, optional `VITE_ANALYTICS_URL`, `VITE_SENTRY_DSN`, payment **public** keys.
**Server / edge secrets (🔒 set via `supabase secrets set`, never committed):** `SUPABASE_SERVICE_ROLE_KEY`, `MOYASAR_SECRET_KEY`, `MOYASAR_CALLBACK_URL`, `PAYMENT_WEBHOOK_SECRET`. (`WEBHOOK_ALLOW_UNSIGNED` — local dev only, never prod.)
**Build:** `HAAT_LIVE_BACKEND=1` (flips to `supabase` mode) — 🔒 set only for the live build.

`.env.example` is the canonical template (placeholders only). `.env*` is gitignored except `.env.example`. **No real secret is committed or belongs in the repo.**

---

## 11. Cutover sequence (Production Activation sprint — NOT run in Phase 5)
1. 🔒 Provision **staging** Supabase + Vercel.
2. 🔒 `supabase db reset` on staging → must pass; run Phase-1 smoke (§1.3) + payment webhook test (§3.6).
3. 🔒 Multi-tenancy Stage B (backfill + app theming) on staging → Stage C (RLS) with ≥2-tenant isolation proof.
4. 🔒 Set all edge secrets on staging; end-to-end payment + OTP + storage smoke.
5. 🔒 Production: snapshot → `db push` → set prod secrets → build `HAAT_LIVE_BACKEND=1` → deploy from `main` → enable SMS/monitoring/backups → smoke → monitor.
6. 🔒 Only after zero-cross-tenant proof: onboard the first real tenant (Launch Blocker C3 cleared).

## 12. Phase 5 output
| Item | Type |
|---|---|
| `PRODUCTION_CUTOVER_CHECKLIST.md` | this runbook (prepare-only) |

No live service contacted; no DB modified; no payments/SMS enabled; nothing deployed. All live actions remain 🔒 GATED to the Production Activation sprint.
