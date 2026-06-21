# RBAC_EXECUTION_REPORT.md — Phase C

Created the 6 auth users (Auth admin API, service_role fetched via Management API) and provisioned RBAC (PRECHECK → PROVISION → VERIFY). Idempotent; live.

## Users created (phone → auth uid)
| Phone | Role | auth uid |
|---|---|---|
| +201000000001 | Customer | `080b74ea-04b0-434e-92d8-e53f84e791d4` |
| +201000000002 | Merchant | `2fff279b-b9fc-46e7-88a2-4df8f9832cd0` |
| +201000000003 | Driver | `3f957037-fd74-43eb-a789-e6e3bb731ae1` |
| +201000000004 | Egypt Admin | `dfb6dbf0-4c70-4da8-aabe-52ab17024d84` |
| +966500000004 | Saudi Admin | `5622d5ff-717e-4d39-96d0-423637f6732c` |
| +201000000005 | Super Admin | `353e1df3-b337-4a53-b0a0-2f822dc9e177` |

## Recovery during provisioning
PRECHECK surfaced a second **0018 partial-apply**: the unique index `idx_admin_users_user_id` on `admin_users(user_id)` never landed (table had only PK on `id` + unique on `email`), so `on conflict (user_id)` failed (`42P10`). **Fixed:** created `create unique index if not exists idx_admin_users_user_id on admin_users(user_id)` (completes 0018), then provisioning succeeded.

## VERIFY — ✅ PASS
| Check | Expected | Actual | Result |
|---|---|---|---|
| Effective roles | customer/merchant/driver/admin×3 | exactly that (per `auth.users.phone`) | ✅ |
| `admin_users` scopes | super/null · country/EG · country/SA | +201…004 → country/EG · +966…004 → country/SA · +201…005 → super/null | ✅ |
| Profiles | customer 1, driver 1, merchant 1, branch 1 | all 1 | ✅ |
| Wallets | customer + driver, no dups | cust 250, drv 80, `dup_wallets=0` | ✅ |
| `auth.users` provisioned | 6 | 6 | ✅ |
| Permissions/scopes/country | per role | correct | ✅ |

**Note:** every user also carries the permanent base `customer` role (migration 0006 auto-assigns it on user creation); `resolveHighestRole()` resolves each to its highest-priority role (admin > merchant > driver > customer). Total `user_roles` rows = 11 (6 base + 5 role-specific) — by design.

**Phase C = PASS.** All six roles provisioned with correct role mappings, admin scopes, country assignments, profiles, and wallets.
