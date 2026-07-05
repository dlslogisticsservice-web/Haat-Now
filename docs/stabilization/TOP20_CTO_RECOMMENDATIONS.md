# Top 20 CTO Recommendations — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Ranked by production-blocking priority. Effort: S (<1wk) · M (1–3wk) · L (>3wk). ROI is relative.
> **This is a documentation-only audit — no code was changed. These are proposals for review.**

| # | Recommendation | Priority | Problem | Business risk | Technical risk | ROI | Effort | Tier |
|---|---|---|---|---|---|---|---|---|
| 1 | **Make live-mode the tested/shipped build; treat sandbox as a separate labelled demo** | P0 | Prod ships as localStorage demo; CI/E2E test sandbox (`vite.config.ts:6-16`, `ci.yml`) | Buyers sign off on flows with no backend | Live path silently broken | Very High | M | Must |
| 2 | **Fix provisioning↔`tenants` schema mismatch** | P0 | Provisioner writes ~19 non-existent columns (`provisioning.service.ts:43-57`) | White-label onboarding fails in prod | Hard failure in live DB | Very High | S | Must |
| 3 | **Atomic `create_order` RPC with idempotency key + server-computed totals** | P0 | 3 un-transacted writes, client-authored totals, no dedup (`order.service.ts:25-77`) | Orphan/duplicate orders; revenue integrity | Data corruption | Very High | M | Must |
| 4 | **Make refunds atomic + post to ledger** | P0 | TOCTOU over-refund, refund-before-gateway, no ledger (`payment-refund:131-213`) | Direct money loss | Financial inconsistency | Very High | M | Must |
| 5 | **Add scheduler (pg_cron / cron edge) for dispatch, settlements, reconciliation, segments** | P0 | Everything time-based is a manual button | Orders hang; no auto-dispatch | Ops cannot run 24/7 | Very High | M | Must |
| 6 | **Auto-trigger dispatch on order creation + unify the two assignment systems + call `finalize_driver_delivery`** | P0 | Dispatch manual-only; grab-path diverges; workload never freed | Undelivered orders; broken driver scoring | Integrity race | High | M | Must |
| 7 | **Enforce granular RBAC + country/tenant scope server-side** | P0 | 35-perm matrix is client-only; country admins act globally on money (`finance_engine.sql:352`) | Privilege abuse; compliance failure | Authz bypass | High | L | Must |
| 8 | **Verify & drop permissive `using(true)` PII policies against live DB** | P0 | `"Anyone can select drivers/merchants"` never dropped (`0004:167-177`) | PII exposure (phones) to all users | Live data leak | Very High | S | Must |
| 9 | **Server-side double-charge dedup (derive attempt key from `order_id`)** | P1 | Dedup is client-only; random attempt key (`payment-initiate:168`) | Double charges via direct edge call | Payment integrity | High | S | Must |
| 10 | **Add transactional outbox + event backbone; wire loyalty, inventory, conversion, CX, notifications** | P1 | No DB triggers; most integrations dead (CROSS_MODULE) | Broken loyalty/inventory/attribution | Systemic | Very High | L | Must |
| 11 | **Decrement inventory atomically on order; block oversell** | P1 | Stock never moves on order (`order.service.ts:10-78`) | Overselling, refunds, bad UX | Oversell | High | M | Must |
| 12 | **Enforce KYC/suspension as a transaction gate** | P1 | `account_status` never checked in order/driver flow | Banned actors keep operating | Compliance | High | S | Must |
| 13 | **Real notification delivery worker (push/SMS/email); consume `push_tokens`** | P1 | In-app only; tokens unused | Customers miss critical updates | Delivery gap | High | M | Should |
| 14 | **Order state machine at DB (enum/CHECK + transition guard)** | P1 | `status` is free-text varchar (`init_schema.sql:23`) | Illegal states persist | Integrity | Medium | S | Should |
| 15 | **Reconcile the two driver-location stores; throttle GPS** | P1 | `driver_locations` ≠ `drivers.current_lat/lng`; per-tick writes | Stale tracking; realtime storm | Correctness+scale | Medium | M | Should |
| 16 | **Wire loyalty accrual (or disable redemption) to close the earn/redeem gap** | P1 | Redeemable but unearnable points (`WalletScreen.tsx:84`) | Free-money leak if seeded | Financial | High | S | Should |
| 17 | **Real subscription billing + tenant-scoped quota enforcement** | P2 | Billing is a stub; usage counts global rows (`subscription.service.ts:54-87`) | No SaaS revenue capture | Business model | Medium | L | Should |
| 18 | **DB-back the website builder + real domain/DNS/SSL automation** | P2 | Website is localStorage-only; SSL is a manual dropdown | Can't host tenant sites | Feature gap | Medium | L | Should |
| 19 | **Add email/password (or magic-link) auth; remove or implement dead social buttons** | P2 | Only phone OTP; Apple/Google buttons dead (`LoginScreen.tsx:298-313`) | Login friction; misleading UI | UX/trust | Medium | M | Should |
| 20 | **Reconcile migrations to live `pg_policies`; add rollup views, caching, chargeback/fraud handling** | P2 | Applied-vs-declared drift (`rls_recovery.sql:5-8`); no fraud/chargeback | Hidden security/scale/finance gaps | Ops reliability | Medium | L | Nice |

## Sequencing

- **Gate 1 (before any real customer/money):** #1–#9 (P0). These are the integrity, security, and "is the backend even the shipped thing" blockers.
- **Gate 2 (before scale / multi-tenant):** #10–#16 (P1). Event backbone, inventory, KYC gating, notifications, state machine, loyalty.
- **Gate 3 (before white-label GA):** #17–#20 (P2). Billing, DB-backed sites, auth breadth, ops hardening.

**Rough effort to production-viable single-tenant:** Gate 1 ≈ 4–6 focused engineer-weeks. To true multi-tenant white-label: add Gate 2+3 ≈ a quarter.
