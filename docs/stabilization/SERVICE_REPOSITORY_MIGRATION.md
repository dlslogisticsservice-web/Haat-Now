# Service → Repository Migration · Progress Report
**HaaT Now — Phase 2 continuation (post-boundary)**
Goal: complete the layered architecture by moving Supabase access out of **services** into **repositories** (`Services → Repositories → Supabase`). Executed one service per commit, each gated `tsc` → build → E2E (24/24) → commit → push. **Scope this pass: core high-traffic services** (per decision); low-traffic/admin services are a documented backlog.

## Completed (13 services → repositories, 19 repositories total)
| Service | Repository | Commit |
|---|---|---|
| release.service | settings.repository | `9a86526` |
| tracking.service | tracking.repository | `48fb658` |
| coupon.service | coupon.repository | `1e304e1` |
| loyalty.service | loyalty.repository | `69a9b71` |
| product.service | product.repository | `0c215cf` |
| customer.service | customer.repository | `1f4509e` |
| account.service | account.repository | `d4d0a79` |
| inventory.service | inventory.repository | `49e6f1b` |
| notification.service | notification.repository | `22e16f1` |
| wallet.service | wallet.repository | `e124118` |
| driver.service | driver.repository (extended) | `4db3fdf` |
| merchant.service | merchant.repository (extended) | `0fb95e5` |
| order.service | orders.repository (extended) | `b59aca2` |

Plus the S9 identity-type relocation (`e9df8dc`) and the S1–S8 repositories (catalog, orders, support, reviews, checkout, payments, merchant, driver, audit).

**Principle applied uniformly:** repositories hold thin, typed Supabase access only; **all business logic stays in the service** — e.g. order-create notifications + orphan-cleanup + status guards, driver TOCTOU-safe claim, wallet auto-create + delivery notification, loyalty insufficient-balance mapping, coupon deactivate, inventory stats. Behaviour is identical throughout (E2E 24/24 on every commit).

## Deferred backlog (23 services — low-traffic / admin / infra)
Not yet migrated (still import `lib/supabase` directly at the service layer; permitted by the architecture guard, which enforces the **feature** boundary):

`admin-crud`, `admin`, `analytics`, `auth`, `campaign`, `cart`, `checkout` (partial — S3 added repo-backed methods; legacy coupon/payment-method methods remain), `cx`, `finance`, `growth`, `growthb`, `merchant-settings`, `onboarding`, `ops/command`, `ops/dispatch`, `ops/payout`, `ops/performance`, `ops/shift`, `ops/vehicle`, `ops/zone`, `payment-orchestrator`, `storage`, `website`.

Recommended as a later gated pass (same one-service-per-commit discipline). `auth.service` and `storage.service` are foundational — migrate with extra care. The ops/* cluster can share an `ops.repository` set.

## Guarantees held this pass
- No feature removed, no UI changed, **no regression** (E2E 24/24 on all 13 commits).
- Backward compatible; each repository mirrors the exact prior query/RPC/channel.
- One service per commit; nothing merged to `main`.

## Net architecture status
- **Features:** 0 import `lib/supabase` (CI-enforced).
- **Services:** 13 core migrated behind repositories; 23 remain (deferred backlog above).
- **Repositories:** 19, the sole Supabase-access layer for everything migrated so far.
