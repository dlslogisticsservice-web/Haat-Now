# Critical Bugs & Blockers Report — HAAT NOW (Pre-Launch)

**Date:** 2026-06-24 · Synthesis of existing reports + read-only codebase scan. **No new tests run.**

> **Reconciliation note (important).** The E2E/security reports (`CRITICAL_BUGS.md`, `*_SECURITY.md`)
> declare **0 Critical / 0 High outstanding** — but that scope covered only *runtime bugs* and *RLS
> vulnerabilities*. The **source-code cutover audit** (`docs/audits/PRODUCTION_BLOCKERS_REPORT.md`) and
> `CRITICAL_BLOCKERS_REPORT.md` still list **feature-wiring + migration + infra** blockers that the bug/
> security sweep did not cover, and `PRODUCTION_BLOCKERS_STATUS.md` confirms only blockers 1–3 (sandbox
> auth) were fixed. **Both are true.** This report consolidates the still-open launch blockers.

In-code defect markers are clean: **0 TODO / FIXME / HACK / "not implemented"** in `src/`. The risk is
**configuration, migrations, and mock/sandbox wiring — not code defects.**

---

## P0 — Must fix before launch

| ID | Blocker | Evidence | Risk | User impact |
|---|---|---|---|---|
| **B1** | **Authenticated GRANTs (migration 0019) unverified** — without them every logged-in user gets `42501` on orders/wallets/notifications | PRODUCTION_BLOCKERS_REPORT C4; CRITICAL_BLOCKERS BLOCKER-3 | **Critical** | App unusable immediately after login |
| **B2** | **`order_country_code` may be SECURITY INVOKER → infinite RLS recursion** on admin order reads | PRODUCTION_BLOCKERS_REPORT C5 (`…0018:40`) | **Critical** | Admin order dashboards crash. *Conflict: my `SECURITY_LOAD_REPORT` assumed DEFINER — must verify live.* |
| **B3** | **OTP is Supabase Test code `123456`, not real SMS** — demo numbers log in with a known code; real users get no code | PHONE_AUTH_REPORT; SUPABASE_PRODUCTION_CONFIG §4; `auth.service.ts:14` | **Critical** | Account takeover of demo numbers; no real-user login |
| **B4** | **Prod env not confirmed on Vercel** (`VITE_AUTH_MODE=supabase`, URL, anon key) — `.env*` is gitignored, Vercel scope unverified | VERCEL_ENV_SETUP §A | **High** | App may boot in wrong mode / fail to reach backend |
| **B5** | **Migration drift** — ledger records 0000–0022; disk has 0023–0027 (incl. security_hardening, scale_indexes) with no ledger confirmation | MIGRATION_LEDGER_REPORT vs on-disk | **High** | Schema/state mismatch; B1/B2 live status unknown |
| **B6** | **Real-mode E2E never run on the deployed build** — only local sandbox `localhost:3001` exercised | POST_DEPLOY_VERIFICATION_REPORT | **High** | Unknown breakage on the actual production path |

## P1 — Should fix before launch (data-integrity / trust)

| ID | Issue | Evidence | Risk | User impact |
|---|---|---|---|---|
| **B7** | **Wallet shows 5 fabricated transactions** when real history is empty | `WalletScreen.tsx:27-33,319` | High | Customers see fake deposits/refunds — financial misinformation |
| **B8** | **Home shows mock restaurants** when catalog empty (ids `m1`–`m4`) | `HomeScreen.tsx:49-57,384` | Med | Users tap non-orderable fake cards (esp. EG, see MISSING_FEATURES #5) |
| **B9** | **Portal analytics are fake localStorage data**, not `analyticsService` | PRODUCTION_BLOCKERS H2 (`AdminDashboard:282`, `MerchantApp:940`, `DriverApp:109`) | High | Admin/merchant/driver KPIs, revenue, earnings are fabricated |
| **B10** | **Merchant "Withdraw Earnings" is a fake `alert()`** — no payout call | `MerchantApp.tsx:1015` | Med | Merchants believe a payout was requested; nothing happens |
| **B11** | **Hardcoded delivery-fee (`total - 10`) in merchant revenue math** | PRODUCTION_BLOCKERS M3 (`MerchantApp:219,404,623,657`) | Med | Incorrect payout/earnings amounts |
| **B12** | **Notification read-state not persisted + unread badge resets**; markRead/getUnreadCount unused | PRODUCTION_BLOCKERS H3 (`App.tsx:134`) | Med | Users miss/re-see order notifications |
| **B13** | **Coupons / Loyalty / Inventory still read localStorage** (no real-mode branch in UI) even if tables exist | PRODUCTION_BLOCKERS C1–C3 | Med | These features don't reflect/persist real data |
| **B14** | **Misleading "enter any 6-digit code" hint** under real OTP | AUTH_AUDIT §4; `LoginScreen.tsx` | Low | Confusing/incorrect login UX |

## P2 — After launch (deferred, documented)

| ID | Issue | Evidence | Risk |
|---|---|---|---|
| B15 | `order_status_history` INSERT open to any authed user (audit-log pollution only) | MEDIUM_SECURITY ME-1 | Low/Med |
| B16 | `campaign_events` INSERT open (analytics inflation) | MEDIUM_SECURITY ME-2 | Low |
| B17 | Orphaned stubbed `payment.service.ts` (fake `success:true`, `verified=true`) — dead code, not wired to live Moyasar checkout | `payment.service.ts:179-422,501` | Low (dead) but misleading |
| B18 | Bundle-size advisory (entry ≈312 KB, already mitigated) | MEDIUM_PRIORITY_BUGS M3 | Info |

## Already FIXED (do not re-open)
CR-1 `app_config` priv-esc · HI-1 `payment_transactions` IDOR · HI-2 `support_messages` impersonation ·
HI-3 no error boundary · Sandbox-auth blockers 1–3 (`VITE_AUTH_MODE`, demo OTP, tree-shaking) ·
Cart-sync-per-role bug · 29→13 unindexed FKs (scale indexes). See `*_SECURITY.md`, `PRODUCTION_BLOCKERS_STATUS.md`.

## The one verification that unblocks the most
**Query the live `schema_migrations` + check `order_country_code` proc definition** (resolves B1, B2, B5,
B13 in one pass). It was out of scope here ("no new tests"); it is the first P0 action in `GO_LIVE_PLAN.md`.
