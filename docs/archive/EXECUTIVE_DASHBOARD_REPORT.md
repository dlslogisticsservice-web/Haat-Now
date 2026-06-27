# Executive Dashboard Report — HAAT NOW

Strike-team target: the **Executive Dashboard module only**. Status: **CLOSED** — every Dashboard
UI string flips AR↔EN live with RTL↔LTR.

## Files
- `AdminDashboardHome.tsx` — the executive command center (KPI widgets, order pipeline, fleet
  status, performance, system health, charts, module cards). **Already fully bilingual** (built with
  `L(ar,en)` in an earlier sprint) — verified: all 48 Arabic lines are inside `L()` calls.
- `AdminDashboard.tsx` — the dashboard shell + Coupons / Config / Support tab bodies. **Closed this
  sprint** (added an `L` helper + localized ~40 strings).

## Widgets / tabs localized this sprint (AdminDashboard)
- **Coupons tab**: create-coupon form (code placeholder, Discount %, Usage limit, Expiry date,
  Country options All/Egypt/Saudi Arabia, Create coupon), coupon list (Coupons count, Active/
  Disabled toggle, used/until/Expired, empty state).
- **Config tab**: Edit settings header, Default delivery fee label + Update fee, Welcome message
  (SMS) label + Save message, Configuration guide (3 lines).
- **Support tab**: Incoming reports count, empty states, Customer fallback, Conversation header,
  No-ticket-selected state, Mark as resolved, Report #, No previous messages, Admin/Customer sender
  labels, Reply button + placeholder.
- Toasts: save-error, config-updated-success, ticket-resolved; loader text.

## Charts (STEP 4)
- All charts live in `AdminDashboardHome` (Recharts: Hourly Orders bar, Revenue Trend line, Driver
  Utilization pie, KPI sparklines). Axis/tooltip/legend already render the same in AR/LTR + EN/LTR;
  the home container uses dynamic `dir`. Loading uses `SkeletonChart`/`SkeletonMetrics`; empty data
  guarded. No chart breaks on language switch (verified by EN capture, 0 page errors).

## Localization coverage
- **Dashboard module: 100%** of UI strings localized. Remaining `[؀-ۿ]` matches are: comments, the
  language-toggle code (`{lang === 'ar' ? 'EN' : 'ع'}`, intentional), the bilingual mobile-nav
  tuples (rendered via lang), and the editable Welcome-SMS *content* default (`configMessage`, a
  user value sent to customers — data, not chrome).

## Performance
- `AdminDashboardHome` data fetched once on mount (ops summary + finance + growth) with `useMemo`d
  derived series; `AdminDashboard` notification badge on a single Realtime channel. No new renders
  introduced. (No unsafe refactor of the existing fetch flow.)

## Verification (screenshots)
- `25-dashboard-coupons-en.png` — Coupons tab: English present = true, **Arabic leftover = false**.
- `26-dashboard-config-en.png` — Config tab: English present = true, **Arabic leftover = false**
  (the Arabic in the SMS textarea is editable content/data). 0 page errors.
- AR baseline: `01-dashboard.png`; EN executive home: `09-dashboard-en.png` (prior).

## Validation
- TypeScript ✅ · ESLint ✅ · Build ✅ · E2E 24/24 ✅

## Remaining blockers
- None. Other admin modules (CampaignCenter, DesignCenter, ExperienceBuilder) still have hardcoded
  Arabic — outside this Dashboard mission.
