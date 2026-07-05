# Risk Register — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Likelihood × Impact → Severity. **P** = probability if launched live as-is. Evidence cited `file:line`.

Severity: 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low.

> **Phase 9 update (2026-07-05):** the 9 Critical risks below tied to P0 items have been
> **implemented** (see `PHASE9_IMPLEMENTATION_REPORT.md`) and are marked **Mitigated (pending
> staging verification)**. They downgrade to their residual severity only **after** the Phase 9
> migrations are applied to a live/staging project and re-verified.
>
> | Risk | Phase 9 status | Fix |
> |---|---|---|
> | R-01 demo-as-prod | ✅ Mitigated | live CI build + `build:live` (P0-1) |
> | R-02 provisioner schema | ✅ Mitigated | additive tenant columns (P0-2) |
> | R-03 refund over-refund | ✅ Mitigated | `refund_reserve` lock + ceiling (P0-4) |
> | R-04 duplicate/orphan orders | ✅ Mitigated | atomic `create_order` + idempotency (P0-3) |
> | R-05 no scheduler / no auto-dispatch | ✅ Mitigated | scheduler + auto-dispatch trigger (P0-5/6) |
> | R-06 PII leak | ✅ Mitigated | drop world-read + phone revoke (P0-8) — **verify pg_policies** |
> | R-07 admin over-authority | ⚠️ Partially mitigated | granular RBAC on cash-out RPCs (P0-7); country-scope on finance = follow-on |
> | R-08 cross-tenant leakage | ⛔ Not addressed (P2) | tenant_id RLS isolation is out of P0 scope |
> | R-09 double charge | ✅ Mitigated | order-scoped dedup index + deterministic key (P0-9) |
> | R-14 ledger not reconciled | ⚠️ Partially mitigated | refunds/compensations now post; **captures** still pending (P1 #10) |
> | R-15 driver workload leak | ✅ Mitigated | unified workload trigger (P0-6) |
> | R-24 null-client crash | ✅ Mitigated | fail-loud config guard (P0-1) |

| ID | Risk | Category | Likelihood | Impact | Severity | Evidence | Mitigation (TOP20 #) |
|---|---|---|---|---|---|---|---|
| R-01 | Production deploys the sandbox demo (no backend) | Release | High | Catastrophic | 🔴 | `vite.config.ts:6-16`; CI tests sandbox | #1 |
| R-02 | White-label provisioning throws in live DB (schema mismatch) | Functional | Certain (if used live) | High | 🔴 | `provisioning.service.ts:43-57` vs `tenants` cols | #2 |
| R-03 | Refund over-refund race / refund-before-gateway inconsistency | Financial | Medium | High | 🔴 | `payment-refund:131-213` | #4 |
| R-04 | Duplicate / orphan orders (no atomicity/idempotency) | Integrity | High | Medium-High | 🔴 | `order.service.ts:25-77` | #3 |
| R-05 | Orders never auto-dispatched; offers never expire (no scheduler) | Operational | Certain | High | 🔴 | `OperationsCenter.tsx:118-154`; no cron | #5,#6 |
| R-06 | Driver/merchant PII readable by any authed user (permissive RLS) | Security/Privacy | Med (verify) | High | 🔴 | `0004:167-177` never dropped | #8 |
| R-07 | Any admin performs any admin action; country admins act globally on money | Security | High | High | 🔴 | `finance_engine.sql:352`; client-only RBAC | #7 |
| R-08 | Cross-tenant data leakage if 2nd tenant onboarded | Security | Med | Catastrophic | 🔴 | no `tenant_id` RLS | #7, MULTI_TENANCY |
| R-09 | Server-side double charge via direct edge call | Financial | Low-Med | High | 🟠 | `payment-initiate:168`; client-only lock | #9 |
| R-10 | Loyalty redeemable but not earnable (free-money if seeded) | Financial | Low | Medium | 🟠 | `WalletScreen.tsx:84`; accrual dead | #16 |
| R-11 | Inventory oversell (stock not decremented on order) | Operational | High | Medium | 🟠 | `order.service.ts:10-78` | #11 |
| R-12 | Banned/suspended merchant or driver keeps transacting | Compliance | Med | High | 🟠 | `account_status` not a gate | #12 |
| R-13 | Customers miss order updates (in-app-only notifications) | UX/Ops | High | Medium | 🟠 | no push/SMS/email worker | #13 |
| R-14 | Ledger not reconciled to gateway cash | Financial | Certain | Medium | 🟠 | captures/refunds never `post_ledger` | #4,#10 |
| R-15 | Driver workload accounting corrupts dispatch scoring over time | Operational | High | Medium | 🟠 | `finalize_driver_delivery` dead | #6 |
| R-16 | Realtime GPS fan-out / live aggregation ceilings under load | Scalability | Med (at scale) | High | 🟠 | `command.service.ts:109-114`; no throttle | #15,#20 |
| R-17 | Applied RLS diverges from migration files | Security/Ops | Med | High | 🟠 | `rls_recovery.sql:5-8` | #8,#20 |
| R-18 | No subscription billing → no SaaS revenue capture | Business | Certain | Medium | 🟡 | `subscription.service.ts:54-68` | #17 |
| R-19 | Stale tracking (two location stores) | Correctness | High | Low-Med | 🟡 | `tracking.repository.ts:18-24` | #15 |
| R-20 | Order status accepts illegal transitions (free-text varchar) | Integrity | Low | Medium | 🟡 | `init_schema.sql:23` | #14 |
| R-21 | No fraud / chargeback / velocity controls | Financial | Med | High | 🟠 | none found | #20 |
| R-22 | Website content localStorage-only (not hostable in prod) | Functional | Certain (if used) | Medium | 🟡 | `website.service.ts:17`; no tables | #18 |
| R-23 | OTP/endpoint abuse (no app rate limiting) | Security/Cost | Med | Medium | 🟡 | Supabase defaults only | #20 |
| R-24 | Misconfigured live deploy → `null` supabase client crash | Reliability | Med | Medium | 🟡 | `lib/supabase.ts:38-42` | #1 |
| R-25 | GDPR erasure vs finance/audit retention unresolved | Compliance | Low | Medium | 🟡 | `20260627000001` scope unverified | #20 |

## Risk concentration

- **9 Critical (🔴)** risks — 6 must clear before *any* live money/customer, 3 before multi-tenant.
- The Critical cluster is **not random**: R-01/R-02 (demo-as-prod, broken provisioner), R-03/R-04/R-09 (money integrity), R-05/R-06/R-07/R-08 (ops automation + security/tenancy). They map 1:1 to TOP20 #1–#9.

## Residual-risk statement

If all P0 mitigations (TOP20 #1–#9) are implemented and verified against a live staging DB, residual risk drops to a **Medium** profile acceptable for a **controlled single-tenant, single-country pilot**. Multi-tenant / multi-country GA additionally requires #10–#20. **No launch is advisable while any 🔴 remains open.**
