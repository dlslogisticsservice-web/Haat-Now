# CATEGORY_UI_REPORT.md

## Category grid (`HomeScreen.tsx`, section `#home_categories`)
- **Layout:** `grid grid-cols-4 lg:grid-cols-8 gap-1.5` → **4 cards per row, 2 rows on mobile** (8 in one row on desktop). Responsive.
- **Cards:** compact square photo cards, `aspect-ratio 1/0.72`, `border-radius 12px`, dark glass gradient bg, category photo + small label, legibility scrim, top glass sheen, small elegant shadow, green hover/active glow (`.category-card` in `index.css`).
- **No oversized cards / no excessive vertical space** — reduced ~28% from the earlier square cards (label 8.5px, gap-1.5).

## Categories (8, image-represented)
مطاعم · سوبر ماركت · صيدليات · حلويات · قهوة · زهور · **عطور (perfume, added this sprint)** · إلكترونيات
Each maps to `CATEGORY_IMAGES[cat].cover` (category-correct photography, all URLs HTTP-200 verified).

> Note: the user's required list and the on-screen 8 differ by one — `هدايا/Gifts` was swapped for `عطور/Perfume` to match the requested set; Gifts remains available in the image resolver for any gift merchants.

## Palette / style
HAAT lime accent + glass preserved; no brand color change.

## Evidence
`screenshots/UX_02_home.png` — compact 4×2 grid, all categories visible without scrolling.

## Status: ✅ complete
