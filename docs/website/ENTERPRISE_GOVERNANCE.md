# Enterprise Governance

> HaaT Now · Phase 10.5 · Design only (Part 13). Governance over content, approvals, permissions,
> compliance, retention, versioning, legal hold, and audit — built on the Phase 9 RBAC/audit spine
> and the Workflow Engine. Nothing here is a new silo; it wires policy onto existing mechanisms.

## 1. Content governance
- **Policies** (`website_governance_policies`) declare rules per scope (tenant/site/country/content
  type): required workflow, allowed block types, banned words/claims, mandatory legal blocks
  (privacy/terms), asset licensing checks, and locale-completeness (can't publish a locale below X%
  translated).
- Enforced at **publish time** by the Publishing/Workflow engines (a policy violation blocks publish
  with a clear reason) and surfaced live in the builder as warnings.

## 2. Approval matrix (reuse Workflow Engine)
- The approval matrix (Marketing/Legal/Ops/Country) is defined in `website_workflow_defs` and gated
  by `role_permissions` + country scope (Workflow §4). Governance sets *which* content requires
  *which* matrix (e.g. legal pages require Legal; country landing pages require Country approval).

## 3. Publishing permissions
- Distinct permissions (Phase 9 `role_permissions`): `website.edit`, `website.publish`,
  `website.approve.{marketing,legal,ops,country}`, `website.emergency_rollback`,
  `website.domain.manage`, `website.custom_code`, `experiment.manage`, `experience.rules.manage`,
  `ai.generate`, `marketplace.publish`, `api.keys.manage`, `governance.manage`.
- All enforced **server-side** (RLS + RPC guards, `auth_has_permission`) — the Phase 8 lesson that
  client-only RBAC is theatre. Page-level grants via `website_page_permissions` (Phase 10).

## 4. Compliance
- **Consent & privacy**: cookie/consent banner state governs analytics/personalization (cookieless
  fallback). PII minimization (Phase 9): visitor profiles hold traits/segments, not raw PII; owner-
  only data is never cached.
- **Accessibility**: WCAG AA gate in the Theme/Builder (contrast, alt text, headings) — a
  publish-time check.
- **Regulatory**: per-country content rules (e.g. mandatory disclosures) enforced via policies +
  Country approval.

## 5. Retention & version policies
- **Version policies**: how many published versions / revisions to retain per plan; immutable
  publish history (Publishing Engine). Snapshots pruned by policy (keep last N + all tagged).
- **Data retention**: analytics raw events short-retention → rollups long-retention (Analytics §6);
  form submissions retention configurable; visitor profiles TTL + erasure on request.

## 6. Legal hold
- `website_legal_holds` freezes specified content/versions/submissions from deletion or pruning
  (overrides retention) for the duration of a hold. Applied by `governance.manage`; audited;
  publishing/rollback still allowed but nothing is *destroyed* while held.

## 7. Audit reports
- Every governance-relevant action writes `operation_events` (the platform audit timeline) plus the
  specific trail tables (workflow approvals, publish history, AI generations, key mints, domain
  binds). **Audit reports** query these into: who-published-what-when, approval SLAs, permission
  changes, emergency rollbacks, content by country, and access logs — exportable for compliance.

## 8. Tables (additive, multi-tenant, RLS)
```sql
create table website_governance_policies (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid,
  scope jsonb not null, rules jsonb not null, enabled boolean default true
);
create table website_legal_holds (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  target_type text not null, target_id uuid not null, reason text not null,
  placed_by uuid, placed_at timestamptz default now(), released_at timestamptz
);
```

## 9. Separation of duties
- The same user cannot author **and** grant all approvals when the workflow requires distinct
  approvers (configurable enforcement) — an SoD control expected by enterprise buyers.
- Emergency rollback is deliberately break-glass (single strong permission) but maximally audited.

## 10. Integration with strict concerns
Multi-tenant (all policy tenant-scoped, RLS); RBAC-native; localized (locale-completeness policy);
SEO governance (anti-cloaking, canonical-to-default — Experience §2.7); analytics governed by
consent; white-label (per-tenant policies); flag-gated; audit-complete; observability alerts on
policy violations and stuck approvals.
