# Role Routing Fix Report

**Date:** 2026-06-23
**Branch:** `feat/auth-recovery-frontend-sprint`
**Commit:** `1710bb5` (`1710bb58c0df0625d56d6b96e020a49b0fed289d`)
**File changed:** `src/services/auth.service.ts` (one function)

---

## Root cause

`resolveHighestRole()` selected the user's top role with PostgREST **embedded ordering**:
```ts
.select('roles(name, priority)').eq('user_id', userId)
.order('priority', { ascending: false, referencedTable: 'roles' })  // order parent by EMBEDDED col
.limit(1).maybeSingle();
```
Ordering the parent `user_roles` rows by a column on the **to-one embedded** `roles` resource is
not reliably applied by PostgREST, so `.limit(1)` returned an effectively arbitrary row. Because a
base `customer` assignment was seeded **first** for every account, the resolver returned `customer`
for everyone, and the function additionally **hard-fell back to `customer`** on any miss. Result:
merchant / driver / admin / super accounts were all downgraded to `customer` and routed to the
**Customer App** (`App.tsx` switches purely on `session.role`).

## Exact code fix

Replaced the embedded-ordering query with a fetch-all + client-side max-priority selection, plus
explicit logging:

```ts
const VALID_ROLES = ['admin', 'merchant', 'driver', 'customer'] as const;
const isValidRole = (n: unknown): n is User['role'] =>
  typeof n === 'string' && (VALID_ROLES as readonly string[]).includes(n);

async function resolveHighestRole(userId: string): Promise<User['role']> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(name, priority)')
    .eq('user_id', userId);

  if (error) {
    console.error(`[auth] resolveHighestRole: query failed for user ${userId} — defaulting to customer.`, error);
    return 'customer';
  }

  type RoleRef = { name: string; priority: number };
  const assignments = ((data ?? []) as Array<{ roles: RoleRef | RoleRef[] | null }>)
    .flatMap(r => (Array.isArray(r.roles) ? r.roles : r.roles ? [r.roles] : []))
    .filter((r): r is RoleRef => !!r && typeof r.priority === 'number');

  if (assignments.length === 0) {
    console.warn(`[auth] resolveHighestRole: no role assignments for user ${userId} — defaulting to customer.`);
    return 'customer';
  }

  const highest = assignments.reduce((a, b) => (b.priority > a.priority ? b : a));

  if (!isValidRole(highest.name)) {
    console.error(`[auth] resolveHighestRole: unrecognised highest role "${highest.name}" for user ${userId} — defaulting to customer.`);
    return 'customer';
  }
  return highest.name;
}
```

Requirements satisfied:
- ✅ Fetches **all** role assignments for the user.
- ✅ Resolves highest role by `roles.priority` **descending** (client-side `reduce`).
- ✅ Does **not** rely on PostgREST embedded ordering.
- ✅ Does **not** silently fall back to `customer` when valid role data exists (only genuinely
  role-less users fall back, with a `warn`; query errors / unrecognised roles `console.error`).
- ✅ Adds explicit logging for unexpected resolution failures.

## Role verification (live database, fixed logic)

| Phone | `user_roles` (live) | Resolved role | Expected | OK |
|---|---|---|---|---|
| +201000000001 | customer | **customer** | customer | ✅ |
| +201000000002 | merchant, customer | **merchant** | merchant | ✅ |
| +201000000003 | driver, customer | **driver** | driver | ✅ |
| +201000000004 | admin, customer | **admin** | admin (EG) | ✅ |
| +966500000004 | admin, customer | **admin** | admin (SA) | ✅ |
| +201000000005 | admin, customer | **admin** | admin (super) | ✅ |

Computed by replicating the fixed resolver (fetch all `(name, priority)`, pick max priority) against
live data — all six correct.

## Routing verification

`App.tsx` routes purely on `session.role` (unchanged, correct):

| Role | Destination |
|---|---|
| customer | Customer App ([App.tsx:299](../../src/App.tsx#L299)) |
| merchant | Merchant Portal ([App.tsx:599](../../src/App.tsx#L599)) |
| driver | Driver Portal ([App.tsx:600](../../src/App.tsx#L600)) |
| admin | Admin Dashboard ([App.tsx:601](../../src/App.tsx#L601)) |

With the resolver fixed, each account now reaches its correct portal.

## Admin scope verification

Scope is resolved inside `AdminDashboard` from `admin_users.scope`
([AdminDashboard.tsx:104](../../src/features/admin/AdminDashboard.tsx#L104)); `isSuper` injects the
**Campaign Center** and **Design Center** tabs and gates their render. Live `admin_users`:

| Phone | scope | country | Sees |
|---|---|---|---|
| +201000000004 | country | EG | Admin Dashboard — **EG only** |
| +966500000004 | country | SA | Admin Dashboard — **SA only** |
| +201000000005 | super | (all) | Admin Dashboard — **all countries** + Design Center + Campaign Center + super scope |

Country isolation is enforced server-side by RLS (`order_country_code` `SECURITY DEFINER` scoping
from the earlier cutover) and was independently verified then (SA-admin=1 / EG-admin=0 / super=1).
The role fix simply ensures admins now reach the dashboard so that scope applies.

## Build status

- `npx tsc --noEmit` on app `src`: **clean** (only pre-existing Deno edge-function files error, excluded from the app build).
- `npm run build`: ✅ **passes** (~9.6s, no errors).

## Commit hash

`1710bb5` — `fix(auth): correct highest-role resolution and portal routing`

## Push status

✅ Pushed to `origin/feat/auth-recovery-frontend-sprint` (`7586418..1710bb5`). Remote HEAD == local HEAD (0 ahead / 0 behind).

## Notes / optional follow-ups (not in this change)

- `service_role` lacks `SELECT` on `public.user_roles` (live `42501`). The app reads as
  `authenticated` (which has the grant + the `auth.uid() = user_id` policy), so login is
  unaffected — but server-side/edge role reads would fail. Grant if needed:
  `grant select on public.user_roles to service_role;`
- A `SECURITY DEFINER get_highest_role(uid)` RPC remains an optional hardening that would also
  cover the service_role gap.
