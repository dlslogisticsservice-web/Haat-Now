# Role Routing Audit — "all accounts land on the same screen"

**Date:** 2026-06-23
**Mode in production:** Supabase (real). `IS_SANDBOX = VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV`; `DEV` is `false` in any `vite build`, so **production always uses the Supabase auth path** regardless of `VITE_AUTH_MODE`.
**Status:** Investigation only — nothing changed.

---

## 1. Login → navigation flow (traced)

1. `LoginScreen` collects phone → OTP, calls `authService.verifyOtp(phone, token)`.
2. `authService.verifyOtp` ([src/services/auth.service.ts:70](../../src/services/auth.service.ts#L70)):
   - **Supabase path** → `supabase.auth.verifyOtp({phone, token, type:'sms'})` returns the auth user, then **`role = await resolveHighestRole(sbUser.id)`** and returns `{ id, phone_number, role }`.
3. `App.handleLoginSuccess(user)` → `setSession(user)` ([src/App.tsx:194](../../src/App.tsx#L194)). Session is also recovered on refresh via `authService.getCurrentUser()` → `resolveHighestRole` again.
4. **Routing decision** is made in `App.tsx` purely from `session.role`:
   - `session.role === 'customer'` → Customer App ([App.tsx:299](../../src/App.tsx#L299))
   - `'merchant'` → `MerchantApp` ([App.tsx:599](../../src/App.tsx#L599))
   - `'driver'` → `DriverApp` ([App.tsx:600](../../src/App.tsx#L600))
   - `'admin'` → `AdminDashboard` ([App.tsx:601](../../src/App.tsx#L601))
5. **Scope** (super vs country) is resolved *inside* `AdminDashboard` from `admin_users.scope` ([AdminDashboard.tsx:104](../../src/features/admin/AdminDashboard.tsx#L104)) — but this is only reached if `role==='admin'`.

## 2. Where each value comes from

| Value | Source (Supabase/prod) | Source (sandbox/dev) |
|---|---|---|
| **Destination route** | `App.tsx` switch on `session.role` | same |
| **Role** | `resolveHighestRole()` → **`user_roles` ⋈ `roles`** table | `DEMO_ACCOUNTS` map (auth.service.ts) |
| **Scope** | `admin_users.scope` (in AdminDashboard) | `adminId.startsWith('55555555')` |
| Session storage | Supabase auth session (JWT) | `localStorage['haat_sandbox_session']` |

Role is **not** read from auth metadata. It is read from the **`user_roles`** table. Scope is read from **`admin_users`**.

## 3. Live data vs. resolver output (root of the bug)

The database is **correctly seeded** (verified live). Each account has its elevated role, plus a base `customer` role:

| Phone | Auth user id | `user_roles` (live) | DB highest role | `admin_users.scope` |
|---|---|---|---|---|
| +201000000001 | 080b74ea… | customer(1) | customer | — |
| +201000000002 | 2fff279b… | customer(1), **merchant(3)** | merchant | — |
| +201000000003 | 3f957037… | customer(1), **driver(2)** | driver | — |
| +201000000004 | dfb6dbf0… | customer(1), **admin(4)** | admin | country (EG) |
| +966500000004 | 5622d5ff… | customer(1), **admin(4)** | admin | country (SA) |
| +201000000005 | 353e1df3… | customer(1), **admin(4)** | admin | **super** |

**Crucial:** the `customer` assignment was inserted **first** for every account (`created_at` ≈ 22:11) and the elevated role **later** (≈ 22:14).

`resolveHighestRole()` tries to pick the top role with:
```ts
supabase.from('user_roles')
  .select('roles(name, priority)')
  .eq('user_id', userId)
  .order('priority', { ascending: false, referencedTable: 'roles' })  // ← order PARENT by EMBEDDED column
  .limit(1)
  .maybeSingle();
const name = (data as any)?.roles?.name;
return (name is valid role) ? name : 'customer';                       // ← hard fallback
```

PostgREST does **not** reliably order the parent (`user_roles`) rows by a column on a **to-one embedded** resource (`roles`). The `order=roles(priority).desc` does not become an effective parent `ORDER BY`, so `.limit(1)` returns an effectively arbitrary row — and on any miss the function **hard-falls back to `'customer'`**. Because every account has a (first-seeded) `customer` assignment, the resolver yields **`customer` for all six accounts**.

### Empirical proof (live DB)
- Correct query `… ORDER BY roles.priority DESC LIMIT 1` → **merchant / driver / admin / admin** (right).
- Ineffective `… LIMIT 1` (no effective parent order, the PostgREST reality) → **customer** for super-admin, EG-admin, driver (wrong).

## 4. Per-role result (current vs expected)

| Phone | Detected role (now) | Detected scope | Destination (now) | Expected destination |
|---|---|---|---|---|
| +201000000001 | customer | — | **Customer App** | Customer App ✅ |
| +201000000002 | customer ❌ (is merchant) | — | **Customer App** | Merchant Portal |
| +201000000003 | customer ❌ (is driver) | — | **Customer App** | Driver Portal |
| +201000000004 | customer ❌ (is admin) | country (EG) | **Customer App** | Admin Dashboard (EG scope) |
| +966500000004 | customer ❌ (is admin) | country (SA) | **Customer App** | Admin Dashboard (SA scope) |
| +201000000005 | customer ❌ (is admin/super) | super | **Customer App** | Admin Dashboard (super scope) |

## 5. Why all users reach the same screen

Routing is correct; **role resolution is broken**. `resolveHighestRole()` returns `customer` for everyone (broken cross-embed ordering + hard fallback), so `App.tsx` renders the **Customer App** for all six accounts. Scope (`admin_users`) is correct but never consulted, because no one is routed as `admin`.

## 6. Affected files

| File | Role in the bug |
|---|---|
| **`src/services/auth.service.ts`** → `resolveHighestRole()` | **Primary defect.** Used by `verifyOtp` (login) and `getCurrentUser` (refresh). |
| `src/App.tsx` (routing switch) | Correct — no change needed. |
| `src/features/admin/AdminDashboard.tsx` (`isSuper` via `admin_users`) | Correct — unreachable until role is fixed. |

### Secondary / latent findings (not the cause, worth noting)
- **`service_role` has no `SELECT` grant on `public.user_roles`** (live `42501`). The app reads as `authenticated` (which has `SELECT`), so login is unaffected — but any server-side/edge-function role read would fail.
- The **silent `'customer'` fallback** masks all resolution failures (no log), turning any query error into a quiet customer downgrade.

## 7. Exact fix plan (DO NOT APPLY YET)

**Primary — make role resolution deterministic, not dependent on cross-embed ordering.**

*Option A — client-side ordering (smallest change, no migration):*
```ts
const { data } = await supabase
  .from('user_roles')
  .select('roles(name, priority)')
  .eq('user_id', userId);
const top = (data ?? [])
  .map((r: any) => r.roles)
  .filter(Boolean)
  .sort((a: any, b: any) => b.priority - a.priority)[0];
const name = top?.name;
return (name === 'admin' || name === 'merchant' || name === 'driver' || name === 'customer') ? name : 'customer';
```

*Option B — `SECURITY DEFINER` RPC (most robust; also fixes the service_role gap & RLS edges):*
```sql
create or replace function public.get_highest_role(uid uuid) returns text
language sql security definer stable as $$
  select r.name from public.user_roles ur join public.roles r on r.id = ur.role_id
  where ur.user_id = uid order by r.priority desc limit 1
$$;
```
…called via `supabase.rpc('get_highest_role', { uid: userId })`.

**Recommendation:** Option A for the immediate hotfix (one file, no DB change). Add a `console.warn` when no role row is found so the `customer` fallback is observable. Consider Option B as follow-up hardening.

**Secondary (optional):** `grant select on public.user_roles to service_role;` if server-side role reads are needed.

**Verification after fix:** re-login each phone and assert:
`+…0002`→Merchant Portal, `+…0003`→Driver Portal, `+…0004`→Admin (EG), `+9665…0004`→Admin (SA), `+…0005`→Admin (super, Design Center visible), `+…0001`→Customer App.

---
**No code changed. No commit. No push.** Investigation only.
