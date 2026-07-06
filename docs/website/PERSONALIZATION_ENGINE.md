# Personalization Engine

> HaaT Now · Phase 10.5 · Design only (Part 3). Builds on the Experience Engine (variant selection)
> by adding **who** the visitor is (segments/profiles) and **1:1 overlays**. Privacy-first,
> cookieless-capable, multi-tenant.

## 1. Layers
```
Audience Segments  ──►  match visitor to segments (server, at edge)
Visitor Profile    ──►  durable, tenant-scoped behavior/attribute store
Rules Engine       ──►  segment/behavior conditions → variant + dynamic component decisions
Overlays           ──►  coarse (in cache key) vs 1:1 (client island, post-paint)
```

## 2. Tables (additive, multi-tenant, RLS)
```sql
create table website_audience_segments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  key text not null, name text not null,
  definition jsonb not null,                 -- predicate AST over profile/context (shared grammar)
  materialized boolean default false,        -- precomputed membership vs evaluated live
  created_at timestamptz default now(), unique (site_id, key)
);
create table website_visitor_profiles (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  anon_id text not null,                      -- salted, cookieless-capable first-party id
  user_id uuid,                               -- linked when authenticated
  traits jsonb not null default '{}',         -- country, device, loyalty_tier, plan, returning...
  behavior jsonb not null default '{}',       -- last_pages, categories_viewed, cart_state, recency
  segments text[] not null default '{}',      -- cached segment memberships
  updated_at timestamptz default now(), unique (tenant_id, anon_id)
);
create table website_segment_memberships (
  segment_id uuid not null, anon_id text not null, tenant_id uuid not null,
  since timestamptz default now(), primary key (segment_id, anon_id)
);
```

## 3. Audience Segments
- Defined by a predicate AST over profile traits + behavior + context (the **one shared grammar**
  used by Experience rules, Journeys, Experiments, Low-Code).
- Examples: `returning_visitors`, `vip_loyalty (tier in gold,platinum)`, `cart_abandoners`,
  `eg_ramadan (country=EG and daypart=iftar)`, `new_merchants (user_type=merchant and age<7d)`.
- **Saved Audiences** are reusable across Personalization, Journeys, Experiments, and Campaigns
  (the platform CRM) — one audience definition, many consumers.
- **Materialized** (precomputed membership via the Phase 9 scheduler) for large/expensive segments;
  **live-evaluated** for cheap context segments.

## 4. Visitor Profiles & Behavior tracking
- Populated by the Analytics beacon (Phase 10) + authenticated session traits (loyalty tier, plan,
  wallet presence — never raw PII in the profile cache).
- **Cookieless-first**: `anon_id` is a salted first-party identifier; consent-gated durable id only
  where the visitor accepts. Honors DNT/consent (governance).
- Behavior: recency/frequency, categories/stores viewed, last order recency, cart state — enough to
  drive recommendations without cross-site tracking.

## 5. Rules Engine
- Deterministic evaluation of conditions → decisions: choose experience variant, toggle **dynamic
  components** (show/hide/swap a block), or feed the **recommendation** slot.
- Runs at the edge for coarse decisions (cache-safe) and client-side for 1:1 decisions (islands).
- Same evaluator as the Experience Engine and Low-Code layer (no duplicate logic).

## 6. Smart Recommendations
- Recommendation slots are **dynamic blocks** (Realtime Blocks) whose data source is a recommender:
  "popular near you", "reorder your usual", "offers for your tier", "stores in your city".
- v1: heuristic/collaborative from platform data (order history, popularity, geo) — no ML dependency.
- v2 (optional): pluggable ML scoring via the AI seam (decoupled — see AI_EXPERIENCE_PLATFORM).
- Recommendations are tenant/country-scoped and **PII-free** (Phase 9 lesson).

## 7. Real-time personalization
- First paint = CDN-cached coarse experience (fast, SEO-safe).
- Post-paint = client islands call the **Headless API** with the `anon_id` to fetch 1:1 overlays
  (recommendations, wallet/loyalty summary, "welcome back") → hydrate in place.
- This split preserves cacheability and Core Web Vitals while delivering true 1:1 personalization.

## 8. Dynamic components
- Any block can carry a `personalization` binding: `{ visibleWhen: <predicate>, variantWhen: [...],
  dataSource: <recommender> }`. The builder exposes this via the Low-Code inspector (no code).

## 9. Integration with strict concerns
- **Multi-tenancy**: profiles/segments are `tenant_id`-scoped; no cross-tenant visitor graph.
- **RBAC**: `experience.audiences.manage`, `experience.personalization.manage`.
- **Analytics**: segment membership + personalization decisions attached to beacons for measurement.
- **Governance**: consent + retention policies on profiles (legal hold / erasure supported).
- **Feature Flags**: personalization can be flagged off per tenant (kill switch) with instant
  fallback to the default experience.
