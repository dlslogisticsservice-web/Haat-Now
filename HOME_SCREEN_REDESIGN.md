# HOME_SCREEN_REDESIGN.md

## Change
The fintech **"Platinum card" hero was removed** and replaced with a food-delivery **MarketplaceHero** carousel (`src/features/home/MarketplaceHero.tsx`), used in `HomeScreen.tsx`.

## MarketplaceHero
- 8 rotating slides (Restaurants, Supermarket, Pharmacies, Coffee, Electronics, Flowers, Gifts, Desserts) — full-width category imagery, headline, subtitle, CTA.
- Auto-rotate ~6s, manual arrows + dots, glass overlays, subtle Ken-Burns animation (`.hero-kenburns`, respects `prefers-reduced-motion`).
- CTA uses the country's dialect ("اطلب أكلك" for Egypt / "اطلب وجبتك" for Saudi) and localizes to "Shop now" in English.
- **No banking visuals, no credit-card chrome.** Marketplace identity (Talabat/HungerStation/Jahez style).

## Home composition
Hero → search → **compact category grid** → exclusive offers (real `offers` data, multi-vertical banner imagery) → nearest restaurants (real `merchant_branches`) → featured stores → benefits.

## Palette
HAAT NOW lime `#a3f95b` / `var(--color-primary-fixed)` preserved; glassmorphism retained. No brand colors changed.

## Evidence
Runtime screenshot `screenshots/UX_02_home.png` — marketplace hero (not banking), real catalog, compact grid. Wallet remains a clean balance panel (no EMV chip/card-number).

## Status: ✅ complete
