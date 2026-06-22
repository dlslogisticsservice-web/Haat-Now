# ADMIN_USERS_VERIFICATION.md — Independent (live, read-only)

Fresh query of `public.admin_users` joined to `auth.users`.

## Evidence
| Phone | user_id | scope | country_code | email |
|---|---|---|---|---|
| 201000000005 | ✅ populated | `super` | `null` (correct for super) | super@haatnow.com |
| 201000000004 | ✅ populated | `country` | `EG` | eg-admin@haatnow.com |
| 966500000004 | ✅ populated | `country` | `SA` | sa-admin@haatnow.com |

`select count(*) from admin_users` = 3.

## Verification
| Check | Result |
|---|---|
| Super Admin exists | ✅ PASS (scope=super) |
| Egypt Admin exists | ✅ PASS (scope=country, EG) |
| Saudi Admin exists | ✅ PASS (scope=country, SA) |
| `user_id` populated (3/3) | ✅ PASS |
| `scope` populated (3/3) | ✅ PASS |
| `country_code` populated | ✅ PASS (EG/SA; super correctly `null`) |

**ADMIN USERS = ✅ PASS.**
