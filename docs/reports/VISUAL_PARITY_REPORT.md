# VISUAL PARITY REPORT
**HAAT NOW Phase 2 — Current Implementation vs. Lovable Reference**

> Authority hierarchy applied: Lovable screenshots > VISUAL_BIBLE.md > HAAT-NOW-DESIGN-SPEC.md
> Reference screenshots: `../screenshots/02_home.png`, `../screenshots/stitch_02_home.png`, `../screenshots/stitch_03_restaurant.png`, `../screenshots/stitch_05_orders.png`
> Current screenshots: `screenshots/04_home_screen.png`, `screenshots/05_home_merchants_grid.png`, `screenshots/06_wallet_screen.png`, `screenshots/07_profile_screen.png`
> No code was modified to produce this report.

---

## SECTION 1 — HEADER

**Match: 30%**

### What is identical
- Both have a header bar pinned to the top of the screen.
- Both have an action element on the left side (icon button).
- Both have a right-side element.
- Dark/graphite background surface on the header.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Center content | "HAAT NOW" app name in white/chrome text | "التوصيل إلى / البيت، الرياض" location name |
| Left element | Circular profile avatar icon | Circular profile icon (similar) |
| Right element | Hamburger/menu lines icon | Lime-outlined green status dot circle |
| Typography | "HAAT NOW" appears in chrome/silver gradient text, Inter/Latin font, heavy weight | Location text in Arabic, 14px, 700 weight |
| Height | Appears ~56px | 56px |
| Header shows brand | Yes — "HAAT NOW" is always visible | No — brand is replaced by delivery location |

### CSS/Layout reasons
The App.tsx header (`src/App.tsx:261–293`) renders delivery location as the center element. The Lovable reference uses the app name as the persistent center identity anchor. The right-side status dot (`10×10px lime circle`) replaces what should be a hamburger/settings icon. Lovable's "HAAT NOW" appears to use the chrome gradient (`#e8e9eb → #b1b2b4 → #7d7f83`) from VISUAL_BIBLE §7.

---

## SECTION 2 — SEARCH BAR

**Match: 55%**

### What is identical
- Present on the home screen.
- Positioned below the header and hero content.
- Contains a search icon on one side.
- Dark/graphite backdrop contrasts with the background.
- Arabic placeholder text referencing searching for restaurants/items.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Material | Appears as a relatively simple rounded dark pill with subtle border | Polished silver metallic (`#6c7480 → #4e5359`), pronounced specular sheen, three-level border brightness |
| Icon treatment | Search icon appears as a simple outline icon | Lime-filled square chip (`38×38px`) with neon glow (`0 0 18px rgba(163,249,91,0.50)`) |
| Icon size | ~20px outline icon | 18px inside a 38px lime-filled rounded square |
| Right side button | Not clearly visible in reference | "فلاتر" lime-colored text button |
| Placeholder text | "ما الذي تريد اليوم؟" (what do you want today?) | "ماذا تريد اليوم؟ مطاعم، أكلات، متاجر..." |
| Height | ~48px estimated | 52px |

### CSS/Layout reasons
The current silver metallic implementation (VISUAL_BIBLE §4 compliant — "polished silver, lighter than surroundings") is directionally correct. The Lovable search icon is a simpler outlined icon, not the large lime-filled tile. The lime chip (`background: var(--color-primary-fixed)`) on the search icon exceeds the lime area budget (VISUAL_BIBLE §1: ≤6%) when combined with other lime elements on the same screen.

---

## SECTION 3 — CATEGORIES

**Match: 20%**

### What is identical
- Categories exist as a section on the home screen.
- Include restaurant, supermarket, pharmacy, coffee, sweets categories.
- Arabic labels below the icons.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Grid columns | **3 columns** (VISUAL_BIBLE §11) | **4 columns** (user instruction override) |
| Tile shape | **Square tiles** with `rounded-2xl` | **Circular** `border-radius: 50%` (user instruction override) |
| Tile content | **Photoreal 3D renders** — burger+fries, grocery basket, pill bottle, floating with floor reflection (VISUAL_BIBLE §11) | **Lucide stroke icons** — UtensilsCrossed, ShoppingCart, Pill etc. |
| Tile size | Size unknown from screenshot; VISUAL_BIBLE implies larger square tiles | `68×68px` circles |
| Icon glow | **None** — "categories are calm; lime is reserved" (VISUAL_BIBLE §11) | Lime neon `drop-shadow(0 0 9px rgba(163,249,91,0.55))` on every icon |
| Icon color | 3D renders (not monochrome) | Lime `var(--color-primary-fixed)` stroke icons |
| Label size | **13px / 600 weight** (VISUAL_BIBLE §11: "label 13/600 white") | **10px / 600 weight** — 23% smaller than spec |
| Label color | White | `rgba(242,244,246,0.82)` — off-white |
| Tile material | Opaque graphite Z3 gradient (VISUAL_BIBLE §8: "Never used for primary cards") | Glass (`backdrop-filter: blur` + lime tint gradient) |
| Tile border | Z3 standard: top `.14`, sides `.07`, bottom `.03` | `border: 1.5px solid rgba(255,255,255,0.14)` uniform |
| Above/below fold | Below the fold on Lovable (hero takes full viewport) | **Above the fold** — visible immediately after compact hero |

### CSS/Layout reasons
Three root causes: (1) User instructed `rounded-full` circular shape in Phase 5 — overrides both specs that say square. (2) `glass` class applied (`backdrop-filter: blur(28px)`) — VISUAL_BIBLE §8 explicitly says glass is never used on primary cards/tiles. (3) `font-size: 10px` label is below both DESIGN-SPEC (11px) and VISUAL_BIBLE (13px). (4) The Lucide icon + lime glow is a DESIGN-SPEC §5 decision; VISUAL_BIBLE §11 requires 3D photorealistic renders which don't exist in the asset library.

---

## SECTION 4 — OFFERS SECTION

**Match: 50%**

### What is identical
- Horizontal scrollable card carousel.
- Dark card background with distinct accent color per banner.
- Large bold discount percentage as the headline number.
- A lime CTA button ("اطلب الآن") on each card.
- Section header with title + "عرض الكل" link.
- Dot pagination indicator below the carousel.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Illustration content | **Photographic food imagery** — real food photos (burger, pizza, etc.) with cinematic dark grading | **Inline SVG illustrations** — geometric pizza/coffee/bag shapes |
| Illustration side (RTL) | Food photo on **visual left** (`left: 0`), text column on **visual right** | Pizza SVG on **visual left** ✓ (offer cards) but hero banner illustration reversed (visual right) |
| Card height | **150–170px** (VISUAL_BIBLE §10) | **178px** — 5–19% taller than spec |
| Card gradient | Background `linear(135deg, ...)` diagonal per VISUAL_BIBLE §3: "never horizontal, **never radial**" | `linear-gradient(135deg, ...)` — **135° diagonal violates VISUAL_BIBLE §3** (must be 180°) |
| Stat title size | "25%", "30%" — appears ~36–40px display weight | **32px** — close but slightly smaller |
| Qualifier text | Small lime badge/chip at top | Small lime text "عرض حصري", uppercase, no chip |
| Accent glow | Subtle radial glow behind illustration | Double radial glow (primary + depth secondary) |
| Card border-radius | 22–28px (Z4 per VISUAL_BIBLE §3: "hero & sheets 28") | 22px |
| CTA black shadow | Lime CTA should have **glow only** (VISUAL_BIBLE §2 Z5 law) | CTA has both `0 0 18px rgba(163,249,91,0.50)` **AND** `0 3px 10px rgba(0,0,0,0.40)` — black shadow violates Z5 |

### CSS/Layout reasons
Primary issue: SVG illustrations vs. photographic imagery. The SVG shapes are functional but lack the cinematic food photography of the Lovable reference. Card backgrounds use `linear-gradient(135deg, ...)` — all card body gradients must be `180deg` per VISUAL_BIBLE §3. The black drop shadow on the lime CTA violates VISUAL_BIBLE §2 Z5 law explicitly.

---

## SECTION 5 — RESTAURANT CARDS

**Match: 60%**

### What is identical
- Card-based list with food imagery area at top.
- Restaurant name displayed prominently.
- Rating badge visible (star + number).
- Delivery ETA and fee shown.
- Dark graphite card body beneath the image.
- A badge/label chip in the corner of the image.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Image content | **Real food photography** (dark-graded) | **SVG geometric illustrations** (RestaurantPhoto component) |
| Image height | ~160px estimated from stitch_03_restaurant.png (`h-40` per DESIGN-SPEC §6) | **168px** — slightly over spec |
| Image gradient | `linear(to top, background, via background/20, transparent)` — fade to dark | `linear(to top, rgba(8,11,14,0.98) 0%, ..., transparent 80%)` — correct direction ✓ |
| Top-image vignette | Not explicitly shown but implied | ✓ Top vignette `linear(to bottom, rgba(0,0,0,0.28), transparent 30%)` |
| Card body gradient | Vertical 180° graphite | `linear-gradient(180deg, #1c2026, #13171a)` ✓ |
| Rating icon color | **Gold star** (referenced in stitch_03_restaurant: star appears orange/gold) | Gold `#f0c840` fill ✓ |
| "مفتوح الآن" indicator | Not clearly visible in ref but implied by live status | ✓ "مفتوح الآن" with lime dot |
| Card shadow | Z3: `0 10px 30px rgba(0,0,0,0.45)` | `0 14px 40px rgba(0,0,0,0.60)` — slightly stronger than Z3 spec |
| Card border-radius | 22px (VISUAL_BIBLE §3: "cards 22") | `rounded-2xl` which resolves to 16px in this Tailwind config |
| Card body info layout | RTL row: ETA / delivery / min order | RTL row: ETA / delivery / min order ✓ similar |
| Cuisine type | Not visible in home view ref | Shown as secondary text |

### CSS/Layout reasons
The primary blocker is SVG vs. photography. The `RestaurantPhoto` SVG fallback provides thematic color but none of the visual richness of real food photography. `rounded-2xl` resolves to 16px in Tailwind v4 but VISUAL_BIBLE §3 specifies 22px for cards — applying explicit `border-radius: 22px` is needed. The card shadow (`0 14px 40px`) slightly exceeds Z3 spec value (`0 10px 30px`) but is an improvement in depth.

---

## SECTION 6 — BOTTOM NAVIGATION

**Match: 45%**

### What is identical
- 5 slots present.
- Icon-based navigation.
- Dark graphite background.
- Active item highlighted in lime.
- Home icon in leftmost position (RTL: rightmost visual).

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Width | **Full-width** — appears edge-to-edge | **Floating pill** — `left: 16px; right: 16px` (32px narrower) |
| Text labels | **Not visible** — icons only in Lovable reference (VISUAL_BIBLE §9 also says color-only active state) | **Labels visible below each icon** ("الرئيسية", "طلباتي", etc.) |
| Nav height | ~72px floating pill (VISUAL_BIBLE §9) | Height defined by CSS; floating pill with inner content |
| Inactive color | `#6e747a` per VISUAL_BIBLE §9 | `var(--color-on-surface-variant)` — approximately correct |
| Active glow | `0 0 8px rgba(158,212,66,0.6)` (VISUAL_BIBLE §9) | CSS via `color-primary-fixed` on active icon |
| Border | Top `rgba(255,255,255,0.10)`, sides `.06` (VISUAL_BIBLE §9) | Implemented via `.bottom-nav` CSS class |
| Shadow | `0 -8px 30px rgba(0,0,0,0.5)` upward (VISUAL_BIBLE §9) | Upward shadow implemented |
| Gradient | `linear(180deg,#16191c,#0c0f11)` (VISUAL_BIBLE §9) | `linear(180deg, #24282c, #0c0f11)` — slightly lighter top |
| Pill shape | Full-width, subtle radius | Floating pill with side margins and `border-radius` |

### CSS/Layout reasons
Two behavioral differences: (1) Text labels — Lovable shows icons only; current shows icon + label. Adding labels increases the nav height and adds a second tier of text that dilutes the "color-only active state" law from VISUAL_BIBLE §9. (2) Width — Lovable nav appears full-width (`inset-x-0`); current has 16px side margins creating the floating pill aesthetic. VISUAL_BIBLE §9 says "floating pill container, full-width minus 16px margins" which matches the current approach — this conflict is resolved in favor of current.

---

## SECTION 7 — BACKGROUND

**Match: 55%**

### What is identical
- Near-black base color (both very dark).
- Subtle atmospheric gradient in the upper region.
- No bright white areas; consistent dark-only palette.
- The home screen background has a faint warm/green tint in the upper area.

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| Base color | Near-black, appears `#0b0e0f` approximately | `oklch(0.08 0.005 250)` ≈ `#0e1114` — very similar |
| Upper gradient | **Dark forest/olive green** tint concentrated upper-left, very subtle | Body `conic-gradient` mesh + `radial-gradient` lime orb at `oklch(0.92 0.22 130 / 0.08)` |
| Lime halo | Very subtle; lime appears only as text/button color, not background | A visible lime green radial glow in the body background — perceptibly greenish |
| Silver sweeps | Not visible in reference | `body::before` animates a diagonal white sweep (`bg-shine 16s`) |
| Noise texture | Not clearly visible | `body::after` adds SVG fractal noise at 6% opacity |
| Animation | Background appears static | `bg-drift 24s` + `bg-shine 16s` CSS animations |
| Dark green in hero | Large dark olive/forest green zone behind the Platinum card | Hero banner uses `#0d2808 → #061504` dark green gradient on a compact 200px card |

### CSS/Layout reasons
The Lovable background is calmer: it reads as near-black with a single concentrated dark green zone in the hero section. The current body background has: (1) an animating conic gradient mesh, (2) a lime radial halo at 8% opacity (visible as a greenish cast), (3) an animating silver sweep overlay, (4) SVG noise. The cumulative effect is a more complex, slightly more chromatic background than the Lovable reference. Per VISUAL_BIBLE §1: lime ≤ 4–6% of screen area — the body lime halo likely exceeds this when combined with in-content lime elements.

---

## SECTION 8 — SPACING & DENSITY

**Match: 35%**

### What is identical
- Content-rich screen — multiple sections within reasonable scroll distance.
- Section headers with title + action link ("عرض الكل") pairs.
- Gap spacing between cards (12–16px).

### What is different

| Property | Lovable Reference | Current Implementation |
|---|---|---|
| First viewport content | **Single hero section** takes up ~65–70% of visible screen | Header (56px) + Hero (200px) + Search (52px) + Categories (2 rows ~160px) = all visible above the fold |
| Hero scale | Platinum hero occupies most of first screen — content-heavy single focus | Compact 200px VIP banner — much less visual weight |
| Above-fold content density | Low (one large, rich hero) | High (4 distinct sections crammed above fold) |
| Categories above fold | **Not visible** in Lovable first viewport | Fully visible in first viewport |
| Offers above fold | Not visible in Lovable first viewport | Partially visible at bottom of first viewport |
| Between-section gaps | Unknown from reference | `mb-3` / `mb-4` (12–16px) — reasonable |
| Search bar vertical position | Below large hero (~65vh from top) | At ~260px from top of page (~30vh) — much higher |
| Padding on main container | Unknown | `pt-6 pb-28 px-4` in `<main>` |
| Content feels | **Premium, spacious, intentional** — single hero demands attention | **Dense, grid-heavy, utilitarian** — multiple competing sections |

### CSS/Layout reasons
The fundamental density gap: the Lovable home screen uses a single large hero to create a premium, magazine-like first impression. The current implementation compresses search + categories + offers all above the fold, creating a more utilitarian "app grid" feel. The `height: 200px` hero banner versus a hero that likely occupies 350–450px in the Lovable reference is the primary driver of this density mismatch. Section gap `mb-3` (12px) and `mb-4` (16px) are reasonable but the overall viewport composition is significantly different.

---

## TOP 20 DIFFERENCES PREVENTING 95% VISUAL PARITY

Ranked by visual impact (highest impact first):

---

### #1 — Hero Scale: Compact Banner vs. Full-Viewport Hero
**Section:** Hero Banner | **Impact:** Critical
- **Lovable:** The Platinum promo occupies ~65–70% of the first viewport (~400–450px tall). It is the undisputed visual anchor of the home screen.
- **Current:** Compact 200px banner — roughly half the Lovable height.
- **Fix needed:** Increase hero height to ~380–420px, or restructure the hero to be a full-first-screen section with the categories pushed below.
- **CSS reason:** `height: '200px'` in `HomeScreen.tsx:310` — needs to become the full remaining viewport height after the 56px header, or at minimum 360px.

---

### #2 — Hero Content: Food SVG vs. Premium Dark Card
**Section:** Hero Banner | **Impact:** Critical
- **Lovable:** Shows a floating dark premium card (appears to be a credit/loyalty card or similar device) with an olive-green glowing aura behind it.
- **Current:** Shows a geometric SVG pizza illustration.
- **Fix needed:** Replace `HeroIllustration` (pizza SVG) with a dark premium card illustration that matches the Platinum VIP theme.
- **CSS reason:** `HeroIllustration` component returns a pizza SVG. The hero's promotional content is "Platinum membership" — the imagery should reinforce premium status, not food.

---

### #3 — Header: App Name vs. Delivery Location
**Section:** Header | **Impact:** High
- **Lovable:** "HAAT NOW" in chrome/silver gradient text is the center anchor of every screen header.
- **Current:** "البيت، الرياض" delivery location replaces the brand name.
- **Fix needed:** Center element should be "HAAT NOW" in chrome gradient text; delivery location can be a secondary element or moved to the hero section.
- **CSS reason:** `App.tsx:277–283` renders location name and map pin icon instead of the brand text.

---

### #4 — Header Right Icon: Status Dot vs. Menu Icon
**Section:** Header | **Impact:** High
- **Lovable:** Right side has a menu/hamburger or settings icon in white/outline.
- **Current:** A lime-outlined circle containing a solid lime 10px dot.
- **Fix needed:** Replace lime status dot with appropriate icon (menu lines or notification bell).
- **CSS reason:** `App.tsx:287–292` renders a lime dot indicator.

---

### #5 — Categories: Circular vs. Square Tiles
**Section:** Categories | **Impact:** High
- **Lovable (VISUAL_BIBLE §11):** Square tiles with `rounded-2xl` radius (~16–22px).
- **Current:** Fully circular `border-radius: 50%` (user-instructed override in Phase 5).
- **Fix needed:** Return to `border-radius: 22px` square tiles.
- **CSS reason:** `HomeScreen.tsx:440` has `borderRadius: '50%'`.

---

### #6 — Categories: 3D Renders vs. Lucide Icons
**Section:** Categories | **Impact:** High
- **Lovable (VISUAL_BIBLE §11):** Photoreal 3D renders of food/items floating with floor reflections.
- **Current:** Lucide stroke icons (UtensilsCrossed, ShoppingCart, etc.).
- **Fix needed:** Either source/create 3D render PNG assets per category or use high-quality flat illustrations. Lucide icons are implementation-acceptable but visually diverge.
- **CSS reason:** `CATEGORY_ICONS` map in `HomeScreen.tsx` returns Lucide components.

---

### #7 — Category Icon Glow: Neon Glow vs. No Glow
**Section:** Categories | **Impact:** High
- **Lovable (VISUAL_BIBLE §11):** "Glow: none. Categories are calm; lime is reserved."
- **Current:** `drop-shadow(0 0 9px rgba(163,249,91,0.55))` on every category icon.
- **Fix needed:** Remove `filter: drop-shadow(...)` from inactive category icons. Apply glow only to the active/selected tile.
- **CSS reason:** `HomeScreen.tsx:451` unconditionally applies lime drop-shadow to all icons.

---

### #8 — Category Material: Glass vs. Opaque Graphite
**Section:** Categories | **Impact:** High
- **Lovable (VISUAL_BIBLE §8):** "Never used for primary cards" — category tiles are opaque graphite Z3 surfaces.
- **Current:** `glass glass-shine` class applied with `backdrop-filter: blur(28px)`.
- **Fix needed:** Remove `glass` class; apply Z3 opaque graphite: `linear-gradient(180deg, #24282c, #15181b)` with Z3 border triplet.
- **CSS reason:** `HomeScreen.tsx:429` applies `className="glass glass-shine"` to each category span.

---

### #9 — Category Label Size: 10px vs. 13px
**Section:** Categories | **Impact:** Medium-High
- **Lovable (VISUAL_BIBLE §11):** "label 13/600 white."
- **Current:** `fontSize: '10px'` — 23% smaller than spec.
- **Fix needed:** Change to `fontSize: '13px'`.
- **CSS reason:** `HomeScreen.tsx:457` has `fontSize: '10px'`.

---

### #10 — Lime CTAs with Black Drop Shadows
**Section:** All CTA buttons | **Impact:** Medium-High
- **Lovable (VISUAL_BIBLE §2 Z5 law):** "Lime elements never carry black shadows. Glow substitutes shadow."
- **Current:** Hero CTA has `boxShadow: '0 0 20px rgba(163,249,91,0.55), 0 4px 12px rgba(0,0,0,0.40)'` — the second value is a black shadow.
- **Fix needed:** Remove the black `rgba(0,0,0,...)` component from all lime CTA box-shadows. Keep only the lime glow.
- **CSS reason:** `HomeScreen.tsx:365` (hero CTA) and offer card CTAs.

---

### #11 — Offer Card Gradient Direction: 135° vs. 180°
**Section:** Offers | **Impact:** Medium-High
- **Lovable (VISUAL_BIBLE §3):** "Body gradient — vertical graphite, light-to-dark, 180°. Never horizontal, never radial."
- **Current:** `background: 'linear-gradient(135deg, #0d2a08 0%, #061403 100%)'` — 135° diagonal.
- **Fix needed:** Change all offer card background gradients to `180deg`.
- **CSS reason:** `STATIC_BANNERS` array in `HomeScreen.tsx:33–36` uses `135deg` for all three banner backgrounds.

---

### #12 — Hero Banner Illustration Side (Reversed)
**Section:** Hero Banner | **Impact:** Medium-High
- **Lovable (VISUAL_BIBLE §10):** Text on visual right (RTL logical start), illustration on visual left.
- **Current:** Hero illustration is positioned on visual right (`right: '-20px'`); text column is also on visual right (both compete for the same space, scrim required).
- **Fix needed:** Move illustration to visual left (`left: -20px`), text column to visual right.
- **CSS reason:** `HomeScreen.tsx:331` has `position: 'absolute', right: '-20px'` for the illustration.

---

### #13 — Bottom Nav: Labels vs. Icons Only
**Section:** Bottom Navigation | **Impact:** Medium
- **Lovable:** Bottom nav shows icons only — no text labels visible. Color is the only active state signal (VISUAL_BIBLE §9).
- **Current:** Each nav item has icon + text label ("الرئيسية", "طلباتي", etc.).
- **Fix needed:** Remove text labels from bottom navigation items; keep icons only.
- **CSS reason:** `App.tsx` bottom nav renders `<span className="nav-item__label">` for each item.

---

### #14 — Restaurant Card Border-Radius: 16px vs. 22px
**Section:** Restaurant Cards | **Impact:** Medium
- **Lovable (VISUAL_BIBLE §3):** "Cards 22" — all card surfaces use 22px radius.
- **Current:** `rounded-2xl` Tailwind class — resolves to 16px in this project's Tailwind v4 config.
- **Fix needed:** Replace `rounded-2xl` with explicit `style={{ borderRadius: '22px' }}` on all restaurant cards.
- **CSS reason:** `rounded-2xl` Tailwind class used throughout restaurant card divs.

---

### #15 — Body Background: Lime Orb Visibility
**Section:** Background | **Impact:** Medium
- **Lovable:** Background reads as near-black. Any green tint is very dark olive/forest, concentrated only in the hero section.
- **Current:** Body background includes `radial-gradient(ellipse 60% 45% at 50% 25%, oklch(0.92 0.22 130 / 0.08), transparent 70%)` — a visible lime green halo over 60% of screen width at 8% opacity, contributing to the greenish cast.
- **Fix needed:** Reduce lime body halo opacity from `0.08` to `0.04` or eliminate it. The green in the hero should come from the hero card's own background, not the body.
- **CSS reason:** `src/index.css` body background-image includes the lime orb at `oklch(0.92 0.22 130 / 0.08)`.

---

### #16 — Background Silver Sweep Animation
**Section:** Background | **Impact:** Medium
- **Lovable:** Background is static (or very subtly drifting). No visible diagonal light sweeps.
- **Current:** `body::before` animates a diagonal white band (`bg-shine 16s ease-in-out infinite`) that sweeps from left to right every 16 seconds.
- **Fix needed:** Remove or disable the `bg-shine` animation on `body::before`. Keep the base gradient static.
- **CSS reason:** `src/index.css` body::before with `animation: bg-shine 16s ease-in-out infinite`.

---

### #17 — Offer Illustration: SVG vs. Photography
**Section:** Offers | **Impact:** Medium
- **Lovable (VISUAL_BIBLE §10):** "Left 55%: cinematic food/vehicle photograph bleeding to edge" — real photography, dark-graded.
- **Current:** Inline SVG geometric shapes (circles for pizza, cup shape for coffee).
- **Fix needed:** Source actual food photography assets, or implement an image slot that can accept real photos. SVG is an acceptable temporary placeholder but is a significant visual difference.
- **CSS reason:** `BannerIllustration` component returns SVG.

---

### #18 — Categories Above-Fold Position
**Section:** Spacing & Density | **Impact:** Medium
- **Lovable:** Categories do not appear in the first viewport. The hero dominates the first screen. Categories are a below-the-fold section.
- **Current:** Categories are fully visible in the first viewport at approximately y=308px from the page top (after 56px header + 24px padding + 200px hero + 8px gap + 52px search + 8px gap = ~348px from top, viewport height 852px so categories fit above fold).
- **Fix needed:** Either increase hero height to push categories below fold, or reorder sections per the Lovable hierarchy.
- **CSS reason:** `HomeScreen.tsx:308–309` renders hero with `height: '200px'`.

---

### #19 — Wallet Balance: Left-Aligned vs. Centered
**Section:** Wallet Screen | **Impact:** Low-Medium
- **Lovable (VISUAL_BIBLE §13):** "balance block centered" — the amount is horizontally centered on the screen.
- **Current:** Balance (`245.50 ر.س`) is left-aligned inside the balance card (flex row alignment not centered).
- **Fix needed:** Add `justifyContent: 'center'` or `textAlign: 'center'` to the balance block in `WalletScreen.tsx`.
- **CSS reason:** `WalletScreen.tsx:179–188` balance block is flex row with no center justification.

---

### #20 — Offer Banner Height: 178px vs. 150–170px
**Section:** Offers | **Impact:** Low
- **Lovable (VISUAL_BIBLE §10):** "height 150–170."
- **Current:** `height: '178px'` — 5–19% taller than the specified range.
- **Fix needed:** Reduce offer card height to 160–165px.
- **CSS reason:** `HomeScreen.tsx` offer card container has `height: '178px'`.

---

## OVERALL PARITY SCORE

| Section | Score |
|---|---|
| Header | 30% |
| Search Bar | 55% |
| Categories | 20% |
| Offers Section | 50% |
| Restaurant Cards | 60% |
| Bottom Navigation | 45% |
| Background | 55% |
| Spacing & Density | 35% |
| **Weighted Overall** | **43%** |

**Current gap to 95% target: ~52 percentage points.**

The three highest-leverage fixes (by visual impact per implementation effort):

1. **Hero height + content** (Differences #1 + #2): Expanding the hero and replacing the pizza SVG with a premium card illustration would close ~15 parity points.
2. **Category shape + material + glow** (Differences #5 + #7 + #8): Returning to square opaque tiles without glow would close ~12 parity points.
3. **Header content** (Differences #3 + #4): Replacing location text with "HAAT NOW" chrome brand mark would close ~8 parity points.

---

*Report generated: 2026-06-18. No code was modified.*
