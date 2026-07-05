# Role Capability Matrix — HaaT Now

> Independent Enterprise CTO Audit · Phase 8 · Documentation only · 2026-07-05
> Evidence cited `file:line`.

## How roles actually work

- **Server-side (enforced):** exactly **4 coarse roles** — `customer(1) < driver(2) < merchant(3) < admin(4)` (`role_provisioning.sql:26-33`), plus an admin **scope** `super | country` (`admin_country_scoping.sql`).
- **Client-side (NOT enforced):** a 9-template, 35-permission RBAC matrix in `rbac.service.ts:30-81`, stored in localStorage, used **only to show/hide UI**. The personas below (Branch Manager, Dispatcher, Fleet Manager, Finance, Support) exist **only as client templates** — the database cannot tell them apart from any other admin (see SECURITY_REVIEW S-1).

> **Therefore:** the 10 personas requested in the audit brief collapse, at the enforcement layer, into **4 real roles + a super/country flag**. The matrix below marks each capability as **E** (server-enforced), **U** (UI-only / client-gated), **S** (sandbox-only), or **✗** (absent).

---

## Customer — 🟢 mostly complete

| Capability | Status | Evidence |
|---|---|---|
| Register / OTP login | E | `auth.service.ts:96-130` |
| Manage addresses | E | `20260614000009`, owner-scoped RLS |
| Browse / search / view store | E | catalog RLS `20260614000007` |
| Cart / checkout | E (not atomic) | `order.service.ts:25-77` |
| Apply coupon | E | `redeem_coupon` `20260614000029` |
| Pay (Moyasar) | E | `payment-initiate` |
| Wallet balance / redeem loyalty | E / ⚠️ | `WalletScreen.tsx:84` — can redeem points **never earned** |
| Track order | E | `order_tracking` RPC |
| Cancel order | E (pending only) | `order.service.ts:133-152` |
| Request refund | ✗ | no in-app refund path |
| Re-order / favorites | E | `20260614000034_customer_parity` |
| **Missing:** self-service refund, cancel after assignment, loyalty accrual, email/social login. |

## Driver — 🟡 functional, bookkeeping broken

| Capability | Status | Evidence |
|---|---|---|
| OTP login | E | — |
| See job feed / accept delivery | E (race-safe) | `driver.repository.ts:47-52` |
| Receive dispatch offers / accept-reject | E | `respond_dispatch` `operations_engine:247-267` |
| GPS streaming | E | `DriverApp.tsx:193-212` (→ wrong location store, §tracking) |
| Complete delivery + get paid | E (atomic) | `complete_delivery` `0012` |
| See earnings / wallet | E | `driver_earnings`, wallet RPCs |
| Shift start/end | E | `ops/shift.service.ts` |
| KYC submission | E | `20260614000030` |
| **Broken:** two assignment systems diverge; `active_orders`/availability never freed after delivery (`finalize_driver_delivery` dead). **Missing:** in-app reject in the grab path; no navigation/road routing. |

## Merchant / Branch Manager — 🟡

| Capability | Status | Evidence |
|---|---|---|
| OTP login | E | — |
| Manage catalog (CRUD products) | E | `20260627000004_catalog_crud` |
| Kitchen queue / accept-reject order | E | `MerchantApp.tsx:270-300` |
| Manual stock adjust | E (atomic) | `adjust_product_stock` |
| Store settings / hours | E | `20260626000003_merchant_store_settings` |
| Wallet / reports | E / mixed | `MerchantWalletCenter.tsx`, `MerchantReports.tsx` |
| Store management | E | `StoreManagement.tsx` |
| **Missing:** "Branch Manager" is not a distinct enforced role — any merchant sees all its branches; no branch-scoped sub-users. Reject order performs no refund/compensation. No auto stock decrement. |

## Admin personas (Dispatcher / Fleet / Finance / Support / Country Admin / Super Admin)

**All six are the same server role (`admin`) differentiated only by UI templates and the `super/country` scope.** Capabilities exist as admin screens; enforcement does not distinguish them.

| Persona (UI template) | Screens present | Enforced separation | Gap |
|---|---|---|---|
| **Dispatcher** | OperationsCenter (auto/manual dispatch, expire) | U | any admin can dispatch; no auto-trigger/scheduler |
| **Fleet Manager** | Vehicle/zone/shift workspaces, `ops/*.service` | U | any admin can manage fleet |
| **Finance** | FinanceCenter (settlements, commissions, compensations) | **U (country ignored)** | any admin, any country, can pay settlements (S-2) |
| **Support** | CustomerCareCenter, tickets | U | any admin; tickets manual only |
| **Country Admin** | scope=`country` | **E for orders/roster only** | can act on all countries' finance/ops (S-2) |
| **Super Admin** | scope=`super` | E | full cross-country/global; also effectively equal to country admin on money tables |
| KYC / Compliance | KycCenter (review/approve/suspend/ban + audit) | U | real workflow, but not a gate on transactions |
| RBAC admin | RbacCenter | **S (localStorage)** | matrix edits never reach DB |
| Growth / Campaign | GrowthCenter, CampaignCenter | U | delivery/attribution not wired |
| Website / Design | WebsiteCenter, DesignCenter | **S (localStorage)** | no DB persistence |
| Provisioning | ProvisioningConsole, TenantOnboardingWizard | **S / broken in live** | schema mismatch (WHITE_LABEL) |

---

## Verdict

- **Customer / Driver / Merchant** operational capability is genuinely present (🟡–🟢), with the driver bookkeeping and refund/loyalty gaps noted.
- **The entire admin/operations persona layer is UX-complete but enforcement-incomplete:** the platform *presents* 10 enterprise personas; the backend enforces **4 roles + one scope flag**. For an enterprise buyer this is the central RBAC risk — least-privilege is a **UI illusion**, not a security control.
- Country admins have **unscoped access to money and operations** across all countries.
