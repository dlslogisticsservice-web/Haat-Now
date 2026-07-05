# Enterprise CTO Challenge — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> "If I became CTO tomorrow, which architectural decisions would I challenge — regardless of who made them?" Evidence cited `file:line`.

---

## Challenge 1 — Shipping the demo *as* production 🔴 **Redesign**
**Decision:** Force `VITE_AUTH_MODE=sandbox` at build so production ships as a client-side demo (`vite.config.ts:6-16`).
**Challenge:** This is defensible as a *sales artifact* but dangerous as *the default production build*. It means the code path customers see is never the code path that runs the business, and CI/E2E test **the sandbox** (`ci.yml` `VITE_AUTH_MODE: sandbox`) — so the live backend is **effectively untested**. Every "it works" is a statement about localStorage.
**Redesign:** Separate the two builds explicitly. Make the live backend the CI/E2E target (against a seeded staging Supabase). Keep the demo as a clearly-labelled, separately-deployed artifact. Never let "demo green" imply "backend ready."

## Challenge 2 — Dual-mode inside every service 🔴 **Redesign**
**Decision:** Each service embeds `if (SANDBOX) { localStorage } else { supabase }`.
**Challenge:** This doubles every code path and guarantees drift; the demo path is richer and shipped, the live path is thin and unexercised (loyalty, campaign conversion, dispatch trigger, provisioning all dead in live). It's the root cause of most "wired in sandbox only" findings.
**Redesign:** One data path. Put the demo behind a **mock repository / MSW-style seam at the repository boundary**, not `if` branches scattered through business logic. Business/service code should be mode-agnostic.

## Challenge 3 — No event backbone 🔴 **Redesign**
**Decision:** Cross-module reactions are direct service calls; **no DB triggers on `orders`/`payments`**, no queue, no outbox.
**Challenge:** Integration correctness depends on whether someone remembered to add a call. Most weren't (loyalty, inventory, conversion, CX auto-ticket, notifications-outside-orderService). This is not a bug list — it's a missing architectural layer.
**Redesign:** Add a transactional **outbox**: DB trigger on order/payment status transitions → `events` table → scheduled edge worker fans out. This single component closes the majority of cross-module gaps and makes reactions reliable regardless of entry point.

## Challenge 4 — Business logic in the browser 🟠 **Redesign**
**Decision:** Order totals, delivery fee, order-create sequencing, coupon-after-payment orchestration live in `CheckoutPage.tsx` (`:287-335, :108-119`); order creation is 3 client round-trips (`order.service.ts:25-77`).
**Challenge:** Money math and multi-step integrity must be server-authoritative. Client-authored `total_amount`/`delivery_fee` and non-transactional creation are integrity holes.
**Redesign:** A single `create_order` RPC (server-computed totals, atomic insert, client idempotency key). The client sends intent, not amounts.

## Challenge 5 — RBAC theatre 🔴 **Redesign**
**Decision:** A 35-permission, 9-role matrix (`rbac.service.ts`) that exists only in localStorage and only hides UI; the DB knows 4 roles + one scope flag.
**Challenge:** This *looks* like enterprise least-privilege and *is not*. Every admin is omnipotent server-side; country admins act across all countries on money tables (`finance_engine.sql:352`). For an acquirer this is a compliance red flag.
**Redesign:** Persist roles/permissions to the DB; gate RLS and RPCs on specific permissions; apply country/tenant predicates to finance/ops policies.

## Challenge 6 — Multi-tenant branding without multi-tenant isolation 🔴 **Redesign**
**Decision:** Ship per-tenant theming, a CMS, and a provisioning wizard while `tenant_id` is nullable and enforced by **no** RLS (`tenant_isolation_foundation.sql`), and the provisioner writes columns that don't exist.
**Challenge:** The platform sells "multi-tenant SaaS" but is single-tenant at the data layer and its provisioner is incompatible with its schema. Onboarding a second real tenant would either fail or leak.
**Redesign:** Finish the isolation rollout (backfill → NOT NULL → per-tenant RLS) and fix the provisioning↔schema contract *before* any multi-tenant claim.

## Challenge 7 — No scheduler for a 24/7 logistics platform 🔴 **Add component**
**Decision:** Dispatch expiry, reassignment, settlements, segment recompute, reconciliation are **manual buttons**.
**Challenge:** A delivery platform cannot depend on an admin clicking "expire offers." This is a missing operational heart.
**Redesign:** pg_cron and/or scheduled edge functions driving the outbox worker, dispatch sweeps, and settlement runs.

## Challenge 8 — Refund/finance not reconciled to real cash 🟠 **Redesign**
**Decision:** A real double-entry ledger (`finance_engine.sql`) that is **fed only by commission/settlement RPCs** — gateway captures and refunds never post to it; refunds are non-atomic.
**Challenge:** A ledger that doesn't reconcile to the payment gateway is a model, not books. Finance can't trust it.
**Redesign:** Post `platform_cash`/`customer_refund` entries from the webhook (capture) and refund flow; make refunds atomic with a unique/locked guard.

## Challenge 9 — One Supabase project as the whole backend 🟠 **Revisit**
**Decision:** All logic in Postgres RPCs + PostgREST + Realtime on a single project; no app tier, cache, queue, or replicas.
**Challenge:** Elegant and cheap for a pilot; a single blast radius and a hard ceiling for 100 tenants/20 countries/10k drivers. Realtime GPS fan-out and live analytics aggregation will hit limits first.
**Redesign (staged):** Add a worker/queue tier, rollup tables/materialized views, realtime throttling, and a horizontal-scaling plan (per-region projects or sharding) as load grows.

## Challenge 10 — Compliance controls that don't control 🟠 **Wire up**
**Decision:** KYC/suspension/ban workflows exist with audit trails but are **not gates** — a banned merchant/driver still transacts.
**Challenge:** Controls that don't block are documentation, not compliance.
**Redesign:** Enforce `account_status` in order creation, checkout, and driver assignment.

---

## What I would NOT change (deliberate strengths)
- The **money-core RPCs** (wallet, delivery payout, coupon redemption) — atomic, locked, idempotent. Keep.
- The **webhook security model** — fail-closed HMAC + idempotency. Best-in-class here.
- The **layered architecture + arch guard** — good bones; the fix is to enforce it deeper (logic out of UI), not replace it.
- The **CMS/provisioning UX and orchestrator design** — reuse the orchestrator; just point it at a real backend.

## One-paragraph verdict
HaaT Now is an unusually **polished, coherent demo** sitting on a **genuinely strong money-transaction core** and a **half-built enterprise backend**. The architectural decisions I'd challenge all stem from a single strategic choice — optimizing for a convincing client-side demo — which produced a dual-mode fork, an untested live path, RBAC/tenancy/ops that look complete but aren't enforced, and no event/scheduler backbone. None of it is irredeemable; the bones are good. But as it stands, the platform is **demo-ready, not production-ready**, and the gap is systematically hidden by the very thing that makes the demo impressive.
