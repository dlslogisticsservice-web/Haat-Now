# Phase E2 — Finance Engine — Completion Report

**Date:** 2026-06-24 · Enterprise finance layer on a **double-entry ledger** (source of truth), with
commission + settlement engines, driver adjustments, compensation, and accounting exports.
Production-grade: balanced postings, idempotent transactions, audit via the immutable ledger, RLS.
Applied live + verified. Commits: `6de2ad7` (DB) · `7e9cfe8` (services) · `71d60b7` (UI).

---

## Double-entry model
Account convention: **assets/expenses debit-normal; liabilities (merchant/driver payable) and revenue
credit-normal** → `balance = Σcredit − Σdebit`. Every money event is a balanced transaction posted via
`post_ledger(txn_id, type, lines)` which **rejects unbalanced postings** (`Σdebit ≠ Σcredit`) and is
**idempotent on `txn_id`**.

| Flow | Debit | Credit |
|---|---|---|
| Order commission (gross G, commission C, net N) | platform_cash **G** | merchant_payable **N** + platform_revenue **C** |
| Driver incentive/bonus (A) | platform_expense **A** | driver_payable **A** |
| Driver penalty (A) | driver_payable **A** | platform_revenue **A** |
| Merchant settlement paid (N) | merchant_payable **N** | platform_cash **N** |
| Driver settlement paid (N) | driver_payable **N** | platform_cash **N** |
| Compensation (A) | platform_expense **A** | <entity>_payable **A** |

## What was delivered

### M1 — Database (`20260614000031_finance_engine.sql`, applied live + recorded)
**9 tables (all requested + supporting):** `ledger_entries` (journal), `commission_rules`
(global/merchant/category, percent/flat, priority resolution), `commissions` (per-order, **unique on
order_id**), `driver_adjustments` (incentive/bonus/penalty), `settlements` (run), `merchant_settlements`,
`driver_settlements`, `compensations`, `accounting_exports`. Default **15% global** commission rule seeded.

**Engines (SECURITY DEFINER, admin-gated, all post to the ledger):**
`post_ledger` · `fin_balance` · `resolve_commission_rule` · `capture_order_commission` (idempotent) ·
`add_driver_adjustment` · `generate_merchant_settlement` (aggregates unsettled commissions, marks them
settled) · `pay_merchant_settlement` (idempotent) · `generate_driver_settlement` (earnings + adjustments) ·
`pay_driver_settlement` · `issue_compensation` · `generate_accounting_export`.

**RLS:** ledger/rules/settlement-runs/exports/compensations = admin-only; per-entity finance
(commissions, merchant/driver settlements, driver adjustments) = owner reads own + admin all; all writes
via DEFINER RPCs. `authenticated` grants added.

### M2 — Services (`src/services/finance.service.ts`)
revenueDashboard, captureCommission, commission-rules CRUD, settlement engine (runs, generate/pay
merchant+driver, pending lists), driver adjustments, compensation (issue/list), refunds list, accounting
exports (generate/list), merchant/driver self-statements.

### M3 — UI — Admin Finance Center (new "المركز المالي" tab in OperationsCenter)
**Revenue dashboard** (platform revenue/cash, merchant+driver payable, commission total, order count) ·
**Settlements** (date-range generate merchant/driver runs, pending-payout list with pay button, run
history) · **Compensation** (issue + list) · **Refunds** (list) · **Accounting Exports** (generate
revenue/commission/settlement/ledger + history).

## Verification (live, evidence — test rows cleaned up)
Order total **200**, default 15% commission:
| Check | Result |
|---|---|
| `capture_order_commission` | commission **30**, net **170** ✅ |
| ledger transaction balanced | Σdebit = Σcredit = **200** ✅ |
| `merchant_payable` balance | **170** ✅ |
| `platform_revenue` balance | **30** ✅ |
| **idempotent re-capture** | still 1 commission row, revenue still 30 (no double-post) ✅ |
| driver incentive +20 / penalty 10 | `driver_payable` = **+10** ✅ |
| `generate_merchant_settlement` | net_payable **170** ✅ |
| `pay_merchant_settlement` | `merchant_payable` → **0** ✅ |
| **GLOBAL ledger invariant** | Σdebit − Σcredit = **0.00** ✅ |
| accounting export (commission) | 1 row, total 30 ✅ |
| RLS negative | non-admin `generate_merchant_settlement` → **BLOCKED** "not authorised" ✅ |

Build ✅ · Lint ✅ · E2E 24/24 ✅ (no regression).

## Honest scope notes (not inflated)
- **`capture_order_commission` is not yet auto-invoked** on delivery completion — it's a callable RPC
  (and admin/UI can trigger it). Wiring it into the order-completion path (or a trigger on
  `orders.status='delivered'`) is a one-line fast-follow so commissions capture automatically.
- **Merchant wallet/balance is derived from the ledger** (`merchant_payable`), not the legacy `wallets`
  table — this is the correct double-entry source of truth, but the older `wallets`/`adjust_wallet_balance`
  path still exists for the customer side and is not reconciled into the ledger.
- **Driver settlement vs. ad-hoc payout:** settlements only include `driver_earnings` not already paid via
  the E1 payout flow (`payout_status<>'paid'` + `settlement_id is null`) to prevent double-pay — but the
  two payout mechanisms now coexist; pick one as canonical operationally.
- **Settlement scheduler is manual/RPC**, not automated — `generate_*_settlement` is admin-triggered (date
  range). Automating it needs `pg_cron` (e.g., weekly) — a small fast-follow.
- **Accounting export produces summary metadata** (type, period, row_count, total) recorded in
  `accounting_exports`; a downloadable CSV/ledger file generator is not yet built (the data is queryable).
- Commission rules support global/merchant/category + percent/flat + priority; **no admin CRUD screen** for
  rules yet (managed via service/DB) — the engine and resolution are live.

## Result
A real **double-entry finance engine** is live: commission capture, merchant & driver settlement runs +
payouts, driver incentives/bonuses/penalties, compensation, and accounting exports — all balanced,
idempotent, RLS-protected, with the ledger as an immutable audit trail. The global ledger invariant
(Σdebit = Σcredit) holds. Remaining work is **wiring** (auto-capture on delivery, settlement cron, CSV
export, rules-CRUD UI), not core engine logic.
