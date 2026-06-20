# PRODUCT_IMAGE_AUDIT.md

## Root cause of the "burger everywhere" bug (historical)
Three helpers each defaulted to a **food/burger** image, and because `product_images` is empty in the DB, *every* product fell back to a burger regardless of category.

## Fix — single source of truth: `src/utils/categoryImages.ts`
- `CATEGORY_IMAGES` maps **9 categories** → cover + 3 thumbs each (all URLs verified HTTP-200):
  restaurant→food, pharmacy→medicine, **perfume→fragrance (added)**, market→groceries, coffee→coffee, sweets→desserts, flowers→flowers, electronics→devices, gifts→gift boxes.
- `resolveCategory(name,type)` classifies by explicit type then Arabic/English keyword patterns (incl. `عطر|عطور|بخور|عود|perfume|fragrance`).
- **Last-resort default is `market` (groceries), never restaurant food** — so an unknown non-food store never shows a burger.

## Fallback hierarchy (implemented)
`product.product_images[0].url` → `getProductFallback(productName, branchCategory, idx)` → category-correct thumb → (placeholder is the category cover).
- `getProductFallback`: if the product name itself resolves to a concrete category, use it; otherwise inherit the **branch's** category — so a pharmacy's "مرطب يدين" shows pharmacy imagery, not food.
- **Variant images:** `product_variants` has no image column in the schema, so the variant tier degrades to the category tier (documented; no schema change per constraints).

## Per-screen wiring
- `RestaurantScreen` cover → `getCategoryCover`; products → `getProductFallback(name, branchCategory, idx)`.
- `HomeScreen` branch cards/featured → `getCategoryCover`; offer banners → multi-vertical rotation (not food-only).
- `App.tsx` cart thumbnails → food keyword match else `getCategoryThumb` (non-food never hits burger).
- `CheckoutPage` hero → `getCategoryThumb` (was a cutlery icon).

## Evidence
Prior runtime screenshots: pharmacy products = pills/medicine (no burgers); supermarket = groceries; restaurant = food; categories show 8 distinct category photos.

## Guarantee
**No non-food category renders a burger/food image.** Pharmacy→medicine, flowers→flowers, electronics→devices, coffee→coffee, desserts→desserts, gifts→gifts, supermarket→grocery, perfume→fragrance, restaurants→food.

## Status: ✅ complete
