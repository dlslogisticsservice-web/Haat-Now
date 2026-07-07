# Merchant Onboarding Checklist — HaaT Now

For launching a merchant (restaurant/store/pharmacy) so their catalog is live and orderable via
COD. Uses existing tools (Admin → Provisioning/Merchant workspaces; Merchant portal). No new code.

## 1. Account & identity
- [ ] Merchant record created (Admin → Merchants / Provisioning Console) with brand name, vertical, country.
- [ ] Merchant login provisioned (phone number for OTP).
- [ ] KYC/documents captured (trade license, ID) where required (Admin → KYC Center).
- [ ] Commission rate confirmed (finance `commission_rules`) — default modelled at 15%.

## 2. Branch & coverage
- [ ] At least one branch created with name + location (lat/lng) and zone.
- [ ] Delivery zone(s) assigned so customers in-area can order.
- [ ] Opening hours set (`merchant-settings`: `hours`, `status`); vacation mode off.
- [ ] Prep time (ETA) + min order configured.

## 3. Catalog
- [ ] Categories set; products added with name, price, and image (Storage `product-images`).
- [ ] Variants/add-ons configured where relevant.
- [ ] Stock/availability set; out-of-stock items marked inactive.
- [ ] Merchant logo uploaded (`merchant-logos` bucket).

## 4. Payments (COD launch)
- [ ] COD enabled (default; no gateway needed).
- [ ] Bank/settlement details captured for weekly payouts (finance settlement).
- [ ] (Later) Card acceptance requires the platform Moyasar activation — not per-merchant.

## 5. Go-live verification (per merchant)
- [ ] Merchant appears in customer discovery/search for their zone.
- [ ] A test COD order can be placed → merchant receives it in the portal → accept → prepare.
- [ ] Order flows to a driver and completes (delivered) → merchant order history + settlement reflect it.
- [ ] Receipt/invoice renders for the order.

## 6. Handover
- [ ] Merchant trained on the portal (orders, inventory, hours, offers).
- [ ] Support contact shared.
- [ ] Merchant marked active.

## Reference
Admin: Provisioning Console, Merchant Workspace, KYC Center, Finance Center. Portal: Merchant app
(orders, inventory, store management).
