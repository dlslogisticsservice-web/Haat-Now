# Workflow Engine

> HaaT Now · Phase 10.5 · Design only (Part 5). **Extends the Phase 10 Publishing Engine** (which
> already has draft → preview → review → approval → publish → rollback) with a configurable,
> multi-stage **approval matrix** and enterprise controls. It does not replace publishing — it wraps
> it with governance.

## 1. Concept
A **Workflow** gates a publish behind an ordered set of **approval stages**. The Publishing Engine's
`publish_site` RPC is invoked only after all required approvals are granted. Configurable per site,
per content type, and per country.

## 2. Stages (Part 5)
Draft → Review → **Marketing Approval** → **Legal Approval** → **Operations Approval** →
**Country Approval** → Scheduled/Instant Publish → (Rollback / Emergency Rollback). Any subset is
configurable; stages run in a defined order or in parallel where independent.

## 3. Tables (additive, multi-tenant, RLS)
```sql
create table website_workflow_defs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  name text not null, applies_to jsonb,          -- {content_type, country, page_pattern}
  stages jsonb not null,                          -- ordered [{key, approver_permission, required, parallel}]
  enabled boolean default true
);
create table website_workflow_instances (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
  target_type text not null,                      -- 'page'|'site'|'experience_variant'
  target_id uuid not null, def_id uuid not null,
  state text not null default 'draft',            -- draft|in_review|approved|scheduled|published|rejected|rolled_back
  requested_by uuid, scheduled_at timestamptz, idempotency_key text, created_at timestamptz default now(),
  unique (idempotency_key)
);
create table website_workflow_approvals (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  instance_id uuid not null references website_workflow_instances(id) on delete cascade,
  stage_key text not null, decision text check (decision in ('approved','rejected','changes_requested')),
  approver_id uuid, comment text, decided_at timestamptz default now(),
  unique (instance_id, stage_key, approver_id)
);
```

## 4. Approval matrix
- Each stage names a required **permission** (Phase 9 `role_permissions`): e.g.
  `website.approve.marketing`, `website.approve.legal`, `website.approve.ops`,
  `website.approve.country` (country-scoped via `auth_admin_country`, reusing the Phase 9 country
  scope). An approver must hold the stage permission **and** (for country stage) match the content's
  country.
- Stages can be **required** or advisory, **sequential** or **parallel**.
- Enforced server-side by `auth_has_permission` in the workflow RPCs (not client-only — the Phase 8
  RBAC lesson).

## 5. Publish gating (reuse Publishing Engine)
```
all required approvals granted  →  workflow RPC calls publish_site(idempotency_key)
scheduled_at set               →  Phase 9 scheduler fires publish_site at time
```
Publish stays **atomic + idempotent + snapshot-based** (Phase 10). The workflow only decides *when*
it is allowed to run.

## 6. Rollback & emergency rollback
- **Rollback**: re-point live to a prior published version (Publishing Engine §5) via workflow with
  normal approvals.
- **Emergency Rollback**: a break-glass path — a holder of `website.emergency_rollback` can revert
  the live snapshot **immediately**, bypassing the approval matrix, with a mandatory reason. The
  action is heavily audited (who/when/why) and notifies all approvers. Time-to-safe is seconds
  because snapshots are immutable and versioned.

## 7. Notifications & audit
- Stage transitions notify the relevant approvers (reuse the notification service / Journey actions).
- Every request/approval/rejection/publish/rollback writes `operation_events` (audit) plus the
  `website_workflow_approvals` trail → a complete, queryable approval history (Governance §Audit).

## 8. Content lock & concurrency
- While an instance is `in_review`, the target is soft-locked (edits create a new draft revision but
  cannot publish) — prevents approving-then-changing. Last-writer conflict detection via
  `updated_at` (Phase 10 builder discipline).

## 9. Integration with strict concerns
- Multi-tenant (RLS); RBAC (stage permissions + country scope); localized approval UI; flag-gated
  (a site can run "self-serve publish" with a zero-stage workflow, or "enterprise" with the full
  matrix); audit-complete; observability watches for stuck/failed workflows (Observability §Failed
  Workflows).
