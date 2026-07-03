# RBAC Validation Report — Production Activation

## The gap that was closed
Before this sprint, `rbac.service` was **localStorage-only in every mode**, and the guard's acting role
**defaulted to `super_admin`** — meaning in a live build **every user would be treated as super admin**. This was
the single biggest production security hole (per the audit).

## What was implemented ([`src/services/rbac.service.ts`](src/services/rbac.service.ts), [`src/App.tsx`](src/App.tsx))
A production permission path that derives the effective role from the **authenticated identity**, with **zero
localStorage** and **fail-closed** defaults — while the sandbox demo's acting-role preview is unchanged.

- **`getActingRole()`** — live: returns the identity-derived role (`liveRoleKey`), or `''` (no permissions) until
  identity is known (**fail-closed**). Sandbox: unchanged (localStorage acting role, default `super_admin`).
- **`hasPermission(roleId, perm)`** — live: resolves scope+permissions from the **canonical static templates**
  (`ROLE_TEMPLATES` / `templatePermissions`), **not** localStorage. Sandbox: unchanged (editable localStorage roles).
- **`setLiveIdentity(appRole, scope)`** — maps the real coarse role + `admin_users.scope` → a canonical RBAC
  template: super admin → `super_admin`, country admin → `country_manager`, merchant → `merchant_owner`,
  driver → `driver`, customer → none. No-op in sandbox.
- **`clearLiveIdentity()`** — clears the effective role on logout (live).
- **`setActingRole()`** — **disabled in live** (the authenticated identity is authoritative; a client cannot
  self-escalate by writing localStorage). Sandbox: unchanged.
- **Wiring** — `App.tsx` `syncRbacIdentity()` pushes the identity into rbac on session-restore, login,
  `onAuthStateChange`, and clears on logout. (rbac must not import `auth.service` — platform→application is a
  forbidden dependency — so identity is pushed **in** from the app layer.)

**Server-side enforcement remains Supabase RLS** (the migrations include `security_hardening`, `rls_recovery`,
`admin_rls_policies`). The client guard reflects the real identity for UX; RLS is the actual enforcement.

## Role validation (code-level, per the 5 required roles)
Effective permissions derived from the canonical templates + `admin_users.scope`:

| Role | Live effective template | Key permissions (from `ROLE_TEMPLATES`) | Super-only surfaces |
|---|---|---|---|
| **Customer** | none | — | denied |
| **Driver** | `driver` | `orders.view` | denied |
| **Merchant** | `merchant_owner` | orders view/manage, catalog.*, finance.view, support.view | denied |
| **Country Admin** | `country_manager` | operations/fleet/orders, finance.view, support.view, marketing.growth.view, compliance.kyc.view | **denied** (scope=country) |
| **Super Admin** | `super_admin` | `*` (all) | allowed (scope=super) |

- `<Can perm="…">` / `useRbac().can()` are unchanged in signature; they now reflect the real identity in live.
- Super-vs-country UI gating (Design Center, Campaign Center, cross-country data) additionally uses
  `authService.getAdminScope()` (real `admin_users` in live) — a second, independent server-sourced gate.

## Route / API permission coverage
- **UI routes/features:** gated by `<Can perm>` (35 permissions across 12 groups) + `isSuper` scope gate — now
  identity-driven in live.
- **API/data enforcement:** Supabase **RLS** on the tables (server-side; the authoritative layer). The client
  guard cannot be the enforcement boundary and is not relied on as such.

## Sandbox parity (preserved)
Sandbox RBAC (acting-role preview defaulting to `super_admin`, editable roles in `RbacCenter`) is byte-identical.
E2E admin journeys (login, super tabs, admin tabs render) **pass 24/24**.

## Residual work for production runtime sign-off (staging)
1. Seed `roles` / `user_roles` so `resolveHighestRole` + `getAdminScope` return intended values per test user;
   verify each of the 5 roles sees exactly its permitted surfaces and is denied others (allowed **and** denied
   paths).
2. Verify RLS policies actually enforce the same matrix server-side (the real boundary) — attempt denied reads/
   writes with each role's JWT.
3. **Known follow-up:** the RBAC **management console** (`RbacCenter` create/edit role → `role_permissions`) still
   persists to localStorage; wiring it to the DB is a separate task. It does not affect the runtime **guard**,
   which is now DB-identity-driven.

## Gate
Typecheck **0** · Build **✓** · Sandbox E2E **24/24**.
