# Merchant Portal Improvement — Report

Improved the **existing** Merchant Portal in place (no redesign / no new architecture). I audited every
area against the real rendered UI (screenshots), found the **biggest real gap** (a Reports tab with **no
charts**) and a **revenue `NaN` bug**, and fixed both with real, verified implementations.

## 🎯 Headline — real Reports/analytics dashboard (was: no charts)
The "تقارير الأرباح / Earnings" tab had KPI cards + a payout box + an accounting FAQ — **but none of the
analytics the brief asks for**. Added `MerchantReports` (pure-SVG, no chart lib), all computed from the
merchant's **real orders** (no mock data):
| Chart | Source data |
|---|---|
| **Sales — last 7 days** (revenue bar chart, weekday labels) | `orders.created_at` × `total_amount` |
| **Peak hours** (24-bucket histogram, peak hour highlighted) | `orders.created_at` hour |
| **Best customers** (top-5 by spend, horizontal bars) | `orders.customers.full_name` × `total_amount` |
| **Status mix** (stacked bar + legend) + **Delivery performance** (completion %) | `orders.status` |
| KPI strip: total orders · completion rate · 7-day revenue · peak hour | derived |

Each section renders an **honest empty state** when it has no data. **Verified**: 10 SVG charts render,
all four sections present, no NaN (`reportsRendered / salesTrend / peak / best / status` all true), on
**desktop and mobile** (`merch/reports_after.png`, `merch/reports_mobile.png`).

## 🐛 Real bug fixed — revenue `NaN`
`sandboxStore.getMerchantAnalytics()` computed `revenue = Σ(total_amount − delivery_fee)`. **Any single
order missing `delivery_fee` turned the entire revenue metric into `NaN`** (the merchant hero showed
"الأرباح المتراكمة **NaN** ج.م"). Fixed with a per-term guard: `Σ((total_amount||0) − (delivery_fee||0))`.
**Verified**: hero now shows a real number (`2117` / mobile `1674`), `revenueNoNaN: true`.

## Area audit (real screenshots)
| Area | Finding | Action |
|---|---|---|
| **Dashboard** (`dash_desktop.png`) | KPI cards (completed/active/branch/avg-cart), accumulated-revenue card, archive, proper empty states, branch selector. | ✅ + revenue NaN fixed |
| **Reports/Earnings** | **no charts** | ✅ **full analytics added** |
| **Orders** (`incoming`) | live order cards, status flow (accept/ready/dispatch), items, archive. | ✅ functional |
| **Products** (`catalog_after.png`) | menu & prices management. | ✅ functional |
| **Inventory** (`inventory_after.png`) | stock levels, low-stock, auto-disable at 0, stock history. | ✅ functional |
| **Business Profile** (`profile_after.png`) | logo/branch cover, settings. | ✅ functional |
| **Responsive** (`reports_mobile.png`) | desktop sidebar → mobile 4-col tab grid; charts `grid-cols-1 lg:grid-cols-2`, KPIs `grid-cols-2 lg:grid-cols-4`. | ✅ responsive |

## UX / QA
- `MerchantReports` uses the design-system `Card`, tokens, RTL/EN, dark theme, and is fully responsive.
- No placeholder data (everything computes from real orders) · no empty pages (empty states are
  intentional + labelled) · no hidden actions · no broken responsive layout (verified mobile).

## Honestly remaining (data-shape / external — not faked)
- **Top products by name**: sandbox order items carry only `{ quantity }` (no product-name linkage in the
  current order shape), so a by-product-name ranking isn't derivable yet — it needs order-item→product
  linkage in the order payload. Best customers / peak hours / sales trend / status mix / delivery
  performance **are** derivable and shipped. (Documented, not faked.)

## Validation
Typecheck/Lint **0 errors** ✅ · Build ✅ · in-browser charts + NaN-fix verification ✅ · E2E (merchant
journey) — CI authoritative.

## Production
- **URL**: https://haat-now.vercel.app
- **SHA**: confirmed below.
- **CI**: GitHub Actions GREEN.

## Before / After
- Before: reports tab = KPI cards + payout + FAQ only; hero revenue = `NaN` with sample orders.
- After: `merch/reports_after.png` (full analytics, revenue `2117`), `merch/reports_mobile.png` (responsive).
