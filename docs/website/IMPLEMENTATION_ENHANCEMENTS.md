# Implementation Enhancements — What the design still needs

> HaaT Now · Phase 10.5 · Design only (Part 15). Without changing the Phase 10 architecture, this
> enumerates the **missing abstractions, services, interfaces, events, contracts, feature flags,
> migration helpers, prerequisites, and SDKs** required to implement Phase 10 + 10.5 cleanly. These
> are *additive foundations*, not redesigns.

## 1. Missing abstractions (cross-cutting — build once, reused everywhere)
1. **Shared Predicate/Expression Evaluator** — the single AST + evaluator used by Experience rules,
   Personalization, Journeys, Experiments, and Low-Code. **The most reused abstraction in the DXP.**
   Must run identically at the edge (Deno) and in the client (TS) — one implementation, two targets.
2. **Experience Context builder** — resolves the request signals (country/city/device/user/locale/
   campaign/flags/profile) once per request; consumed by Experience/Personalization/Experiment.
3. **Snapshot Compiler (extended)** — the Phase 10 publish compiler, extended to compile experience
   **variants** and per-locale snapshots into the published set. One compiler, many variants.
4. **Experience Cache Key** — the bounded, low-cardinality cache-key function (Experience §2.5) — the
   discipline that keeps personalization CDN-cacheable at 10k tenants.
5. **Data-Source Resolver Registry** — the map from `dataSource` → a tenant/auth-scoped platform
   repository/RPC (Realtime Blocks, Low-Code bindings, Headless API). Central allow-list; no ad-hoc
   queries.
6. **Block/Component Contract** — the formal `{schema, ssrRender, hydrate?, jsonLd?, dataSource?,
   permissions[], version}` interface (Visual Builder + Marketplace SDK) — one contract for built-in,
   marketplace, and AI-generated blocks.

## 2. Missing services
- **Event/Outbox service** (see §4) — the backbone.
- **Rendering Engine** + **Preview Engine** edge runtimes (Phase 10 Phase A) — prerequisite for all.
- **Experience Engine** resolver (Phase 10.5).
- **Personalization/Profile service** + segment materializer.
- **Journey runtime** (event-driven state machine advancer).
- **Workflow service** (approval matrix over publish).
- **AI service** (provider-agnostic generation seam).
- **Experiment assignment + stats service**.
- **Headless API gateway** + **API key service**.
- **Notification delivery worker** (push/SMS/email) — a **platform** gap from Phase 8 (P1), required
  by Journeys, Workflow notifications, and Observability alerts. Must exist for the DXP to be useful.
- **Observability collector** + alerting.
- **Marketplace service** (listings/installs/reviews/payouts via the finance ledger).

## 3. Missing interfaces / contracts
- **OpenAPI** (Headless REST v1) + **GraphQL SDL** (v2-ready) — published contracts.
- **Component/Extension SDK** typed interface (Marketplace §4).
- **Headless client SDK** (typed, generated from OpenAPI/SDL) for apps/kiosks/signage.
- **Low-Code Action registry** contract (allow-listed declarative actions).
- **Connector contract** (signed-webhook + retry, the payment-webhook pattern) for no-code
  integrations.
- **Snapshot schema** versioned contract (forward-compatible; component-version migrations).

## 4. Missing events (the event backbone — the #1 shared prerequisite)
The Phase 8 CTO audit's top structural gap was "no event backbone." The DXP makes it mandatory:
- **Transactional outbox** on `orders`, `payments`, onboarding/KYC, campaigns, loyalty, subscriptions
  → an `events` table (DB trigger writes the outbox row in the same txn) → a scheduled edge drainer
  fans out.
- **Web/behavior events** from the Analytics beacon (`page_view`, `click`, `form_submit`,
  `conversion`, `cart_*`).
- Consumers: Journeys (triggers), Experiments (exposure/conversion), Analytics (rollups),
  Personalization (profile updates), Observability (health), Realtime blocks (invalidate/update).
- **Contract**: `{ id, tenant_id, type, subject, payload, occurred_at, idempotency_key }`;
  at-least-once delivery + idempotent consumers (Phase 9 discipline).

## 5. Needed feature flags (`website_feature_flags`, per tenant/site)
`website.db_backend` (Phase 10 cutover) · `experience.engine` · `personalization` ·
`journeys` · `workflow.approvals` · `marketplace` · `ai.generate` · `builder.advanced`
(timeline/interactions) · `experiments` · `realtime.blocks.<name>` · `lowcode` ·
`headless.api` · `custom_code` · `custom_components` · `emergency_rollback`. Every capability is a
kill switch with instant fallback to the Phase 10 base behavior.

## 6. Migration helpers
- **localStorage → tables importer** (Phase 10) — one-time per tenant, idempotent.
- **Variant/experiment backfill** — seed a `default` experience variant per page so the Experience
  Engine is a no-op until rules are added (safe rollout).
- **Profile initializer** — create empty visitor profiles lazily on first beacon.
- **Snapshot re-compiler** — recompile all published sites when the snapshot schema version bumps.
- **RBAC seeder** — add the new `website.*`/`experience.*`/`experiment.*`/`ai.*`/`marketplace.*`/
  `governance.*` permission rows to `role_permissions` (extends the Phase 9 `20260705000006` seed).

## 7. Technical prerequisites
- **Edge runtime** for SSR/ISR (Vercel Edge or Supabase Edge/Deno) — the Phase 10 rendering decision;
  everything depends on it.
- **Edge KV / cache** for hot experience keys + CDN purge API access.
- **DNS + ACME automation** for custom domains/SSL (Phase 10 Domain Service).
- **Image transform** capability (Storage transforms or an edge image service) for the Media pipeline.
- **pg_cron / scheduled edge** (Phase 9 scheduler) — reused for all health/rollup/journey/experiment
  jobs. (Phase 9.5 verified pg_cron is available on the project.)
- **Realtime channel throttling / geohash partitioning** for live blocks at driver scale.
- **Tenant isolation enforcement** — the DXP assumes `tenant_id = auth_tenant()` RLS everywhere;
  this depends on completing the platform's tenant-isolation rollout (Phase 8 P2 / `20260627000010`
  foundation → enforce). **This is the one hard platform dependency** and must be scheduled.

## 8. Required SDKs (deliverables)
- **Extension SDK** (build marketplace components/plugins).
- **Headless Client SDK** (consume the experience from apps/partners/kiosks/signage).
- **Low-Code/Expression SDK** (author + evaluate predicates; shared edge+client).
- **Analytics/Beacon SDK** (lightweight, cookieless).

## 9. Summary — nothing here changes Phase 10
Every item is an **additive foundation** that the Phase 10 architecture already anticipated (the
Builder/Data/Delivery split, snapshots, edge rendering, tenant RLS, the scheduler, `role_permissions`).
The critical shared build order is: **edge runtime → event backbone → shared evaluator → snapshot
compiler (variants) → then the feature engines**. The one external dependency is completing tenant-
isolation RLS enforcement at the platform level.
