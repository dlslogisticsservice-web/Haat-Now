# RC2 Remediation Report

Eliminates the two website-builder findings from the Final Release Certification
(`FINAL_RELEASE_SECURITY_CERTIFICATE.md`):

- **RC2-1 (Medium)** — `website_outbox_append` cross-tenant write.
- **RC2-2 (Low)** — `website_refresh_tenant_stats` callable by any authenticated user.

Scope was strictly these two website-platform RPCs. No certified subsystem — food delivery,
payments, wallets, dispatch, authentication — was touched; no unrelated refactor. One DB
migration (applied to prod `haat-now-prod`) + a regression suite. **No application code changed**
(RPC signatures preserved; the website SDK keeps calling them unchanged).

## RC2-1 — `website_outbox_append` tenant isolation — ELIMINATED
**Root cause:** the function inserted into `website_event_outbox` with the client-supplied
`p_tenant` and **no tenant-membership check** (bypassing the table's tenant RLS), so any
authenticated user could enqueue events for any tenant.

**Fix:** the caller must be a **member of `p_tenant`** (`tenant_members`) or **Operations Admin**:
```
if auth.uid() is null then raise 'Authentication required'; end if;
if not is_ops_admin() and not exists (
  select 1 from tenant_members tm where tm.tenant_id = p_tenant and tm.user_id = auth.uid()
) then raise 'permission denied: not a member of tenant' (42501); end if;
```
The client-supplied `p_tenant` is no longer trusted on its own — a cross-tenant write is rejected;
a member writes only to their own tenant; ops may bypass. Idempotency + insert logic unchanged.

## RC2-2 — `website_refresh_tenant_stats` authorization — ELIMINATED
**Root cause:** no authorization — any authenticated user could trigger a full
`REFRESH MATERIALIZED VIEW` (compute/DoS).

**Fix:** Service Role (`auth.uid()` is null) or Operations Admin only:
```
if auth.uid() is not null and not is_ops_admin() then raise 'not authorised' (P0001); end if;
```
The guard is placed **outside** the refresh's `CONCURRENTLY → plain` fallback `exception` block, so
the authorization error can never be swallowed by the fallback.

Both RPCs: `EXECUTE` revoked from `anon`/`public` (members/ops call them as `authenticated`).

## Files changed
- **Migration added:** `supabase/migrations/20260801000007_rc2_remediation.sql` (applied to prod;
  history reconciled to a single canonical row `20260801000007`).
- **Regression suite added:** `supabase/tests/rc2_remediation_regression.sql`.
- **Application code:** none.

## Regression tests added
`rc2_remediation_regression.sql` (impersonated, self-cleaning; seeds a throwaway `auth.users`
admin for the ops path) proves all five required scenarios plus a structural anon-revoke check.

## Evidence — RC2-1 & RC2-2 eliminated (live, on prod)
```
RC2-1 non-member append BLOCKED             = true    (cross-tenant rows = 0)
RC2-1 member append to OWN tenant WORKS      = true    (own-tenant rows = 1)
RC2-1 member append to OTHER tenant rows     = 0
RC2-1 admin append WORKS                      = true    (admin rows = 1)
RC2-2 non-admin refresh BLOCKED               = true
RC2-2 admin refresh WORKS (no auth error)     = true
RC2_REMEDIATION_REGRESSION: RC2-1 + RC2-2 closed
```
✓ Non-member cannot append to another tenant · ✓ Member can append to own tenant · ✓ Admin can
append · ✓ Unauthorized refresh fails · ✓ Admin refresh succeeds.

## Quality gates
| Gate | Result |
|---|---|
| Migration apply (prod) | ✅ clean |
| RC2-1 + RC2-2 regression (impersonated + structural) | ✅ **closed** |
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| ESLint (`tsc` + architecture + demo-isolation) | ✅ clean |
| Unit + integration tests | ✅ **777 pass / 0 fail** |
| Guardian | ✅ **544 files · 0 cycles · 0 violations** |
| Production build | ✅ |

## Status
**RC2-1 and RC2-2 are eliminated and verified on production.** With this pass the entire program's
findings — B1–B8, RT-1/2, F-1…F-8, N-1/2, C-1…C-4, RC-1, and RC2-1/RC2-2 — are closed. Full fix
chain: migrations `20260801000001 … 20260801000007`. No Red Team re-run (per instructions); no
deployment, Vercel, or infrastructure change. Stop after remediation.
