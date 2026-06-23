# Super-Admin Permission Fix Report

**Date:** 2026-06-23
**Branch:** `feat/auth-recovery-frontend-sprint`
**Commit:** `4e254aa` (`4e254aa5208d789b4b32d5fac7799b75d524b382`)
**Files changed:** `src/services/auth.service.ts`, `src/features/admin/AdminDashboard.tsx`

---

## Symptom
`+201000000004` (EG country admin) and `+966500000004` (SA country admin) reached super-admin
surfaces (Design Center / Campaign Center). Only `+201000000005` should have super privileges.

## Audit findings

| Area | Finding |
|---|---|
| `admin_users.scope` (DB) | **Correct** — `0004`=country/EG, `9665…0004`=country/SA, `0005`=super. |
| RLS on `admin_users` | **Correct** — `(user_id = auth.uid()) OR (super OR same-country)`. Live RLS-simulated read returns the right scope for each admin. |
| Design Center render | Gated `activeTab==='design' && isSuper` — correct, but depends on `isSuper`. |
| Campaign Center render | Gated `activeTab==='campaigns' && isSuper` — correct, but depends on `isSuper`. |
| Nav tab injection | `isSuper ? [...campaigns, design] : items` — correct, but depends on `isSuper`. |
| **`isSuper()` resolution** | **DEFECTIVE** — root cause (below). |
| **`SANDBOX` flag** | **DEFECTIVE** — mode inconsistency (below). |

## Root cause

`isSuper` was resolved by a fragile, mode-inconsistent path in `AdminDashboard.tsx`:

```ts
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';   // ← missing "&& import.meta.env.DEV"
...
if (SANDBOX) { setIsSuper(adminId.startsWith('55555555')); return; }   // ← brittle UUID-prefix hack
supabase.from('admin_users').select('scope').eq('user_id', adminId).maybeSingle()
  .then(({ data }) => setIsSuper((data as any)?.scope === 'super'));
```

1. **Mode inconsistency.** `auth.service.IS_SANDBOX` is `VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV`, but `AdminDashboard.SANDBOX` omitted the `&& import.meta.env.DEV` guard. In a build where `VITE_AUTH_MODE=sandbox`, the **auth layer ran the real path** (real auth UUIDs) while **AdminDashboard took the sandbox branch** — so `isSuper` was resolved by the wrong code path.
2. **Brittle prefix hack.** The sandbox branch decided super via `adminId.startsWith('55555555')` — a hardcoded UUID prefix, not the authoritative `scope`. Run against real UUIDs (from the mismatched mode), this check is meaningless and `isSuper` becomes unreliable/incorrect, allowing the super-only tabs to mis-render for non-super admins.

The database and RLS were never at fault; the **client-side gate** was.

## Exact code fix

**1. New authoritative, mode-consistent scope resolver** — `src/services/auth.service.ts`:
```ts
async getAdminScope(userId: string): Promise<'super' | 'country' | null> {
  if (IS_SANDBOX) {
    const acct = Object.values(DEMO_ACCOUNTS).find(a => a.id === userId);
    if (!acct || acct.role !== 'admin') return null;
    return acct.scope === 'super' ? 'super' : 'country';
  }
  const { data, error } = await supabase
    .from('admin_users').select('scope').eq('user_id', userId).maybeSingle();
  if (error) { console.error(`[auth] getAdminScope: query failed for user ${userId} — denying super scope.`, error); return null; }
  const scope = (data as { scope?: string } | null)?.scope;
  return scope === 'super' ? 'super' : scope === 'country' ? 'country' : null;
}
```

**2. `AdminDashboard.tsx`** — gate from the authoritative scope; remove the prefix hack; align `SANDBOX`:
```ts
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' && import.meta.env.DEV; // consistent with auth.service
...
const [isSuper, setIsSuper] = useState(false);
useEffect(() => {
  let alive = true;
  authService.getAdminScope(adminId)
    .then(scope => { if (alive) setIsSuper(scope === 'super'); })
    .catch(() => { if (alive) setIsSuper(false); });
  return () => { alive = false; };
}, [adminId]);
```

Now `isSuper ⟺ scope === 'super'` in **every** mode (sandbox reads `DEMO_ACCOUNTS.scope`; production reads `admin_users.scope`), and it defaults to **false** on any error.

## Requirement compliance

| Requirement | Status |
|---|---|
| 1. Only `scope='super'` may access Design Center / Campaign Center / global settings / cross-country | ✅ `isSuper` is the sole gate for nav injection *and* render; true only when `scope==='super'`. |
| 2. Country admins must NOT see Design Center / Campaign Center / global settings | ✅ `scope='country'` → `isSuper=false` → tabs neither injected nor rendered. |
| 3. Verify using live DB accounts | ✅ below. |
| 4. Build | ✅ passes. |
| 5. Commit | ✅ `4e254aa`. |
| 6. Push | ✅ pushed. |

## Live verification (RLS-simulated, exactly what each admin's session reads)

| Phone | Auth id | `admin_users.scope` | `isSuper` | Design/Campaign visible |
|---|---|---|---|---|
| +201000000004 (EG) | dfb6dbf0… | country | **false** | ❌ no |
| +966500000004 (SA) | 5622d5ff… | country | **false** | ❌ no |
| +201000000005 (super) | 353e1df3… | super | **true** | ✅ yes |

Sandbox path is equally correct (`DEMO_ACCOUNTS.scope`: `0004`=country, `9665…0004`=country, `0005`=super).

## Country isolation
Cross-country data isolation is enforced server-side by RLS (`admin_users` policy
`(user_id = auth.uid()) OR (super OR country_code = auth_admin_country())` plus the
`order_country_code` `SECURITY DEFINER` scoping). EG admin sees EG only, SA admin sees SA only,
super sees all — unchanged and independently verified. This fix ensures the **UI gate** matches
that server-side authority.

## Build status
- `npx tsc --noEmit` (app `src`): clean (only pre-existing Deno edge-function files, excluded from the app build).
- `npm run build`: ✅ passes (~8.4s).

## Commit & push
- Commit: `4e254aa` — `fix(auth): authoritative super-admin gating (country admins are not super)`
- Push: ✅ `a722519..4e254aa` → `origin/feat/auth-recovery-frontend-sprint`; remote HEAD == local HEAD (0/0).
