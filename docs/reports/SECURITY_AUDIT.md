# Security Audit — HAAT NOW

**Date:** 2026-06-24 · **Branch:** `feat/auth-recovery-frontend-sprint`
**Method:** static code review + live Supabase RLS/grant queries (project `umwbzradvbsirsybfxfb`).

---

## Summary
| Area | Status |
|---|---|
| Authentication | ✅ sound |
| Authorization (roles/scope) | ✅ sound |
| RLS policies | ✅ all tables RLS-enabled; 3 over-permissive write policies **fixed** |
| Supabase permissions | ✅ client anon-only; service_role server-side only |
| API endpoints (edge functions) | ✅ service_role via `Deno.env`, never in browser |
| XSS | ✅ no `dangerouslySetInnerHTML`/`innerHTML`/`eval` |
| CSRF | ✅ not applicable (Bearer-token auth, no cookie sessions) |
| IDOR | ✅ RLS owner-scoped; cross-order payment insert **fixed** |
| Sensitive data exposure | ✅ no secret logging; secrets gitignored |

**Net: 0 Critical, 0 High outstanding** (1 Critical + 2 High found and fixed; see `CRITICAL_SECURITY.md`,
`HIGH_SECURITY.md`).

## 1. Authentication
- Supabase phone OTP. Sandbox/demo path is gated on `import.meta.env.VITE_AUTH_MODE==='sandbox' && import.meta.env.DEV`; `DEV` is `false` in any production build, so demo accounts + OTP `123456` and the entire sandbox branch are **tree-shaken out** of production.
- Highest-priority role resolved from `user_roles ⋈ roles` (client-side max-priority, deterministic).
- `onAuthStateChange` keeps the session authoritative; `SIGNED_OUT`/null session → logout; Supabase-js auto-refreshes the JWT. No fake/forged session is persisted in production.

## 2. Authorization
- **RLS-based.** Every `public` table has RLS **enabled** (live check: 0 tables with RLS disabled, 0 tables with RLS enabled but no policy).
- **Admin scope:** super vs country resolved from `admin_users.scope` via `authService.getAdminScope` (single source of truth). Design Center / Campaign Center gated on `isSuper` for **both** nav injection and render.
- **Country isolation:** enforced server-side by RLS (`admin_users` policy + `order_country_code` `SECURITY DEFINER`). EG admin → EG only, SA → SA only, super → all (independently verified).

## 3. RLS policies (live audit)
- 0 tables with RLS disabled; 0 policy-less tables.
- **Over-permissive write policies found:** 5. **Fixed 3** (Critical+High):
  - `app_config` `ALL using(true)` → **super-admin write only** (Critical).
  - `payment_transactions` `INSERT with_check(true)` → **own-order only** (High/IDOR).
  - `support_messages` `INSERT with_check(true)` → **`sender_id = auth.uid()`** (High/impersonation).
  - Remaining (Medium, see `MEDIUM_SECURITY.md`): `order_status_history` (audit log), `campaign_events` (analytics).

## 4. Supabase permissions
- **Client** (`src/lib/supabase.ts`) uses **only the anon key**. No `service_role` reference anywhere in `src/`.
- **Edge functions** read `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — server-side only, never shipped to the browser; comments explicitly warn against exposure.
- **anon SELECT** is limited to the public storefront catalog (`products`, `product_variants`, `product_images`, `merchants`, `merchant_branches`, `categories`, `offers`, `banners`, `campaigns`, `zones`, `design_settings`) — public by design for browsing. No customer/order/wallet/payment table is anon-readable.

## 5. API endpoints
- Payment edge functions (`payment-initiate/verify/refund/webhook`) run with `service_role` server-side; the **authoritative** payment status is webhook/verify-driven, not client-trusted. Clients call them with their user JWT (`Authorization: Bearer`).

## 6. XSS
- No `dangerouslySetInnerHTML`, `.innerHTML`, `eval`, or `new Function` in the codebase. React auto-escapes all interpolated content. ✅

## 7. CSRF
- Supabase auth uses **Bearer tokens in the `Authorization` header** (not ambient cookies), so classic CSRF does not apply — a forged cross-site request cannot attach the user's token. ✅

## 8. IDOR
- Data access is RLS-scoped to the owner (`auth.uid()`). The one cross-tenant write gap (`payment_transactions` for any order) was **fixed** (own-order `with_check`). `support_messages` impersonation fixed (`sender_id = auth.uid()`).

## 9. Sensitive data exposure
- No `console.*` logging of tokens/passwords/keys (grep-verified).
- The **anon key** is public by design (RLS enforces access). `.env*` and `.mcp.json` (Supabase management token) are **gitignored**; the management token is **not** present in any tracked file.

## Operational recommendations (not code vulnerabilities)
- **Rotate the Supabase management access token** (`sbp_…`) used by dev/migration scripts before go-live — it has been used locally and lives in `.mcp.json`.
- Wire the `ErrorBoundary` `onError` hook and edge-function logs to a monitoring service (Sentry/Logflare).
- Confirm Supabase Auth rate-limits (OTP send/verify) are enabled in the dashboard.
