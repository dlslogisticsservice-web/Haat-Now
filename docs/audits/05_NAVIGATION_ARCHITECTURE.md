# 05 — Navigation Architecture (inspection-only, no implementation)

## Current navigation (evidence)
- **App level** (`src/App.tsx`): role-conditional render, no router. customer / merchant / driver /
  admin shells chosen by `session.role`.
- **Customer**: bottom-nav, `currentScreen` state (`home/discover/restaurant/checkout/cart/orders/
  wallet/profile`). `#nav_discover` etc.
- **Admin** (`src/features/admin/AdminSidebar.tsx`): grouped collapsible sidebar, super-gating, Ctrl+K
  global search, mobile nav strip. Current groups & keys:

| Group (ar/en) | Items (key) |
|---|---|
| القيادة / Executive | Dashboard (`kpi`) |
| العمليات / Operations | Command Center (`ops:command`), Dispatch (`ops:dispatch`), Zones (`ops:zones`) |
| الأسطول / Fleet | Drivers (`ops:performance`), Vehicles (`ops:vehicles`) |
| التجارة / Commerce | Coupons (`coupons`) |
| المالية / Finance | Finance Center (`ops:finance`), Payouts (`ops:payouts`) |
| العملاء / CRM | Support (`support`), Customer Care (`ops:care`) |
| التسويق / Marketing | Growth (`ops:growthb`), Campaigns (`campaigns`, super) |
| الأمان / Security | Compliance (`ops:kyc`), System Logs (`logs`, super) |
| المنصّة / Platform | Design (`design`, super) |
| النظام / System | Notifications (`notifications`), Settings (`config`) |

## Routes audit
- **Reachable:** all sidebar keys above + Ctrl+K search.
- **Reachable but nested (not top-level):** Experience Builder / Assets Manager / Country Branding
  (inside Design `section` tabs), legacy Growth (inside Operations `growth` tab), Operations
  KYC/Finance/Care/Growth (also surfaced inside OperationsCenter tab shell + top-level keys).
- **Dead/orphan routes:** none found (no router → no URL dead routes). `currentScreen` values all
  rendered.
- **Legacy/duplicate:** `GrowthCenter` (legacy) reachable only via Operations `growth` tab; overlaps
  `GrowthCenterB`. Two sidebars exist (`AdminSidebar` admin, `EnterpriseSidebar` merchant).

## Recommended IA for Enterprise (DESIGN ONLY — not implemented)
The current 10-group sidebar already supports an enterprise hierarchy. Recommended additions/regroup
to reach a Stripe/Shopify-class console (no code changes this sprint):

1. **Overview** — Dashboard, Live Ops snapshot, Alerts.
2. **Operations** — Command Center, Dispatch, Zones, SLA Monitor*, Heatmaps.
3. **Fleet** — Drivers, Vehicles, Availability, Performance.
4. **Commerce** — Merchants*, Restaurants*, Products*, Categories*, Coupons.
5. **Finance** — Revenue, Settlements, Payouts, Refunds, Transactions*, Accounting export.
6. **CRM / Care** — Support, Customer Care, Complaints*, Reviews*.
7. **Marketing / Growth** — Growth, Campaigns, Loyalty, Referrals, Segments.
8. **Security & Compliance** — KYC, Fraud*, Roles/Permissions*, Audit Logs.
9. **Platform / White-Label** — Design Center, Experience Builder, Country/Brand Branding,
   Assets, Feature Flags*, Tenants* (future).
10. **System** — Notifications, Settings, Integrations* (payment/SMS/email/maps), API keys*.

`*` = not yet a discrete module (would be new work — out of scope for this audit).

## Conclusion
The current navigation **can support an Enterprise Sidebar** — it already is one (grouped,
collapsible, super-gated, searchable). It needs *modules added under existing groups*, not a nav
rewrite.
