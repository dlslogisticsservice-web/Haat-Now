# RBAC_VERIFICATION.md — Independent (live, read-only)

Fresh query of `roles`, `user_roles`, `admin_users`.

## Evidence
- `roles` seeded: `customer, driver, merchant, admin` (priority order).
- Effective role per provisioned user (highest-priority via `resolveHighestRole` logic):

| Phone | Effective role | role rows |
|---|---|---|
| 201000000001 | **customer** | 1 |
| 201000000002 | **merchant** | 2 (base customer + merchant) |
| 201000000003 | **driver** | 2 |
| 201000000004 | **admin** (EG) | 2 |
| 966500000004 | **admin** (SA) | 2 |
| 201000000005 | **admin** (super) | 2 |

- `admin_users` = 3 (super/null, country/EG, country/SA — see ADMIN_USERS_VERIFICATION).

## Verification
| Role | Result |
|---|---|
| Customer role | ✅ PASS |
| Driver role | ✅ PASS |
| Merchant role | ✅ PASS |
| Egypt Admin role | ✅ PASS (admin + admin_users country/EG) |
| Saudi Admin role | ✅ PASS (admin + admin_users country/SA) |
| Super Admin role | ✅ PASS (admin + admin_users super) |

**Notes:** every user also holds the permanent base `customer` role (migration 0006 auto-assigns on creation); `resolveHighestRole()` resolves each to its highest-priority role. This is by design and does not affect authorization (admin/merchant/driver outrank customer).

**RBAC = ✅ PASS.**
