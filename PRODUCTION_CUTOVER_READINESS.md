# PRODUCTION_CUTOVER_READINESS.md — Phase 3 (read-only)

Live readiness verdict for project `umwbzradvbsirsybfxfb` (haat-now-dev), from read-only Management API evidence.

## Migrations
| Migration | Recorded? | Functionally applied? | Result |
|---|---|---|---|
| **0018** admin country scoping | ❌ not in `schema_migrations` | **PARTIAL** — functions + `admin_users` cols ✅; **RLS policies (orders scoping, admin roster) MISSING** ❌ | ❌ **FAIL** |
| **0019** authenticated grants | ❌ not recorded | **YES** — grants present on core tables | ⚠️ applied-but-**ineffective** (RLS denies rows; see Phase 2 #9) |
| **0020** feature persistence | ❌ not recorded | **NO** — `loyalty_transactions`/`stock_movements` absent; products stock cols absent; coupons has only `is_active`/`start_date`/`end_date` (not `max_uses/used_count/expires_at/country_code`); `order_country_code` still INVOKER | ❌ **FAIL** |

## Authentication
| Item | Result | Evidence (`/config/auth`) |
|---|---|---|
| Phone provider | ❌ **FAIL** | `external_phone_enabled = false` (`sms_provider=twilio` configured but disabled; `sms_test_otp=null`) |
| Email provider | ⚠️ | `external_email_enabled=true`, `mailer_autoconfirm=false` (confirmation required) |
| Anonymous | off | `external_anonymous_users_enabled=false` |
| **Real authentication ready** | ❌ **FAIL** | no enabled provider yields a session for the demo phones |

## Role readiness (all require: auth.users row → user_roles → RLS access)
`auth.users=0`, `user_roles=0`, `admin_users=0`, demo phones present = **none**. Therefore:
| Role | auth.user | role mapping | scope/profile | RLS access | Result |
|---|---|---|---|---|---|
| Customer (+201000000001) | ❌ none | ❌ | ❌ no `customers` row | ❌ orders/wallet/notifs locked | ❌ NOT READY |
| Merchant (+201000000002) | ❌ | ❌ | ❌ demo merchant absent | partial (catalog ok, orders locked) | ❌ NOT READY |
| Driver (+201000000003) | ❌ | ❌ | ❌ no `drivers` row (table locked) | ❌ | ❌ NOT READY |
| Egypt Admin (+201000000004) | ❌ | ❌ | ❌ no `admin_users` row + 0018 policy missing | ❌ | ❌ NOT READY |
| Saudi Admin (+966500000004) | ❌ | ❌ | ❌ | ❌ | ❌ NOT READY |
| Super Admin (+201000000005) | ❌ | ❌ | ❌ | ❌ | ❌ NOT READY |

## Overall verdict: 🔴 **NOT READY for Production Cutover**
Blockers, in priority order (all evidence-backed, read-only):
1. 🔴 **RLS policy gap** (new, most severe) — `orders/order_items/wallets/wallet_transactions/notifications/reviews/favorites/drivers/admin_users/coupons` + others: RLS enabled, **0 policies** → authenticated users locked out. Requires `CREATE POLICY` DDL (incl. 0018's admin-orders scoping). **Not covered by 0018/0019/0020 as currently understood.**
2. 🔴 **0020 not applied** — loyalty/inventory/coupon tables, columns, and 5 RPCs absent → those services error.
3. 🔴 **`order_country_code` prosecdef=false** — admin order reads recurse.
4. 🔴 **Phone provider disabled** — no real login path.
5. 🔴 **No RBAC data** — 0 auth users / 0 role rows / 0 admins; 6 demo accounts unprovisioned.
6. 🟠 **Migration ledger drift** — 0018/0019/0020 not recorded in `schema_migrations`.

## Required writes are BLOCKED by the rules (stop + explain)
Every remaining fix is a **write/DDL** operation, which this sprint forbids:
- Create RLS policies (DDL) · apply 0020 (DDL) · `order_country_code` → DEFINER (DDL) · enable phone provider (auth config write) · provision users/roles (DML). **I stopped and did not perform any of these.**
The executable SQL for items 2–5 already exists in `FINAL_CUTOVER_RUNBOOK.md` / `FINAL_PRODUCTION_EXECUTION_REPORT.md`; **item 1 (RLS policies) is a newly-discovered prerequisite** that must be added to the cutover before go-live.
