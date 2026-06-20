# VISUAL DIFF ANALYSIS
**stitch_02_home.png vs screenshots/04_home_screen.png**

> All observations are based on direct visual inspection of both images.
> No code was modified. No assumptions from VISUAL_BIBLE.
> Measurements marked (~) are estimated from visual proportion; exact pixel values from known code are marked (code).

---

## VIEWPORT BASELINE

| Property | Lovable (stitch_02_home.png) | Current (04_home_screen.png) |
|---|---|---|
| Viewport width | ~390px (standard mobile) | 393px (Puppeteer config) |
| Viewport height | ~844px | 852px (Puppeteer config) |
| Orientation | Portrait | Portrait |
| Direction | RTL | RTL |

---

## COMPONENT 1 — HEADER

### Screenshot evidence
- **Lovable**: Thin top bar. Left: small circular profile avatar (white outline, ~28px). Center: "HAAT NOW" in white Latin uppercase letters, moderate weight (~16–18px). Right: hamburger menu icon (3 lines, white, ~20px). No location text. No color accents.
- **Current**: Top bar. Left: circular profile icon with green dot indicator. Center: two-line text — "التوصيل إلى" (small, gray, ~11px) above "البيت، الرياض" (white, ~14px bold). Right: a green-outlined circle with a solid lime 10px dot inside.

### Measurements

| Element | Lovable | Current |
|---|---|---|
| Header height | ~48px | 56px (code) |
| Center content | "HAAT NOW" brand text | Delivery location text |
| Left icon | Profile avatar ~28px | Profile icon + green status dot |
| Right icon | Hamburger menu (3 lines) | Green dot indicator (lime circle) |
| Background | Dark graphite, no border | Dark graphite, subtle bottom border |
| Brand visibility | Always visible — "HAAT NOW" | Never visible — replaced by location |

### What exists in reference
A minimal dark header that anchors the brand name "HAAT NOW" as the permanent screen identity. Icons are simple white outlines. No color accents except white text.

### What exists in current implementation
A functional delivery-context header showing the user's saved address. The brand name is absent. A lime dot indicator replaces the menu icon. The dual-line location text ("التوصيل إلى / البيت، الرياض") is the visual center.

### Estimated impact score
**9 / 10** — The header is the first thing every user reads. "HAAT NOW" vs. a delivery address is a complete content substitution. The green dot replaces expected navigation affordance (hamburger). Every screen is affected, not just Home.

---

## COMPONENT 2 — HERO BANNER

### Screenshot evidence
- **Lovable**: The hero section is the dominant visual element. It occupies approximately **65–70% of the total visible first screen** (after the header). Contents from top to bottom:
  1. "PLATINUM EXCLUSIVE ⭐" — small lime pill chip with lime border, lime text, dark background, star emoji
  2. "ارتق بتجربتك مع HAAT NOW Platinum" — 2-line large Arabic headline, white, heavy weight, approximately 28–32px
  3. 3 lines of gray body text (approximately 13–14px): "توصيل فاخر غير محدود، خصومات حصرية وأولوية في الطلب النهائي"
  4. **Dark floating card**: A premium-style dark card (landscape, slightly angled/tilted), occupying the right ~50% of the hero area. The card has a visible green gradient/glow on its surface, appears to be a loyalty or payment card design. The card floats over the dark background.
  5. "اطلب الآن" — lime rounded pill CTA, approximately full-width of text column, ~40px height
  - The text column occupies the left ~55% of the hero
  - The card illustration occupies the right ~55% (overlaps center)

- **Current**: Compact banner, approximately **200px tall** (code confirmed). Contents:
  1. "Platinum ⓟ" lime outlined chip + "VIP" dark chip — both small, top-right of banner
  2. "احصل على خصم 25% الآن" — headline, lime "25%" at ~28px, rest of text smaller
  3. "استفد الآن" — lime CTA button, approximately 38px height, positioned bottom-left of text area
  4. **Pizza SVG illustration** on the right side: geometric circles (dough, toppings) in lime and dark colors, ~62% width, overflows top and bottom edges of the 200px container
  - Background gradient: dark green `#0d2808 → #061504 → #0a0c08` (dark olive)

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Hero height | ~380–420px (estimated ~65% of 852px usable area) | 200px (code) |
| Height as % of viewport | ~65–70% | ~23% |
| Headline font size | ~28–32px, 2-line | ~23px + lime "25%" at 28px |
| Headline line count | 2 full lines | 1 line |
| Body text | 3 lines, gray (~13px) | None |
| Badge | "PLATINUM EXCLUSIVE ⭐" lime pill | "Platinum ⓟ" + "VIP" dual chips |
| CTA text | "اطلب الآن" | "استفد الآن" |
| CTA width | ~full text-column width | Narrow pill |
| CTA height | ~40px | ~38px |
| Illustration type | Dark floating card (premium card design, green glow) | Pizza SVG (geometric, lime/dark) |
| Illustration position | Right 50% of hero, overlapping center | Right side, CSS `right: -20px` |
| Illustration angle | Slightly tilted (~-15° to -20°) | Upright / straight |
| Text column position | Left ~55% | Right side with scrim |
| Layout direction | Text LEFT, card RIGHT | Text RIGHT, pizza RIGHT (same side) |
| Background | Dark near-black with faint dark olive tint | `linear-gradient(135deg, #0d2808, #0a0c08)` |

### What exists in reference
A large, immersive Platinum membership promo section. The dark card communicates premium status (financial/loyalty card aesthetic). The 3-line body text explains the benefits. The layout is cinematic: card on the right, copy on the left, card bleeds into hero space.

### What exists in current implementation
A compact 200px banner communicating a food discount (25% off) with a pizza illustration. The content theme is different (discount vs. Platinum membership). The pizza SVG is decorative, not premium. The text column is on the right side, same as the illustration — they compete for space requiring a dark scrim. No body text.

### Estimated impact score
**10 / 10** — The hero is the primary purpose of the home screen in the Lovable design. Three compounding problems: wrong height (200px vs ~400px), wrong illustration (pizza SVG vs premium card), wrong content theme (discount vs membership). This single component accounts for the largest visual gap.

---

## COMPONENT 3 — SEARCH BAR

### Screenshot evidence
- **Lovable**: The search bar is **barely visible at the very bottom of the first viewport** in `stitch_02_home.png`. It appears as a dark rounded pill with placeholder text "ما تريد إن طلب اليوم؟" in gray. No lime chip on the left. No secondary button on the right. Approximately ~48px height. Simple border, no metallic treatment visible.
- **Current**: Full-width silver metallic bar with:
  - Lime-filled square chip on left (`38×38px`, lime background, white search icon inside, neon glow)
  - Placeholder: "ماذا تريد اليوم؟ مطاعم، أكلات، متاجر..."
  - "فلاتر" lime-colored text button on right
  - Height: ~52px
  - Silver metallic gradient: `#6c7480 → #4e5359`

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Height | ~48px | ~52px |
| Left element | None (or minimal icon) | Lime square chip 38×38px with neon glow |
| Right element | None visible | "فلاتر" lime text button |
| Placeholder text | "ما تريد إن طلب اليوم؟" | "ماذا تريد اليوم؟ مطاعم، أكلات، متاجر..." |
| Background material | Dark rounded pill, subtle | Silver metallic gradient |
| Search icon | Simple outline icon (not lime) | White icon inside lime-filled square |
| Position on screen | Below fold / at fold | ~260px from top (well above fold) |
| Visibility in first screen | Barely visible at bottom edge | Fully visible, prominent |

### What exists in reference
A simple, unobtrusive dark search pill. Its function is secondary to the hero — it exists below the fold and signals "more below." No lime color on the search bar itself.

### What exists in current implementation
A prominent silver metallic search bar with a lime icon chip that draws immediate attention. It appears well above the fold (at ~260px from top). The lime chip + "فلاتر" button make it feel like the primary interactive element instead of the hero CTA.

### Estimated impact score
**6 / 10** — The search bar itself (height, placeholder) is close. The material (silver metallic vs dark pill) differs but may be acceptable per DESIGN-SPEC. The critical issue is position/prominence: the current search bar is above the fold and competes with the hero; in Lovable it is below the fold and does not compete.

---

## COMPONENT 4 — CATEGORIES

### Screenshot evidence
- **Lovable (`stitch_02_home.png`)**: **Categories are NOT visible in the first viewport.** The large hero + search bar fill the entire first screen. Categories exist below the fold.
- **Current (`04_home_screen.png`)**: Categories are **fully visible in the first viewport**, appearing at approximately y=320px from the top. Two complete rows of 4 circular tiles each (8 total) are visible:
  - Row 1: المطاعم, السوبر ماركت, الصيدلية, القهوة
  - Row 2: الحلويات, الهدايا, الزهور, إلكترونيات
  - Each tile: ~68×68px circle, glass material (`backdrop-filter: blur`), lime Lucide icon with neon glow drop-shadow, 10px label below

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Visible in first viewport | **NO** | **YES** |
| Y-position on screen | Below fold (~800px+) | ~320px from top |
| Grid | Unknown (below fold) | 2 rows × 4 cols (8 tiles) |
| Tile shape | Unknown | Circular (`border-radius: 50%`) |
| Tile size | Unknown | ~68×68px |
| Tile material | Unknown | Glass (`backdrop-filter: blur(28px)`) |
| Icon type | Unknown | Lucide stroke icons (lime) |
| Icon glow | Unknown | Lime neon `drop-shadow` on all icons |
| Label size | Unknown | 10px |

### What exists in reference
Categories do not appear at all in the first screen. Their design cannot be confirmed from `stitch_02_home.png` alone — this requires a separate Lovable screenshot that shows the user scrolled down.

### What exists in current implementation
8 circular glass tiles arranged in 2 rows of 4 columns, with glowing lime icons, are the first content section after the compact hero. They are the second most prominent element on screen.

### Estimated impact score
**8 / 10** — The mere presence of categories above the fold when the Lovable design does not show them there is itself a structural divergence. All the tile-level details (shape, material, glow) cannot be validated against the reference because the section is not visible in `stitch_02_home.png`.

---

## COMPONENT 5 — OFFERS

### Screenshot evidence
- **Lovable (`stitch_02_home.png`)**: **Offers section is NOT visible in the first viewport.** Below the fold.
- **Current (`04_home_screen.png`)**: The offers section header "العروض الحصرية" + "عرض الكل" is visible at approximately y=540px. The top portion of the first offer card is visible:
  - Circular illustration (lime/olive circles on dark background)
  - Badge: "عرض دسم"
  - Headline: "خصم 50%"
  - CTA: "اطلب الآن"

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Visible in first viewport | **NO** | **Partially** (header + top of card) |
| Y-position | Below fold | ~540px from top |
| Card height | Cannot confirm | 178px (code) |
| Illustration type | Cannot confirm | SVG circles (geometric) |

### What exists in reference
Below the fold — cannot validate design details from `stitch_02_home.png`.

### What exists in current implementation
Partially visible at the bottom of the first viewport, with a section header and partial first offer card.

### Estimated impact score
**5 / 10** — Cannot validate specifics from reference screenshot. The primary issue is the offers appearing above the fold, which Lovable does not show. Design details (card height, illustration style) cannot be confirmed or denied from this reference alone.

---

## COMPONENT 6 — RESTAURANT SECTION

### Screenshot evidence
- **Lovable (`stitch_02_home.png`)**: **Restaurant section is NOT visible.** Entirely below the fold.
- **Current (`04_home_screen.png`)**: Restaurant section is NOT visible at top viewport position either. It appears in `05_home_merchants_grid.png` (scrolled 120px down) where the section header "أقرب المطاعم إليك" and first restaurant cards begin to appear.

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Visible in first viewport | NO | NO |
| Visible in scrolled view | Not in reference | YES (05_home_merchants_grid.png) |

### What exists in reference
Cannot confirm from `stitch_02_home.png`. Requires a separate scrolled reference screenshot showing the restaurant section.

### What exists in current implementation
Restaurant cards with SVG food illustrations, rating chips, delivery info, and "مفتوح الآن" green dot indicator.

### Estimated impact score
**3 / 10** — Not visible in the reference screenshot, so no diff can be established from this reference. Carries over unknown risk but cannot be scored against Lovable evidence.

---

## COMPONENT 7 — BOTTOM NAVIGATION

### Screenshot evidence
- **Lovable**: At the very bottom of `stitch_02_home.png`, a dark navigation bar shows **5 icon-only slots**. The icons appear as small white/gray outlines, one of which is lime (the active state). No text labels are visible below the icons. The bar appears to be a relatively flat, full-width or near-full-width bar. A separate green circular floating button (WhatsApp/chat) is visible overlaid above the nav on the bottom-left.
- **Current**: A floating pill-shaped navigation bar with visible side margins (`left: 16px; right: 16px`). 5 slots, each containing an icon + Arabic text label ("الرئيسية", "المحفظة", "سلتي", "الطلبات", "حسابي"). Active slot shows lime icon. The pill has a visible border and shadow.

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Width | ~full-width or minimal margins | Width − 32px (16px each side) |
| Height | ~56–64px | ~72px (estimated from visible proportion) |
| Text labels | **None visible** | Arabic label under each icon |
| Active state | Lime icon, no label | Lime icon + lime label |
| Icon count | 5 | 5 |
| Icon style | Simple white outline | Lucide outline icons |
| Shape | Flat bar / minimal pill | Floating pill with clear radius |
| Extra element | Green chat/WhatsApp floating button (separate) | None |
| Background | Dark graphite (~`#16191c`) | Dark graphite |

### What exists in reference
5 icon-only navigation items on a dark flat or near-flat bar. Active item is lime icon only — no text label signals the active state. A chat floating action button (green circle) appears above the nav bar as a separate layer.

### What exists in current implementation
5 icon + label pairs on a floating pill. Labels add a second tier of information that is absent in the Lovable reference. The floating pill shape is more pronounced. No chat floating button.

### Estimated impact score
**7 / 10** — Labels vs. no-labels is a significant visual density difference. The text under each icon adds ~16px of height and visual noise absent in the Lovable reference. Shape difference (pill vs. flat bar) is visible but secondary. The missing chat floating button is a separate affordance entirely.

---

## COMPONENT 8 — BACKGROUND

### Screenshot evidence
- **Lovable**: Near-black background. In the hero area, a very faint dark forest/olive green atmospheric gradient is visible in the upper-left quadrant — it is subtle, like a spotlight, not a bright glow. The overall screen reads as black. No visible diagonal lines, sweeps, or animations.
- **Current**: Near-black background base. The body CSS includes: (a) a conic-gradient mesh pattern, (b) a lime radial orb at ~8% opacity visible as a slightly greenish cast in the center-to-upper area, (c) an animated silver diagonal sweep (`body::before`), (d) SVG fractal noise texture (`body::after`). The combination creates a slightly more complex background than the reference.

### Measurements

| Property | Lovable | Current |
|---|---|---|
| Base color | Near-black (~`#0b0e0f`) | Near-black (`oklch(0.08 0.005 250)`) |
| Green atmospheric tint | Dark olive/forest, very subtle, upper-left area | Lime radial orb at 8% opacity, centered |
| Tint intensity | Very low — atmospheric | Moderate — perceptibly greenish |
| Silver/white elements | None | Animated diagonal sweep every 16s |
| Noise texture | None visible | SVG fractal noise at ~6% |
| Animation | None (static) | `bg-drift 24s` + `bg-shine 16s` |
| Lime percentage of background | Minimal (<2%) | Moderate (lime orb visible) |

### What exists in reference
A static near-black background with a soft, barely-there dark green tint in the upper portion — reinforcing the "dark luxury" feel without any active visual elements competing for attention.

### What exists in current implementation
A near-black background with multiple layered effects: a perceptible lime green halo, a periodic light sweep animation, and a noise texture. These layers add visual complexity that distracts from the foreground content.

### Estimated impact score
**5 / 10** — The base tone is correct (near-black). The differences are in subtlety and density. The lime orb (8% opacity) is visible and makes the background slightly chromatic where the reference is nearly neutral. The animated sweep is the largest divergence — any animation on the background draws peripheral attention away from content.

---

## OVERALL IMPACT SUMMARY

| # | Component | Impact Score | Primary Gap |
|---|---|---|---|
| 1 | Header | **9 / 10** | Brand text "HAAT NOW" replaced by delivery location |
| 2 | Hero Banner | **10 / 10** | 200px compact pizza banner vs. ~400px Platinum card hero |
| 3 | Search Bar | **6 / 10** | Prominent lime chip + above-fold position vs. minimal below-fold |
| 4 | Categories | **8 / 10** | Fully visible above fold (Lovable: not visible in first screen) |
| 5 | Offers | **5 / 10** | Partially visible (Lovable: not visible in first screen) |
| 6 | Restaurant Section | **3 / 10** | Cannot validate against reference (not in first viewport) |
| 7 | Bottom Navigation | **7 / 10** | Labels present (Lovable: icons only, no labels) |
| 8 | Background | **5 / 10** | Lime orb + animation vs. static near-black |

**Weighted total gap**: The two highest-impact items (Hero + Header) account for most of the visual divergence.

---

## ROOT CAUSE ANALYSIS

The Lovable design philosophy for the home screen is:

> **One screen, one message.** The entire first viewport is dedicated to the Platinum hero. Everything else is below the fold.

The current implementation follows a different philosophy:

> **Information density.** Multiple sections are packed into the first viewport — hero, search, categories, partial offers.

This is not a styling difference — it is a **structural difference** in layout strategy. Fixing individual component styles (border-radius, glow, shadow) will not close the visual gap. The gap starts at the hero height and cascades to everything below it.

---

## COMPONENTS THAT CANNOT BE VALIDATED FROM THIS REFERENCE ALONE

The following sections are not visible in `stitch_02_home.png` (below the fold in Lovable):
- Category tile design (shape, material, icons)
- Offer card design (height, illustration style, gradient direction)
- Restaurant card design (image height, border-radius, meta info layout)

To validate these sections, a reference screenshot showing the Lovable home screen scrolled down is needed. If no such screenshot exists, `HAAT-NOW-DESIGN-SPEC.md` is the fallback authority for those sections.

---

*No code was modified. Awaiting approval.*
