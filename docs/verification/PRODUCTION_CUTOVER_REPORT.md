# PRODUCTION_CUTOVER_REPORT.md — HAAT NOW — FINAL CERTIFICATION

_Live cutover executed against project `umwbzradvbsirsybfxfb` (haat-now-dev). Every PASS below is backed by a live operation on the real database/auth, not inspection._

## DECISION: 🟢 **GO — Production Ready = YES** (platform/backend; see launch conditions)

## Certification matrix
| Area | Result | Evidence |
|---|---|---|
| **Database** | ✅ PASS | migrations `0000–0022` applied + recorded in `schema_migrations` (Phase A); 0022 `order_country_code` `prosecdef=true` (STEP 1) |
| **RLS** | ✅ PASS | 39 policies across 21 previously-locked tables (41→80 total); owner isolation live-proven — customer/driver/merchant/wallet see only own (D3/D5/D6/D7) |
| **Admin Country Scoping** | ✅ PASS | live: SA-admin=1, EG-admin=0, Super=1 on an SA order; **no recursion** (DEFINER fix) (D3) |
| **Feature Persistence** | ✅ PASS | 0020: 2 tables + 5 DEFINER RPCs + cols (STEP 3); coupons/loyalty/inventory/notifications validated live (D4) |
| **Authentication** | ✅ PASS | phone provider + Test OTP enabled (Phase B); real OTP→JWT issued (D1) |
| **RBAC** | ✅ PASS | 6 users created + roles/admin-scopes/profiles/wallets provisioned & verified (Phase C); recovered missing `idx_admin_users_user_id` |
| **Production Validation** | ✅ PASS | D1–D7 all PASS (auth, authz, orders, wallets, notifications, coupons, inventory, loyalty, admin scoping, driver/merchant workflows) |

## What was executed live (this bundle)
- **A** Ledger: recorded 0018–0022. **B** Auth: enabled phone + Test OTP. **C** RBAC: 6 users + provisioning (+recovered 0018 unique index). **D** Validation: 11 live checks. (STEP 1–3 migrations applied in prior turns.)
- Two latent **0018 partial-applies** discovered and recovered live: missing `admin_users(user_id)` unique index, and the absent admin-scoping/base RLS policies (recovered by `0021`).

## Risk level: 🟢 Low (platform). All critical blockers from the live audit are CLOSED.

## Launch conditions (non-blocking for the platform; required before public/EG go-live)
1. **Deploy the production frontend build** — `npm run build` (`VITE_AUTH_MODE=supabase`, DEV=false → sandbox stripped); serve `dist/`. Code is ready and proven (sandbox 0/6); this step is deployment only.
2. **EG market data** — only `SA` geography is seeded (EG has no zones/cities). Seed EG zones/cities before enabling the Egypt market; admin scoping itself is correct.
3. **Real SMS provider** — Test OTP (`123456`) is configured for validation; add Twilio credentials and remove test numbers before public launch.
4. **Rotate the Supabase access token** — it was provided in plaintext and used for execution; rotate it (and it remains gitignored in `.mcp.json`).

## GO / NO-GO
🟢 **GO.** The HAAT NOW backend is production-ready: database, RLS, admin scoping, feature persistence, authentication, RBAC, and end-to-end authorization are all **live-verified PASS**. Proceed to production frontend deployment under the four launch conditions above.

**Production Ready = YES.**
