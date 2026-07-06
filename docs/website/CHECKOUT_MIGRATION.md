# Smart Checkout Migration (Wave 3, Part 6)

> At a **configurable** checkout progress (default 50%), offer a value-based choice: "Continue in App"
> (with coupon injection + a deferred deep link that resumes checkout) or "Continue on Website".
> **Never forces.** Everything editable from Website Center. `growth/checkout-migration.ts`.
> Flag: `website.checkout_migration`.

## Configuration (all admin-controlled)
`CheckoutMigrationConfig`: `enabled`, `thresholdPct` (default 50), `title`, `body`,
`continueInAppLabel`, `continueOnWebsiteLabel`, `couponCode`, `appScheme`, `deepLinkPath`,
`storeLinks` (Play/App Store/AppGallery), `imageUrl`, `videoUrl`. `defaultCheckoutMigrationConfig()`
ships **disabled** (admin/flag enables).

## Behaviour
`buildCheckoutMigration(config, checkout, platform, nowMs)`:
- **Eligible** only when `enabled && checkout.progressPct >= thresholdPct`.
- Builds a **resume token** carrying `{ intent:'checkout', cartId, coupon, cartValue }` so the app
  resumes exactly where the customer left off, **with the discount applied** (coupon injection).
- Produces `continueInApp` (deep link + store fallback + resume token) **and** always a
  `continueOnWebsite` option — value-based persuasion, never a forced redirect.

Example: *"Continue in the app and get 10% OFF your next order."* → `[Continue in App]` `[Continue on Website]`.

## Flow (client)
1. Customer reaches ≥ threshold at checkout → the `AppInstallModal` (`features/site/AppInstallModal.tsx`)
   renders the offer (premium glass modal; Escape/dismiss; never blocks).
2. **Continue in App** → attempt the deep link (installed → resumes in-app with coupon); else store,
   stashing the resume token for post-install resume (deferred deep linking — `DEEP_LINKING.md`).
3. **Continue on Website** → dismiss; checkout proceeds on the web unchanged.

## Analytics
`conversion_shown` / `conversion_clicked` / `conversion_dismissed` / `deep_link_success` /
`deep_link_fallback` / `coupon_used` (analytics module) measure migration performance; experiment
variants (Part 7) A/B the offer.

## Reusability
Fully config-driven + tenant-scoped; the migration is a specialization of the Growth Engine (a
campaign with a `checkout_progress` trigger) — every tenant configures its own.

## Tests
`__tests__/checkout-marketing-pwa.test.ts` — threshold eligibility, coupon+cart in the resume token,
deep link, and the always-present "Continue on Website" (never force).
