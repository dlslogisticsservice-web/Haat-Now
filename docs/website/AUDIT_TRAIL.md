# Website Platform · Audit Trail (Wave 1)

> Complete auditing: every mutation records **who / when / before / after / correlation ID / tenant /
> environment**. Backed by `website_audit_log` (memory or Supabase via the generic collection).

## Record shape
```ts
interface AuditEntry {
  id; tenantId; actorId | null;         // WHO
  createdAt;                            // WHEN
  action;                              // e.g. 'website.page.update'
  entityType; entityId;                // WHAT
  before: Json | null; after: Json | null;   // BEFORE / AFTER
  correlationId;                        // ties related mutations in one request/batch
  environment;                          // production | staging | development | sandbox
}
```

## How it is captured
The generic `AggregateService` records automatically:
- **create** → `{ before: null, after: entity }`
- **update** → `{ before: <fetched prior entity>, after: updated entity }`
- **delete** → `{ before: entity, after: null }`

Callers pass an `OperationContext { tenantId, actorId, correlationId }`; the platform context
supplies `environment`. No service forgets to audit — it is in the shared core.

## Querying
`AuditRecorder.query(filter)` supports lookups by `entityType` / `entityId` / `action` /
`correlationId` / `tenantId`. Indexes back these on the DB (`idx_website_audit_entity`,
`idx_website_audit_corr`, `idx_website_audit_tenant`).

## Correlation
A `correlationId` threads a multi-step operation (e.g. a page save that touches sections + blocks +
SEO) so the whole change set is reconstructable — critical for governance/debugging (and consumed by
the Observability layer's tracing).

## Multi-tenant & security
`website_audit_log` is tenant-scoped (RLS `tenant_id = auth_tenant()`); no anon access. In production
audit rows are typically written by the service role; the tenant policy lets an ops session read its
own history for audit reports.

## Tests
`__tests__/audit.test.ts`: full-entry capture (who/before/after/correlation/env) + correlation-id
threading + entity query.
