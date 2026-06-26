# Finance Module Report — HAAT NOW

Strike-team target: the **Finance module only**. Status: **CLOSED** for localization — every
FinanceCenter UI string flips AR↔EN live with RTL↔LTR.

## Files
- `FinanceCenter.tsx` — the entire Finance module (no separate FinancialDashboard/Payments/Wallet
  files exist; Finance is this one file with 5 panels). Top component + RevenuePanel were already
  localized (header, tabs, MetricCards). **This sprint closed the remaining 4 panels.**

## Pages / panels localized this sprint
- **SettlementsPanel** — date range labels, Settle merchants/drivers, pending merchant/driver
  payables (Net/commission/incentives/penalties), settlement run history, run-type labels, empty
  states.
- **CompensationPanel** — issue-compensation form (entity-type options customer/merchant/driver,
  amount, entity ID, reason), validation toast, Issue button.
- **RefundsPanel** — empty state.
- **ExportsPanel** — date labels, row count, generated-date locale.

## Tables (STEP 2)
- Finance has **no HTML `<table>`** — panels are `Card`/list layouts + the RevenuePanel uses
  `MetricCard` grid. Nothing to migrate to AdminDataTable. (0 HTML tables.)

## Components used (STEP 1, all existing — no new infra)
- WorkspaceHeader, MetricCard (RevenuePanel), Card, Button, Badge, EmptyState, toast, confirmDialog
  (available). The 5 panels render under the FinanceCenter tab shell with dynamic `dir`.

## Localization coverage
- **Finance module: 100%** of UI strings localized (tabs, titles, buttons, placeholders, option
  labels, empty states, validation/error toasts). Remaining `[؀-ۿ]` matches are exclusively the
  bilingual TABS `ar:` definitions (rendered via `L(t.ar,t.en)`) and DB data (business_name,
  full_name, currency code).

## Currency / formatting (STEP 4)
- Amounts use the shared `money()` formatter (locale-stable numerics); currency code shown from data
  (`r.currency` in refunds). Country/currency context flows from `useAppConfig` at the FinanceCenter
  level. Numerics are language-neutral.

## Status badges (STEP 5)
- All statuses render via the shared `Badge` component with consistent success/error/secondary
  variants (paid → success, failed → error, pending/other → secondary).

## Verification (screenshot 23-finance-settlements-en.png)
- `finance_center` in English + LTR. Probe: English present = true, **Arabic leftover = false**,
  0 page errors. Visible: Finance Center header, tabs (Revenue/Settlements/Compensation/Refunds/
  Accounting export), date range, Settle merchants/drivers, Pending merchant/driver payables,
  Settlement run history.

## Validation
- TypeScript ✅ · ESLint ✅ · Build ✅ · E2E 24/24 ✅

## Remaining (outside this strike scope)
- Other admin modules (AdminDashboard tabs, CampaignCenter, DesignCenter, ExperienceBuilder,
  OperationsCommandCenter labels) still have hardcoded Arabic — not part of this Finance mission.
