# Journey Builder

> HaaT Now · Phase 10.5 · Design only (Part 4). Visual lifecycle automation across web + app +
> operations, built on the platform's existing event surfaces (orders, KYC/onboarding, campaigns,
> notifications) and the Phase 9 scheduler. Reuses Saved Audiences from the Personalization Engine.

## 1. Concept
A **Journey** is a visual graph of **Trigger → Conditions → Actions → Goals**, evaluated per
subject (a visitor/lead/merchant/driver/customer). Journeys orchestrate *existing* platform
capabilities — they hold no business logic of their own (the platform's orchestrator discipline).

## 2. Subjects (Part 4)
Visitor · Lead · Merchant · Driver · Customer · Restaurant · Support · Marketing · Referral. Each
journey targets a subject type; the subject's profile/segment/state drives evaluation.

## 3. Tables (additive, multi-tenant, RLS)
```sql
create table website_journeys (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  name text not null, subject_type text not null, status text default 'draft'
    check (status in ('draft','active','paused','archived')),
  graph jsonb not null,                        -- nodes: trigger|condition|action|delay|goal + edges
  version int not null default 1, created_at timestamptz default now()
);
create table website_journey_runs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  journey_id uuid not null references website_journeys(id) on delete cascade,
  subject_id text not null,                    -- anon_id or user id
  node_id text, state text default 'active'    check (state in ('active','completed','goal_met','exited','failed')),
  context jsonb, entered_at timestamptz default now(), updated_at timestamptz default now(),
  unique (journey_id, subject_id)              -- one active run per subject (idempotent enrolment)
);
```

## 4. Node types
| Node | Meaning | Backed by |
|---|---|---|
| **Trigger** | starts a run | platform events (order_placed, kyc_submitted, signup, page_view, cart_abandon, referral_used, campaign_click) via the event backbone |
| **Condition** | branch on segment/behavior/state | shared predicate grammar |
| **Delay/Wait** | time or until-event | Phase 9 scheduler / event wait |
| **Action** | do something | notification (in-app/push/SMS/email), assign audience/segment, show experience variant, create CX ticket, grant loyalty, tag profile, webhook, start another journey |
| **Goal** | success condition | conversion (order, application approved, subscription) — closes the run |
| **Exit** | leave conditions | suppression/frequency caps |

## 5. Triggers, events & the event backbone
- Journeys consume the **platform event stream**. The Phase 8 audit's #1 structural gap was the
  absence of an event backbone; Phase 10.5 formalizes the requirement: a transactional **outbox** on
  orders/payments/onboarding/campaigns → an `events` topic → a scheduled edge drainer that advances
  journey runs. (This is a shared prerequisite listed in IMPLEMENTATION_ENHANCEMENTS.)
- Real-time triggers (page_view, cart) come from the Analytics beacon; operational triggers
  (order/kyc/settlement) come from DB outbox events.

## 6. Actions reuse existing services (no new business logic)
- Notifications → the platform notification service (in-app now; push/SMS/email once the delivery
  worker lands — a P1 platform item).
- Loyalty grant → loyalty service; CX ticket → cx service; audience assignment → Personalization;
  experience variant → Experience Engine; campaign → campaign service.
- This keeps the Journey Builder an **orchestrator**, exactly like `provisioningService`.

## 7. Execution semantics
- **Idempotent enrolment** (one active run per subject per journey) — the Phase 9 idempotency
  discipline; re-processing an event never double-enrols or double-sends.
- **Frequency caps & quiet hours** per tenant (governance) to prevent spam.
- **Deterministic, replayable**: runs are event-sourced (node transitions logged) for audit/debug.
- **Scale**: run advancement is batched by the scheduler; waits are timers, not polling.

## 8. Example journeys
- *Merchant onboarding*: `kyc_submitted` → wait-for-approval → if approved: welcome + publish their
  microsite + grant starter offer; if rejected: guidance + support ticket.
- *Cart recovery*: `cart_abandon` → 1h delay → personalized offer banner + push → goal: order.
- *Loyalty upgrade*: `tier_changed(gold)` → VIP experience variant + welcome + exclusive offers.

## 9. Integration with strict concerns
- Multi-tenant (RLS); RBAC `experience.journeys.manage`; audited to `operation_events`; localized
  actions (per-locale message templates); flag-gated; analytics on goal/conversion per journey.
