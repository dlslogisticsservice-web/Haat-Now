# Experimentation Platform

> HaaT Now · Phase 10.5 · Design only (Part 9). A/B + multivariate testing built on the Experience
> Engine's variant model and the Analytics beacon. Statistically rigorous, cache-safe, multi-tenant.

## 1. Concept
An **experiment** assigns visitors to variants (control + treatments), renders the assigned variant
via the **Experience Engine**, tracks conversions via the **Analytics beacon**, computes statistical
confidence, and promotes a winner via the **Workflow Engine**. It reuses existing primitives — the
experiment is a thin assignment + measurement layer.

## 2. Types (Part 9)
- **A/B test** — one element/page, 2+ variants.
- **Multivariate (MVT)** — multiple factors × levels, combinatorial variants.
- **Feature experiment** — a `website_feature_flags` state tested as a variant (ties experiments to
  flags — one gating system).
- **Audience-split / holdout** — assign by segment (Personalization), with a global holdout group.

## 3. Tables (additive, multi-tenant, RLS)
```sql
create table website_experiments (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  name text not null, page_id uuid, type text not null check (type in ('ab','mvt','feature','holdout')),
  status text default 'draft' check (status in ('draft','running','paused','concluded','rolled_back')),
  variants jsonb not null,                        -- [{key, weight, variant_id/flag_state, factors}]
  audience jsonb,                                 -- optional segment predicate (shared grammar)
  goal jsonb not null,                            -- conversion definition (event/goal)
  min_sample int, confidence_target numeric default 0.95,
  started_at timestamptz, concluded_at timestamptz, winner_key text
);
create table website_experiment_assignments (
  experiment_id uuid not null, anon_id text not null, tenant_id uuid not null,
  variant_key text not null, assigned_at timestamptz default now(),
  primary key (experiment_id, anon_id)            -- sticky assignment
);
create table website_experiment_results (
  id uuid primary key default gen_random_uuid(), experiment_id uuid not null, tenant_id uuid not null,
  variant_key text not null, exposures bigint default 0, conversions bigint default 0,
  metric_sum numeric default 0, updated_at timestamptz default now(),
  unique (experiment_id, variant_key)
);
```

## 4. Assignment (deterministic, cache-safe)
- Bucketing is **deterministic**: `bucket = hash(experiment_id + anon_id) mod 100` compared against
  cumulative variant weights → **sticky** assignment without a round-trip. Stored for audit but
  recomputable.
- The assigned `variant_key` becomes part of the **experience cache key** (Experience Engine §2.5),
  so each variant's HTML is CDN-cached — experiments do not break caching.
- Crawlers always get control (anti-cloaking, Governance).

## 5. Conversion tracking & stats
- Exposures logged when a variant renders; conversions when the goal event fires (Analytics beacon).
- **Statistical confidence**: two-proportion z-test (binary goals) or t-test (continuous), with
  sequential-testing guardrails to avoid peeking bias; report p-value, confidence interval, and
  minimum-detectable-effect. Results roll up via the Phase 9 scheduler into
  `website_experiment_results` (dashboards read aggregates, not raw events).
- **Sample-size / duration guardrails**: an experiment cannot be "concluded" before `min_sample` +
  `confidence_target` are met (prevents false winners).

## 6. Winner selection & rollback
- On significance, the platform recommends a winner; a human promotes it: the winning variant becomes
  the default experience via the **Workflow Engine** (governed publish).
- **Rollback**: pause → serve control instantly (flag flip, no publish needed); or revert a promoted
  winner via Publishing Engine version rollback.

## 7. Guardrails & fairness
- Frequency/exposure caps; mutually-exclusive experiment groups (a visitor isn't in conflicting
  experiments); global holdout for measuring overall lift.
- Interaction with personalization: experiments run *within* an audience segment; results are
  segment-attributed.

## 8. Integration with strict concerns
- Multi-tenant (RLS; assignments/results tenant-scoped); RBAC (`experiment.manage`); localized
  (variants can be per-locale); analytics-native; flag-integrated; audited (create/start/conclude/
  promote/rollback → `operation_events`); observability watches experiment health (sample rate,
  SRM — sample-ratio mismatch — alarms).
