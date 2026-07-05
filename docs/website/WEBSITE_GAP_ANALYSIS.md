# Website Gap Analysis — vs Shopify / Webflow / WordPress / Framer / Wix / Squarespace

> HaaT Now · Phase 10 · Design only (Part 16). Honest comparison of the **designed** Website OS
> against incumbents, and — critically — where HaaT Now can **win** because it is not a generic
> website builder but a **delivery-marketplace-native** one.

## 1. Capability matrix (● full · ◐ partial · ○ none/planned-later)

| Capability | HaaT Now (designed) | Shopify | Webflow | WordPress | Framer | Wix | Squarespace |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Block/visual editor | ● | ◐ | ● | ◐(plugins) | ● | ● | ● |
| Design-token theme engine | ● | ◐ | ● | ◐ | ● | ◐ | ◐ |
| SSR/ISR + CDN | ● | ● | ● | ◐ | ● | ● | ● |
| Multi-tenant by design | ● | ○(per-store) | ○ | ○ | ○ | ○ | ○ |
| True white-label (agency/franchise) | ● | ◐ | ◐(client billing) | ◐ | ○ | ○ | ○ |
| Custom domain + auto-SSL | ● | ● | ● | ◐ | ● | ● | ● |
| Media library + auto webp/avif | ● | ● | ● | ◐ | ● | ● | ● |
| SEO platform + JSON-LD + redirects | ● | ● | ● | ●(Yoast) | ◐ | ◐ | ◐ |
| Localization (RTL, per-block) | ● | ◐ | ◐ | ●(WPML) | ◐ | ◐ | ◐ |
| Publishing (draft/approve/rollback/schedule) | ● | ◐ | ● | ◐ | ◐ | ◐ | ◐ |
| Forms + webhooks + spam | ● | ◐ | ● | ●(plugins) | ◐ | ● | ● |
| First-party analytics | ● | ● | ◐ | ◐ | ◐ | ● | ● |
| **Live delivery-data blocks (stores/products/offers/drivers/maps)** | ● | ◐(own store only) | ○ | ○ | ○ | ○ | ○ |
| **Native order/checkout in the platform** | ● | ● | ○ | ◐(Woo) | ○ | ◐ | ◐ |
| **Merchant/driver onboarding forms → KYC pipeline** | ● | ○ | ○ | ○ | ○ | ○ | ○ |
| App marketplace / plugins | ◐(component registry) | ● | ◐ | ●(huge) | ◐ | ● | ◐ |
| Ecommerce catalog depth | ◐ | ● | ◐ | ◐ | ○ | ◐ | ◐ |
| Template marketplace | ◐(planned) | ● | ● | ● | ● | ● | ● |
| Blog/CMS | ● | ◐ | ● | ●(best) | ◐ | ◐ | ● |
| A/B testing | ○(later) | ◐ | ◐ | ◐ | ○ | ◐ | ○ |
| Membership/gated content | ○(later) | ◐ | ◐ | ● | ○ | ◐ | ◐ |
| Email marketing | ◐(via CRM) | ● | ○ | ◐ | ○ | ● | ● |

## 2. Where HaaT Now is structurally stronger (the moat)
1. **Delivery-marketplace-native blocks.** No incumbent can render *your* live stores, products,
   offers, coupons, categories, cities, driver counts, and coverage maps as first-class blocks tied
   to a real logistics backend. This is the unique value — a merchant's website is *wired to their
   operations*, not a brochure.
2. **True multi-tenant white-label.** Built for 10k tenants/agencies/franchises from the schema up
   (per-tenant RLS, per-tenant theme/domain/media). Shopify/Webflow/Wix are single-account products;
   agency multi-client is bolted on.
3. **Onboarding forms feed the real pipeline.** A "Become a merchant"/"Drive with us" form creates a
   real onboarding/KYC record — not an inbox entry.
4. **One platform, one bill.** Website + app + operations + payments + CRM under one tenant, one
   RBAC, one audit trail. Incumbents are website-only.

## 3. Where incumbents are ahead (honest gaps to close)
| Gap | Incumbent leader | Our plan |
|---|---|---|
| Template/theme marketplace depth | Wix/Squarespace/Shopify | `website_templates` marketplace (Phase D); seed a curated set first |
| Plugin/app ecosystem | WordPress/Shopify | Custom Component Registry (gated) + webhooks; not a full app store initially |
| Deep ecommerce (variants, tax, shipping zones) | Shopify | leverage the platform's existing catalog/checkout; deepen over time |
| Blogging/editorial richness | WordPress | strong block editor + revisions; match core, not plugin sprawl |
| A/B testing, personalization | Webflow/Wix | Phase E (analytics-driven) |
| Membership/paywalls | WordPress | Phase E; reuse platform auth/subscriptions |
| Email marketing automation | Wix/Squarespace | route via the platform CRM/campaign engine |
| Maturity/polish of editor | Framer/Webflow | iterative; start with a solid schema-driven editor |

## 4. Missing capabilities to explicitly track (backlog)
Template marketplace depth · plugin/app store · advanced ecommerce (tax/shipping/variants) ·
A/B testing · personalization · membership/gated content · email automation · e-signature/booking
payments · advanced form logic (conditional fields) · comment/moderation for blogs · multi-region
CDN edge config · visual animation timeline (Framer-class).

## 5. Strategic recommendation
**Do not try to out-Webflow Webflow on generic websites.** Win on the wedge no one else has:
*operationally-wired, multi-tenant, white-label sites for delivery/marketplace businesses*. Match
incumbents on the table stakes (editor, SSR, SEO, media, domains, i18n) and dominate on the dynamic
delivery blocks + true multi-tenancy. Defer generic-CMS breadth (marketplace depth, plugin store,
A/B) to later phases.
