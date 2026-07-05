# Production Readiness Matrix
**HaaT Now — Phase 7 (companion to FEATURE_COMPLETENESS_MATRIX.md)**
Date: 2026-07-05. Readiness measured from implementation, split into **Demo/Sandbox** (what ships and works client-side) vs **Live Enterprise** (multi-tenant production).

## Readiness dimensions (portfolio)
| Dimension | Demo/Sandbox | Live Enterprise | Basis |
|---|--:|--:|---|
| Feature completeness | 90 | 78 | ~50 modules implemented; a few delivery integrations absent |
| Backend / API | 88 | 70 | services + edge fns + RPCs present; live-gated + 23 svc still direct-Supabase |
| Database | 90 | 68 | 50 migrations, strong RLS (91/94); **no per-tenant isolation**; 2 ops tables RLS-off |
| Frontend / UI | 92 | 88 | rich, wired, responsive; god-objects are debt not blockers |
| UX | 88 | 82 | end-to-end flows complete in demo |
| Security | 88 | 72 | strong code hygiene; webhook fail-closed; client-RBAC + multi-tenant RLS gaps |
| Multi-tenancy | 20 | 20 | foundation only (Stage A); enforcement gated |
| Localization | 90 | 90 | bilingual ar/en + RTL |
| White-label | 70 | 55 | website full; in-product global brand |
| Mobile | 85 | 82 | responsive + Capacitor shells |
| Performance | 78 | 72 | role-app code-split ✓; 914 KB admin chunk, eager public site |
| Observability | 60 | 55 | audit logs + edge logging; monitoring seam (env-gated) |
| CI/CD | 90 | 88 | typecheck+arch-guard+build+Deno-check+E2E; Vercel gated |
| **Overall** | **~85** | **~63** | feature-complete demo; live gated on multi-tenancy + cutover |

## Infrastructure readiness (from Cutover checklist)
| Area | Ready in repo | Live action gated |
|---|:--:|:--:|
| Supabase schema/RLS | ✅ authored | 🔒 apply on staging→prod |
| Auth (OTP) | ✅ dual-mode | 🔒 enable SMS provider |
| Payments (Moyasar + webhook fail-closed) | ✅ | 🔒 set secrets, `PAYMENT_MODE=production` |
| Storage (owner-scoped RLS) | ✅ | 🔒 create buckets on staging |
| Notifications (in-app) | ✅ | 🔒 push/email providers |
| Analytics/Logging/Monitoring | ⚠️ seams | 🔒 wire providers |
| CI/CD + security headers | ✅ | — |
| Backups / DR | ❌ (external) | 🔒 enable PITR + runbook |

## Enterprise-readiness gates (must all be green to onboard real tenants)
1. ❌ Per-tenant RLS enforced + zero-cross-tenant proof on staging (Multi-tenancy Stage C).
2. ❌ Live backend validated end-to-end on staging (auth/RLS/payments/storage).
3. ❌ Website/design server persistence.
4. ⚠️ In-product per-tenant branding (H4).
5. ✅ Security code hygiene (secrets, webhooks, XSS, dev-hook gating, CSP/HSTS).
6. ✅ CI quality gates (typecheck, arch boundary guard, E2E, Deno check).

## Bottom line
- **Overall demo readiness ≈ 85%** — a polished, secure, feature-rich client-side platform, shippable as a demo today.
- **Overall live-enterprise readiness ≈ 63%** — gated primarily by **multi-tenancy enforcement** and **live-backend cutover**, both staging-first and non-rewrite.
- **No architectural dead-ends.** Phases 1–6 removed the migration-chain break, closed the webhook fraud vector, enforced the data-access boundary, laid the tenant-isolation foundation, and cleaned the debt surface. The remaining path to launch is a bounded, gated backend + multi-tenancy program.
