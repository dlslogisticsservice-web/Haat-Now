# Production Decision — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> The final go/no-go, as I would sign it as an incoming CTO. Evidence across the 15 companion reports in this folder.

---

## Decision: ⛔ **NO-GO for enterprise production** (as-is). ✅ **GO for demo / investor / pilot-prep.**

This is a **conditional NO-GO**, not a rejection. The platform is a **9/10 demo on a ~4.6/10 enterprise-production foundation**. The blocking issues are specific, evidenced, and remediable in weeks — not a rewrite.

---

## Why NO-GO (the four disqualifiers)

1. **The shipped build is the demo, not the backend.** Production forces `VITE_AUTH_MODE=sandbox` (`vite.config.ts:6-16`); CI/E2E test the sandbox. The live Supabase path is **unshipped and effectively untested**. You cannot launch a business on a build whose real data path has never run in CI. *(R-01)*

2. **Open money-integrity holes.** Refunds are non-atomic and can over-refund / desync from the gateway, and never hit the ledger (`payment-refund:131-213`); order creation is non-transactional with no idempotency (`order.service.ts:25-77`); server-side double-charge protection depends on the browser. *(R-03, R-04, R-09, R-14)*

3. **Security controls that look enforced but aren't.** Granular RBAC is client-only; country admins can act on all countries' money (`finance_engine.sql:352`); permissive `using(true)` PII policies were never dropped (`0004:167-177`); tenant isolation is absent. *(R-06, R-07, R-08)*

4. **No operational heartbeat.** No scheduler → orders aren't auto-dispatched, offers never expire, settlements/reconciliation are manual. A 24/7 logistics platform cannot run on button clicks. *(R-05, R-06)*

Any **one** of these is launch-blocking; all four are open.

---

## What is genuinely production-quality (don't rebuild it)

- **Money core:** wallet, delivery payout, coupon redemption — atomic, row-locked, idempotent (`0003`, `0011`, `0012`, `0029`).
- **Webhook security:** fail-closed HMAC + idempotency + race handling (`payment-webhook`). Best-in-class in this repo.
- **Payment capture:** server-authoritative amounts (`payment-initiate:109-126`).
- **Live ops console:** real RPCs + realtime on shared tables.
- **Engineering hygiene:** strict TS, arch guard, CI, layered repos/services.

---

## Conditional path to GO

### Gate 1 — Single-tenant, single-country pilot (clears NO-GO)
Implement & **verify against a seeded live staging Supabase** TOP20 **#1–#9**:
make live-mode the tested/shipped build · fix provisioner schema · atomic `create_order` · atomic refunds + ledger · scheduler · auto-dispatch + unify assignment + free workload · enforce RBAC/country scope · drop permissive PII policies (verify live `pg_policies`) · server-side charge dedup.
**Estimate:** ~4–6 engineer-weeks. **Exit criteria:** zero 🔴 in RISK_REGISTER; E2E runs green against **live** staging; a live `pg_policies` + Supabase `get_advisors` review is clean.

### Gate 2 — Scale & integration (before broad rollout)
TOP20 **#10–#16:** event/outbox backbone, inventory decrement, KYC gating, notification delivery, order state machine, location reconciliation, loyalty earn/redeem parity.

### Gate 3 — Multi-tenant white-label GA
TOP20 **#17–#20:** real billing + tenant-scoped quotas, DB-backed website + domain/SSL automation, auth breadth, migration/live reconciliation, fraud/chargeback, caching/rollups. **Plus** the full tenant-isolation rollout (backfill → NOT NULL `tenant_id` → per-tenant RLS), validated on staging. **Do not onboard a second tenant into the same project until this is done** (cross-tenant leakage risk — R-08).

---

## Sign-off conditions (must all be true before any live launch)

- [ ] Live backend (`HAAT_LIVE_BACKEND=1`) is the build under CI/E2E, green end-to-end.
- [ ] All 🔴 risks (R-01…R-08 + R-03/R-04) closed and verified.
- [ ] Live `pg_policies` audited; permissive PII policies removed; `get_advisors` clean.
- [ ] Refund + order-create + charge paths atomic and idempotent, with tests.
- [ ] Scheduler running dispatch/settlement/reconciliation jobs.
- [ ] Payment provider (Moyasar) webhook signing scheme confirmed against real docs.
- [ ] Rollback + incident runbook exists for the live backend.

---

## One-line verdict

**Ship the demo with pride; do not ship the business yet.** The foundation is good and the finish line is close — but four evidenced, launch-blocking gaps (demo-as-prod, money integrity, unenforced security, no scheduler) mean HaaT Now is **not enterprise-production-ready today**. Close Gate 1 and it becomes a credible single-tenant pilot; close Gates 2–3 and the multi-tenant white-label ambition becomes real.

*— Independent CTO Audit, 2026-07-05. This audit changed no code; it measured only what exists.*
