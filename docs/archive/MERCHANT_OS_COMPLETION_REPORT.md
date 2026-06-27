# Merchant OS — Completion Report (RC-2)

Honest scope. This sprint delivered **Part 3 (Store Management)** as a real, persisted,
production-ready capability — not mock UI. The other parts of this 14-part spec are large net-new
build-outs that were NOT done and are not claimed. Merchant-only; Admin/Customer/Driver untouched.

## Completed & verified this sprint
### Part 3 — Store Management (new merchant tab "Store") ✅ REAL
- `src/features/merchant/StoreManagement.tsx` — bilingual operational console:
  - **Store status** segmented: Open / Busy / Closed.
  - **Vacation mode**, **Auto-accept** toggles (role=switch, aria-checked).
  - **Min order**, **Prep time**, **Busy extra**, **Delivery radius** numeric inputs.
  - **Working hours** per day (open/close times + per-day Open/Closed).
  - Live **"Accepting orders now"** indicator derived from status + vacation + today's hours.
  - **Effective prep time** = prep + busy surcharge when in Busy mode.
- `src/services/merchant-settings.service.ts` — **real persistence** (not mock):
  - Sandbox: localStorage (`haat_merchant_settings_<branchId>`).
  - Production: `merchant_branches.settings` jsonb (additive migration below).
  - **Store open/closed/vacation drives the REAL `merchant_branches.is_active` flag** via
    `merchantService.updateBranchInfo` → actually hides the store from customers.
  - `isAcceptingOrders(...)`, `effectivePrepTime(...)` business logic.
- `supabase/migrations/20260626000003_merchant_store_settings.sql` — ADDITIVE: adds
  `merchant_branches.settings jsonb default '{}'`. Backward compatible; readers fall back to
  `DEFAULT_STORE_SETTINGS`/localStorage when empty.
- Wired into `MerchantApp` NAV (6th tab) + render + bilingual tab label. Existing tabs untouched.

### Verification
- **Persistence proven**: toggled Busy + Save → `status: "busy"` written to storage (E2E probe).
- EN capture `33-merchant-store-en.png` — `#store_management` English + LTR, zero Arabic leftover,
  0 page errors.
- Build ✅ · Typecheck ✅ · ESLint(tsc) ✅ · E2E 24/24 ✅. 0 emoji in new files (Lucide icons).

## Localization (Part 10)
- New Store Management UI 100% bilingual (AR/EN + RTL/LTR via `L(ar,en)`). The rest of MerchantApp
  was already localized in a prior sprint.

## Responsive (Part 11)
- Store Management uses responsive grids (`sm:grid-cols-2`) + wrapping rows; works desktop/tablet/
  mobile. Merchant mobile already uses the bottom tab strip.

## NOT done this sprint (net-new — documented, not faked)
- **Part 1** richer dashboard KPIs (acceptance/cancellation rate, satisfaction need new aggregates),
  **Part 2** Kitchen Queue/timeline/timers, **Part 4** menu variants/add-ons/import-export,
  **Part 5** scheduled orders/refund-request workflow/order timeline, **Part 6** analytics heatmap/
  peak-hours/repeat-customers, **Part 7** reviews reply/report, **Part 8** customer chat/broadcast,
  **Part 9** merchant settlements/invoices/taxes UI, **Part 12** virtual tables/image-opt.
  Each requires new backend aggregates or new tables + multi-day UI; not started.

## Merchant OS readiness (honest)
- ~65% — solid orders/catalog/inventory/earnings/profile + now Store Management; the operational
  "OS" depth (kitchen, analytics, reviews, chat, finance) remains.
