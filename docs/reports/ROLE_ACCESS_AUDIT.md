# Role Access Audit

**Date:** 2026-06-23
**Verified against:** live DB (Supabase `umwbzradvbsirsybfxfb`) + real-browser run (see
`POST_DEPLOY_VERIFICATION_REPORT.md`).

---

## Routing chain
1. `authService.verifyOtp` → role from `resolveHighestRole(userId)` (fetch **all** `user_roles`, pick
   max `roles.priority` **client-side** — fixed in `1710bb5`; no longer relies on PostgREST embedded
   ordering).
2. `App.tsx` routes purely on `session.role`: `customer`→Customer App, `merchant`→Merchant Portal,
   `driver`→Driver Portal, `admin`→Admin Dashboard.
3. Super gate inside `AdminDashboard`: `isSuper = (authService.getAdminScope(adminId) === 'super')`
   — single mode-consistent source (`DEMO_ACCOUNTS.scope` in sandbox / `admin_users.scope` in
   prod), fixed in `4e254aa`. Design Center, Campaign Center are gated by `isSuper` for **both** nav
   injection and render.

## Required mappings — verified

| Phone | Expected | Resolved role | Scope | Destination | Admin menus (Design/Campaign) |
|---|---|---|---|---|---|
| `+201000000005` | **Super Admin** | admin | **super** | Admin Dashboard | ✅ visible |
| `+201000000004` | **Country Admin (EG)** | admin | country (EG) | Admin Dashboard | ❌ hidden |
| `+966500000004` | Country Admin (SA) | admin | country (SA) | Admin Dashboard | ❌ hidden |
| `+201000000001` | **Customer** | customer | — | Customer App | n/a (no admin) |

**Evidence:**
- Live `user_roles` (highest priority): `0005`→admin, `0004`→admin, `0001`→customer.
- Live `admin_users.scope` (RLS-simulated as the user): `0005`=super, `0004`=country/EG, `9665…0004`=country/SA.
- Real-browser run: super admin's nav shows مركز التصميم + الحملات; country admins' nav shows neither
  (screenshots `admin_201000000005.png`, `admin_201000000004.png`, `admin_966500000004.png`).

## Route guards & permissions
- **Role guard:** `App.tsx` renders exactly one portal by `session.role`; no fall-through that could
  expose a portal to the wrong role. Unknown/empty role → `customer` (safe default).
- **Super guard:** Design Center / Campaign Center render is `activeTab === … && isSuper`. A country
  admin cannot reach them — the tabs are not injected into the nav **and** the render is gated, so even
  a manual `activeTab` cannot mount them.
- **Country isolation (data):** enforced server-side by RLS (`admin_users` policy
  `(user_id = auth.uid()) OR (super OR country_code = auth_admin_country())` + `order_country_code`
  `SECURITY DEFINER`). EG admin sees EG, SA admin sees SA, super sees all.

## Verdict
✅ All three required mappings hold. Route guards, super gating, and hidden admin menus verified at the
data layer (live DB) and the UI layer (real browser). No code change required in this task.
