# Go-Live Plan — HAAT NOW

**Date:** 2026-06-24 · Sequenced execution plan from the consolidated pre-launch evidence.
**No new tests run.** Detail: `MASTER_PRE_LAUNCH_CHECKLIST.md`, `CRITICAL_BUGS_REPORT.md`,
`MISSING_FEATURES_REPORT.md`. Recommended shape: **COD-only, Saudi-only soft launch.**

---

## Phase 0 — Verify reality (½ day) · BLOCKS EVERYTHING
The reports conflict on migration/proc state; resolve before touching config.
1. Query live `schema_migrations` — confirm **0019 (grants)**, **0020 (feature persistence)**, **0023–0027**
   are applied (P0-1).
2. Confirm `order_country_code` is **SECURITY DEFINER** (P0-2).
3. Apply anything missing.
> **Exit:** logged-in test user can read/write orders/wallets without `42501`; admin order list loads
> without recursion.

## Phase 1 — Production config (½–1 day)
4. Rotate the Supabase management token (P0-6).
5. Vercel prod env: `VITE_AUTH_MODE=supabase` + URL + anon key (P0-4).
6. Supabase `site_url` + redirect allow-list → prod domain (P0-5).
7. Real Twilio; clear Test OTP `123456` (P0-3).
8. Enable PITR backups (P0-9); wire monitoring (P0-10).
> **Exit:** real OTP delivers to a real phone; prod build points at supabase mode; backups + alerts live.

## Phase 2 — De-risk the UI (1–2 days)
9. Remove customer-facing mock data: wallet (P1-1), home (P1-2) → real empty states.
10. Point portal analytics at `analyticsService` (P1-3); fix payout math (P1-5).
11. Hide unfinished merchant payout button (P1-4); persist notification read-state (P1-6).
12. Remove misleading login hint (P1-11); fix payment-guide provider mismatch (P1-12).
> **Exit:** no fabricated data shown to customers, merchants, or admins.

## Phase 3 — Scope lock + validation (1 day)
13. **Lock scope: COD + Saudi only** (P0-7). Disable/flag card-pay and EG entry points.
14. Confirm sandbox tree-shaken, no demo accounts reachable (P0-11).
15. **Run real-mode E2E on the deployed build**, 4 roles, real OTP (P0-8).
16. CDN-cache catalog (P1-7); verify realtime concurrency headroom (P1-8).
> **Exit:** a real phone completes browse → cart → COD order → driver accept → deliver, in Saudi, on the
> deployed URL.

## Phase 4 — Controlled launch
17. Soft-launch to a limited Saudi cohort (≤ ~10k orders/day — within measured 577-RPS / DB-idle headroom).
18. Monitor: API P95/P99, realtime connections, error rate, order funnel. Hold at each step.

## Phase 5 — Post-launch (P2)
Card gateway → EG market (seed geo + catalog) → push delivery → realtime redesign + queue + Redis as volume
approaches 50k/day (see `SCALING_ROADMAP.md`).

---

# If HAAT NOW launches TODAY — top 20 reasons it could fail
*(evidence-cited; ordered by severity × likelihood)*

| # | Failure | Evidence |
|---|---|---|
| 1 | **Every logged-in user hits `42501`** if authenticated GRANTs (0019) aren't applied — app dead after login | PRODUCTION_BLOCKERS C4 |
| 2 | **Admin order dashboards crash** (infinite RLS recursion) if `order_country_code` is SECURITY INVOKER | PRODUCTION_BLOCKERS C5 |
| 3 | **No real user can log in** — OTP is Test code `123456`, real Twilio not active | PHONE_AUTH_REPORT; SUPABASE_PRODUCTION_CONFIG §4 |
| 4 | **Anyone can hijack the demo accounts** — known OTP `123456` valid until 2030 | PHONE_AUTH_REPORT |
| 5 | **Default-country (EG) users can't transact** — only Saudi geography/catalog seeded | APPLICATION_READINESS; FINAL_IMPLEMENTATION |
| 6 | **Prod build may run in the wrong mode** — Vercel `VITE_AUTH_MODE`/keys unverified | VERCEL_ENV_SETUP §A |
| 7 | **Card payments silently fake** — `payment.service` returns `captured` without a gateway; Moyasar unkeyed | `payment.service.ts:179`; `payment-initiate:39` |
| 8 | **Customers see 5 fabricated wallet transactions** on empty wallets | `WalletScreen.tsx:27-33` |
| 9 | **Users tap fake restaurants** (mock cards) when the catalog is empty | `HomeScreen.tsx:49-57` |
| 10 | **Admin/merchant/driver KPIs are fake** localStorage numbers | PRODUCTION_BLOCKERS H2 |
| 11 | **Merchants get wrong payouts** — hardcoded `total - 10` delivery fee | PRODUCTION_BLOCKERS M3 |
| 12 | **Merchant payout button does nothing** — `alert()` stub | `MerchantApp.tsx:1015` |
| 13 | **Real prod path never E2E-tested** — only local sandbox validated | POST_DEPLOY_VERIFICATION |
| 14 | **Total login outage if SMS fails** — phone OTP is the only auth path (no email/OAuth fallback) | AUTH_AUDIT §4 |
| 15 | **Realtime drops connections at ~376 concurrent** — below a real driver fleet / live-tracking load | ULTIMATE_SCALE / DRIVER_STRESS |
| 16 | **API times out past ~2.5–4.6k concurrent users** (577 RPS, no CDN) | ENTERPRISE_LOAD_TEST / CAPACITY_LIMIT |
| 17 | **Driver location stream exceeds capacity** — 5k drivers = 1,000 req/s > 577 RPS via REST | ULTIMATE_SCALE |
| 18 | **Users miss order updates** — notification read-state not persisted; no device push | PRODUCTION_BLOCKERS H3; APPLICATION_READINESS |
| 19 | **Project-takeover risk** — Supabase management token un-rotated, in plaintext locally + shared in docs | SUPABASE_PRODUCTION_CONFIG §5; MCP_RECOVERY |
| 20 | **Blind to incidents + data loss** — no monitoring/Sentry, PITR backups unconfirmed; broken redirects (`site_url=localhost`) | SUPABASE_PRODUCTION_CONFIG; LAUNCH_CHECKLIST |

**Net:** reasons 1–6 are hard launch-blockers (P0); 7–14 break trust/data integrity on day one (P0/P1);
15–20 break under real load or leave you exposed. **None require new feature code** — they are migration
verification, config, scope-lock, and mock-data removal. Clearing Phase 0–3 (~3–5 days) converts this from
"will fail" to a controlled COD/Saudi soft launch.
