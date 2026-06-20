# RBAC_AUDIT.md

## Routing (app layer — verified at runtime)
`App.tsx` routes by `session.role`:
| Role | Portal | Runtime verified |
|---|---|---|
| customer | Customer app | ✅ (Customer EG/SA login → customer) |
| merchant | `MerchantApp` | ✅ (Merchant EG/SA → merchant) |
| driver | `DriverApp` | ✅ (Driver EG/SA → driver) |
| admin (super/country) | `AdminDashboard` | ✅ (Egypt/Saudi/Super admin → admin) |

All 9 demo accounts route to the correct portal (see `AUTH_VERIFICATION.md`, 9/9 PASS).

## Role resolution
- **Sandbox:** `DEMO_ACCOUNTS` map → role + country + admin scope (`super`/`country`).
- **Supabase:** `resolveHighestRole()` → `user_roles → roles` (priority admin>merchant>driver>customer).

## DB-side authorization (verified live via REST; scoping enforced in DB)
| Control | State |
|---|---|
| anon blocked on owner/sensitive tables | ✅ all return 42501 |
| RLS policies defined (customer own orders/cart/wallet/addresses; driver own profile/deliveries; merchant own branches/products) | ✅ present in migrations 0001/0004/0007 |
| Super vs Country admin (`admin_users.scope/country_code`, `auth_is_admin/scope/country`, `order_country_code`) | ✅ deployed (migration 0018 — probed live: `auth_is_admin()` returns, columns exist) |
| Country-scoped order policy (`Admins read orders by scope`) | ⚠ present but `order_country_code` is SECURITY INVOKER → **RLS recursion risk** when an admin reads orders. Fix = make it `SECURITY DEFINER` (surgical SQL provided in prior `0020`/audit; DB-only, not applied here per "no migrations" constraint this sprint). |
| `authenticated`-role table GRANTs | ⚠ unverifiable via anon; required so logged-in users aren't blocked (migration `0019`). Not applied by me (no DB credentials). |

## Scope intent
- **Super Admin** → all countries (scope `super`).
- **Country Admin** → own country only (scope `country` + `country_code`, enforced by `order_country_code = auth_admin_country()`).
- **Merchant** → own stores (`merchant_id = auth.uid()`).
- **Driver** → own deliveries (`driver_id = auth.uid()`).
- **Customer** → own orders/cart/wallet (`auth.uid()` ownership).

## Status
- App routing & role resolution: ✅ verified (9/9).
- DB RBAC: ✅ defined/deployed; two DB-side actions outstanding (recursion fix + `authenticated` grants) — require Supabase access I don't have. Not code changes.
