# Launch Blockers
**HaaT Now — Phase 7 (consolidated, post-Phases 1–6)**
Date: 2026-07-05. The definitive, up-to-date blocker list for a **live multi-tenant SaaS launch** — reflecting what Phases 1–6 already fixed vs. what remains. Categorized Critical / High / Medium / Low.

> As a **demo/sandbox**, the platform is green today (build ✓, E2E 24/24, CI guard). Blockers below gate **live production with real tenants**.

## ✅ Resolved during Phases 1–6 (no longer blockers)
| Was | Fix | Phase |
|---|---|---|
| Migration chain hard-failed at `000005` (blocked `tenants`/`payment_idempotency`) | Duplicate/broken migration resolved | 1 |
| Payment webhook accepted **unsigned** events when secret unset | **Fail-closed** (503) | 4 |
| Features calling Supabase directly (11 files) | 0 files; **CI-enforced** boundary guard | 2 |
| Duplicated persistence (7 services) | Single `kv` primitive | 2 |
| Dead deps/files, generic name, doc-root dup, unused code | Removed; `noUnusedLocals` guard | 6 |
| Tenant isolation had **no foundation** | `tenant_members` + `auth_tenant()` + nullable `tenant_id` | 3 (Stage A) |

## 🔴 CRITICAL — must be solved before any real tenant
| # | Blocker | Evidence | Status |
|---|---|---|---|
| C1 | **No per-tenant RLS enforcement** — foundation exists (Stage A) but `tenant_id` is unbackfilled and no policy enforces it; onboarding a 2nd tenant risks cross-tenant exposure | `MULTI_TENANCY_REPORT.md` Stage B/C | Gated (staging) |
| C2 | **Live backend never exercised in the shipped artifact** — sandbox-forced build; flip `HAAT_LIVE_BACKEND=1` + validate auth/RLS/payments/storage | `vite.config.ts:12`; cutover checklist | Gated |
| C3 | **Hardcoded OTP path** must be provably unreachable in prod; live SMS provider required | `auth.service.ts` (IS_SANDBOX-gated, tree-shaken in prod build) | Config (gated) |
| C4 | **Website/design content persists only to localStorage** — not durable/shared across devices/users | `website.service.ts` | Needs server persistence |
| C5 | **Corrected migration batch not yet applied** to a live/staging DB (`tenants`, `payment_idempotency`, indexes, tenant foundation) | Phase-1 plan | Gated (staging first) |

## 🟠 HIGH — before general availability
| # | Blocker | Status |
|---|---|---|
| H1 | Set all edge secrets at cutover (`PAYMENT_WEBHOOK_SECRET` now enforced, `MOYASAR_*`); never `WEBHOOK_ALLOW_UNSIGNED` in prod | Config (gated) |
| H2 | In-product per-tenant branding (H4) — customer/merchant/driver/admin use one global brand | Multi-tenancy Stage B |
| H3 | Notification **delivery** (push FCM/APNs + transactional email) unwired | Integrations |
| H4 | RBAC fine-grained perms not mirrored in RLS (UI-only gating) | Security |
| H5 | Enable RLS on `driver_performance` + `shift_breaks` (currently off) | Phase-1 §P1.3 (staging) |
| H6 | Finance-table RLS coverage unverified; run live `pg_policies` audit | Phase-1 §P1.5 |

## 🟡 MEDIUM
| # | Item |
|---|---|
| M1 | `fleet_vehicles` table + admin-CRUD repoint (fleet instances are localStorage today) |
| M2 | Billing engine (charging/invoicing) if invoicing is in launch scope; no PDF |
| M3 | Platform Registry production Supabase path (localStorage default) |
| M4 | Integrations wiring (Twilio/WhatsApp/email providers) |
| M5 | Public website not code-split (perf); 914 KB admin chunk |
| M6 | Growth A/B duplication consolidation |

## 🟢 LOW (post-launch quality)
| # | Item |
|---|---|
| L1 | 23 low-traffic services still on direct Supabase (finish service→repo) |
| L2 | 6 god-object component splits |
| L3 | `as any` = 100 + full `tsconfig strict` |
| L4 | Two i18n systems consolidation |
| L5 | AI module (out of current scope) |

## Verdict
- **Ship as demo / sales sandbox:** ✅ ready now.
- **Launch as live multi-tenant SaaS:** ❌ blocked by **5 Critical + 6 High**, dominated by two themes: **make multi-tenancy real** (C1, C4, H2, H5, H6) and **flip-and-validate the live backend** (C2, C3, C5, H1, H3). None require a rewrite — a focused, gated backend + multi-tenancy program (staging-first) clears them.
