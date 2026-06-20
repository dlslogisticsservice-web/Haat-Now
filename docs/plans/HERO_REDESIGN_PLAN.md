# HERO REDESIGN PLAN
**Platinum Membership Hero — Architecture Before Implementation**

> No code was modified to produce this plan.
> Reference: stitch_02_home.png (Lovable) + HAAT-NOW-DESIGN-SPEC.md
> Constraint: Height stays at 200px for now. Plan describes the full architecture.
>             Height increase (440px) is a separate approval step.

---

## 1. CORE CONCEPT SHIFT

| Dimension | Current (pizza) | Target (Platinum) |
|---|---|---|
| Message | "خصم 25% على الطعام" — promotional discount | "ارتق بتجربتك مع Platinum" — membership elevation |
| Emotion | Discount app, fast food | Premium service, luxury access |
| Illustration | Food (pizza SVG) — category-specific | Dark premium card — brand identity |
| Primary color role | Lime = price emphasis | Lime = badge + CTA only; card reads dark |
| Layout correctness | Text RIGHT + illustration RIGHT (collision, scrim required) | Text RIGHT + illustration LEFT (clean two-column split) |
| Headline theme | Discount number (25%) | Membership headline (no prices) |

---

## 2. HERO STRUCTURE

### Two-column layout (RTL-correct)

In RTL (`dir="rtl"`): the logical start is the visual right. Text belongs on visual right. Illustration belongs on visual left.

```
┌─────────────────────────────────────────────────┐
│ HERO CARD (200px current / 440px future)        │
│                                                 │
│  ╔═════════════════╗  ╔══════════════════════╗  │
│  ║                 ║  ║ [PLATINUM EXCLUSIVE★] ║  │
│  ║   PLATINUM      ║  ║                      ║  │
│  ║   CARD SVG      ║  ║  ارتق بتجربتك         ║  │
│  ║   (floating,    ║  ║  مع HAAT NOW          ║  │
│  ║   tilted -15°)  ║  ║  Platinum             ║  │
│  ║                 ║  ║                      ║  │
│  ║                 ║  ║  (body text —        ║  │
│  ║  [dark green    ║  ║   hidden at 200px,   ║  │
│  ║   glow behind]  ║  ║   visible at 440px)  ║  │
│  ║                 ║  ║                      ║  │
│  ║                 ║  ║  [اطلب الآن  ▶]      ║  │
│  ╚═════════════════╝  ╚══════════════════════╝  │
│  CSS: left / 55% width    CSS: right / 52% wide │
└─────────────────────────────────────────────────┘
```

### Column specifications

| Column | CSS position | Width | Content |
|---|---|---|---|
| Illustration | `left: -12px` (bleeds off left edge) | `55%` | PlatinumCardIllustration SVG |
| Text | `right: 0` | `52%` | Badge + headline + body + CTA |
| Overlap zone | Center 7% | — | Columns overlap here — scrim not needed; card is dark |

### Key structural rule
The current implementation puts both the illustration and the text column on `right`. This forces a dark scrim to separate them. The redesign separates them cleanly: illustration on `left`, text on `right`. No scrim needed. The dark card surface naturally recedes.

---

## 3. TYPOGRAPHY HIERARCHY

Four distinct levels, each with a clear visual weight:

### Level 1 — Badge (topmost)

```
[PLATINUM EXCLUSIVE ★]
```

| Property | Value |
|---|---|
| Text | `PLATINUM EXCLUSIVE ★` |
| Font size | `10–11px` |
| Font weight | `800` |
| Letter spacing | `0.10em` (wide tracking, luxury feel) |
| Case | `uppercase` (Latin/mixed) |
| Color | `var(--color-primary-fixed)` = lime `#9ed442` |
| Background | Transparent with `1px solid rgba(163,249,91,0.50)` border |
| Padding | `3px 12px` |
| Border radius | `99px` (full pill) |
| Shadow | `0 0 14px rgba(163,249,91,0.45)` — lime glow only (no black shadow, Z5 law) |
| Position | Top of text column, visually first element |

Difference from current: Current shows "VIP" (gold) + "Platinum ⓟ" (gray) dual chips — two competing chips with different color families. Target shows ONE chip: lime, singular, matching Lovable reference exactly.

---

### Level 2 — Headline

```
ارتق بتجربتك
مع HAAT NOW Platinum
```

| Property | Current | Target |
|---|---|---|
| Text | "احصل على خصم / [25%] الآن" | "ارتق بتجربتك / مع HAAT NOW Platinum" |
| Theme | Discount (transactional) | Membership (aspirational) |
| Font size | 23px + 28px lime "25%" | `26–28px` uniform, weight 900 |
| Color | Mixed (white + lime for number) | `#f2f4f6` white — no lime in headline |
| Line count | 2 | 2 |
| Letter spacing | `-0.03em` | `-0.03em` (unchanged) |
| Lime in headline | Yes — number "25%" in lime | **No** — lime reserved for badge + CTA only |
| Shadow | `0 0 28px rgba(163,249,91,0.65)` on "25%" | None — clean white text, no glow |

The headline must not contain lime. Lime in the headline dilutes the badge and CTA. The white headline on dark background is the premium tone.

---

### Level 3 — Body text (hidden at 200px, visible at 440px)

```
توصيل فاخر غير محدود،
خصومات حصرية وأولوية
في الطلب
```

| Property | Value |
|---|---|
| Text | 3 lines explaining Platinum benefits |
| Font size | `13px` |
| Font weight | `400–500` |
| Color | `rgba(170,176,182,0.85)` — muted gray |
| Line height | `1.55` |
| Visibility at 200px | Hidden (overflow: hidden on card) |
| Visibility at 440px | Fully visible (when height increase is approved) |

Body text is planned now but will only render visibly after the height increase. At 200px it exists in the DOM but is cropped by the card's `overflow: hidden`.

---

### Level 4 — CTA Button

```
[ اطلب الآن  ▶ ]
```

| Property | Current | Target |
|---|---|---|
| Label | "استفد الآن" | "اطلب الآن" |
| Height | `38px` | `38px` (unchanged at 200px) |
| Padding | `0 20px` | `0 22px` |
| Background | `var(--color-primary-fixed)` | `var(--color-primary-fixed)` |
| Text color | `#0c2000` | `#0c2000` |
| Font weight | `800` | `800` |
| Border radius | `19px` (pill) | `19px` (pill) |
| Shadow | lime glow + black drop shadow | **lime glow only**: `0 0 20px rgba(163,249,91,0.55)` — no black shadow (Z5 law) |
| Animation | `animate-pulse-glow` | `animate-pulse-glow` (unchanged) |
| Width | `alignSelf: flex-start` | `alignSelf: flex-start` (not full-width) |

The CTA label change ("استفد الآن" → "اطلب الآن") directly matches the Lovable reference text.

---

## 4. ILLUSTRATION STRATEGY

### Replace `HeroIllustration()` with `PlatinumCardIllustration()`

The pizza SVG (`HeroIllustration`) is replaced with a new `PlatinumCardIllustration` SVG component. No external asset needed — fully inline SVG.

### Card design anatomy

```
┌─ Card outer container (viewBox 0 0 200 260) ──────────────────┐
│                                                               │
│   [Dark green atmospheric glow — large radial, behind card]   │
│                                                               │
│       ┌────────────────────────────────────┐                  │
│       │  Dark card face (rotate -15°)      │                  │
│       │  ┌──────────────────────────────┐  │                  │
│       │  │ gradient: #0a1208 → #14201a  │  │ ← card body     │
│       │  │                              │  │                  │
│       │  │ [EMV chip: gold rect 22×18]  │  │ ← chip          │
│       │  │                              │  │                  │
│       │  │ ══════════════════════════   │  │ ← holographic   │
│       │  │  (lime-tinted stripe strip)  │  │   strip         │
│       │  │                              │  │                  │
│       │  │ ·  ·  ·  ·  ·  ·  ·  ·  ·  │  │ ← card number   │
│       │  │          HAAT NOW            │  │   dots          │
│       │  │          PLATINUM            │  │ ← brand text    │
│       │  └──────────────────────────────┘  │                  │
│       │  [floor reflection ellipse]        │                  │
│       └────────────────────────────────────┘                  │
│   [Drop shadow ellipse below card]                            │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Card visual specifications

| Element | Value |
|---|---|
| Card shape | `<rect>` with `rx="14"` — rounded corners |
| Card dimensions | ~165×105 in SVG units |
| Card rotation | `rotate(-15, cx, cy)` — slight left-tilt, floating feel |
| Card body gradient | `linear-gradient(160deg, #13201a 0%, #0a1208 50%, #060d09 100%)` — very dark green/black |
| Card top-edge specular | `rgba(255,255,255,0.12)` 1px line along top edge |
| Card side-edge specular | `rgba(255,255,255,0.06)` on right and left edges |
| EMV chip | Gold `#c8a830` rect, `22×18` SVG units, `rx=3`, slight shadow |
| Holographic strip | Horizontal band across card center, `linear-gradient(90deg, transparent, rgba(163,249,91,0.15), rgba(163,249,91,0.28), rgba(163,249,91,0.10), transparent)` |
| Card number | 4 groups of dot clusters (`·  ·  ·  ·`) in `rgba(255,255,255,0.30)` |
| "HAAT NOW" text | `font-size="8"`, fill `rgba(255,255,255,0.50)`, lower-right area |
| "PLATINUM" text | `font-size="7"`, fill `rgba(163,249,91,0.60)`, below HAAT NOW |
| Atmospheric glow | `<radialGradient>` behind card: `rgba(15,55,25,0.70)` center → transparent — dark forest green, NOT lime |
| Drop shadow | `<ellipse>` below card, `rgba(0,0,0,0.55)`, blurred |
| Floor reflection | Faint `<rect>` below card, `rgba(163,249,91,0.06)` — barely visible |
| Float animation | `animate-float` class (`translateY: 0 → -6px → 0`, 4s) |

### Why a card, not food imagery

1. The Lovable reference (`stitch_02_home.png`) shows exactly this — a dark floating card, not food.
2. The hero message is "Platinum membership" — the product being promoted is the membership tier, not a specific dish.
3. Food imagery is used on restaurant cards (below the fold). Using it in the hero creates category confusion.
4. A dark premium card reinforces the luxury fintech-style aesthetic of the app's Platinum tier.
5. The card can be built entirely in SVG — no external assets required.

---

## 5. BACKGROUND STRATEGY

### Current hero background (problems)

```css
background: linear-gradient(135deg, #0d2808 0%, #061504 55%, #0a0c08 100%)
```

Problems:
1. `135deg` — diagonal gradient (HAAT-NOW-DESIGN-SPEC §3: card body must be `180deg`)
2. Lime glow orbs: top-right `rgba(163,249,91,0.38)` + secondary `rgba(163,249,91,0.18)` — too bright, competes with badge + CTA
3. Gold accent glow: `rgba(210,165,40,0.22)` — third color family, dilutes focus

### Target hero background

```css
background: linear-gradient(180deg, #0d1a0b 0%, #060f06 55%, #050808 100%)
```

| Layer | Color | Purpose |
|---|---|---|
| Base gradient | `180deg, #0d1a0b → #050808` | Near-black with very dark forest green undertone, top-light only |
| Single green orb | `rgba(14,50,20,0.45)` at `top-left`, blur 80px | Soft atmospheric depth behind text, NOT behind card |
| Border top | `rgba(255,255,255,0.14)` | Elevation top-edge (Z3 law) |
| Border sides | `rgba(255,255,255,0.07)` | Z3 side edges |
| Border bottom | `rgba(255,255,255,0.03)` | Z3 bottom (nearly invisible) |
| Box shadow outer | `0 20px 55px rgba(0,0,0,0.70)` | Card depth on page |

### What is removed from current hero

| Element | Reason for removal |
|---|---|
| Top-right lime glow `rgba(163,249,91,0.38)` | Competing with badge + CTA; lime reserved for interactive elements |
| Secondary lime shimmer `rgba(163,249,91,0.18)` | Same reason — 3 lime elements in a 200px card is too many |
| Gold accent glow `rgba(210,165,40,0.22)` | Third color family not needed; no gold in updated badge design |
| 135° diagonal gradient | Replaced with 180° vertical per spec |

### What the atmospheric green provides vs what it must NOT do

| Must provide | Must NOT do |
|---|---|
| Depth and warmth in the dark background | Glow that reads as lime/green tint |
| Sense of premium dark luxury | Compete with the badge chip's lime |
| Gentle differentiation from page background | Be bright enough to distract from CTA button |
| The "forest/premium" tone of Lovable reference | Animate (static only) |

Target opacity for atmospheric glow: `0.35–0.45` maximum. If it reads as green color, it is too strong.

---

## 6. CTA PLACEMENT

### Current placement issue

The CTA is `alignSelf: flex-start` within a column that has `justifyContent: center`. At 200px card height, the entire text block floats in the middle, and the CTA appears in the middle-to-lower portion of the card without anchoring to the bottom.

### Target CTA placement

At 200px, the text column layout shifts from `justifyContent: center` to `justifyContent: space-between` with explicit `paddingTop` and `paddingBottom`, so:

- Badge: anchored to the **top** of text column
- Headline: directly below badge
- Body text: middle (hidden at 200px via overflow)
- CTA: anchored to the **bottom** of text column

This ensures the CTA is always visible at the bottom edge, even when body text is hidden, giving the card a top-and-bottom anchor that reads as intentional layout, not floating content.

```
TEXT COLUMN at 200px (with space-between + padding):

┌─ text column ──────────────────────┐  ← paddingTop: 20px
│ [PLATINUM EXCLUSIVE ★]             │  ← badge at top
│                                    │
│ ارتق بتجربتك                       │  ← headline line 1
│ مع HAAT NOW Platinum               │  ← headline line 2
│                                    │
│   (body text hidden by overflow)   │
│                                    │
│ [اطلب الآن  ▶]                    │  ← CTA at bottom
└────────────────────────────────────┘  ← paddingBottom: 20px
```

```
TEXT COLUMN at 440px (when height increase approved):

┌─ text column ──────────────────────┐  ← paddingTop: 28px
│ [PLATINUM EXCLUSIVE ★]             │  ← badge
│                                    │
│ ارتق بتجربتك                       │  ← headline (28px, bolder)
│ مع HAAT NOW Platinum               │
│                                    │
│ توصيل فاخر غير محدود،               │  ← body text (3 lines visible)
│ خصومات حصرية وأولوية               │
│ في الطلب                           │
│                                    │
│ [اطلب الآن  ▶]                    │  ← CTA
└────────────────────────────────────┘  ← paddingBottom: 28px
```

---

## 7. MOBILE VIEWPORT PROPORTIONS

### At current 200px height

```
Phone screen (393 × 852px, header = 56px)

y=0   ┌───────────────────────────┐
      │       HEADER   56px       │  delivery location (unchanged)
y=56  ├───────────────────────────┤
      │                           │
      │   HERO BANNER   200px     │  Platinum card, badge, headline, CTA
      │   (23% of viewport)       │
      │                           │
y=256 ├───────────────────────────┤
      │    SEARCH BAR   52px      │  silver metallic
y=308 ├───────────────────────────┤
      │   CATEGORIES   ~170px     │  circular tiles (both rows visible)
y=478 ├───────────────────────────┤
      │   OFFERS       ~240px     │  partially visible
y=718 │   ...                     │
y=852 └───────────────────────────┘  FOLD

Visible at fold: Header + Hero + Search + Categories + Offers (partial)
Hero occupies 23% of viewport — unchanged until height step is approved.
```

Content visible at 200px within the hero:
- ✅ Badge: visible
- ✅ Headline (2 lines): visible (font 24px to fit)
- ✅ CTA: visible (anchored to bottom)
- ❌ Body text: hidden (overflow: hidden on card)
- ✅ Card illustration: upper 65% of card visible, enough to read as a card

### At approved 440px height (future step, for reference only)

```
Phone screen (393 × 852px, header = 56px, main pt-0)

y=0   ┌───────────────────────────┐
      │       HEADER   56px       │  delivery location (unchanged)
y=56  ├───────────────────────────┤
      │                           │
      │                           │
      │   HERO BANNER   440px     │  full Platinum hero — badge, headline,
      │   (52% of viewport)       │  3-line body text, CTA, full card visible
      │                           │
      │                           │
      │                           │
y=496 ├───────────────────────────┤
      │    SEARCH BAR   52px      │
y=548 ├───────────────────────────┤
      │   CATEGORIES row 1        │  just starting to peek in (~576px)
y=576 │   ...                     │
y=852 └───────────────────────────┘  FOLD

Categories row 2 and Offers are fully below the fold.
```

---

## 8. COMPLETE COMPONENT DIFF

### What the `home_hero` section contains after redesign

| Sub-element | Current | Target |
|---|---|---|
| Component name | `HeroIllustration()` pizza SVG | `PlatinumCardIllustration()` card SVG |
| Illustration position | CSS `right: -20px` (visual right) | CSS `left: -12px` (visual left) |
| Illustration size | `width: 62%, height: 135%` (overflow) | `width: 58%, height: 115%` (gentle bleed) |
| Background gradient | `135deg, #0d2808...` | `180deg, #0d1a0b...` |
| Glow orbs | 3 orbs: 2 lime + 1 gold | 1 orb: dark forest green only |
| Text column position | CSS `right: 0` (visual right) | CSS `right: 0` (visual right — unchanged) |
| Text column layout | `justifyContent: center` | `justifyContent: space-between` + padding |
| Badge | "VIP" gold + "Platinum ⓟ" gray (2 chips) | "PLATINUM EXCLUSIVE ★" lime (1 chip) |
| Headline | "احصل على خصم / [25%] الآن" | "ارتق بتجربتك / مع HAAT NOW Platinum" |
| Headline size | 23px + 28px mixed | 24px uniform (200px); 28px (440px) |
| Lime in headline | Yes (the "25%" number) | **No** — headline is white only |
| Body text | 1 gray sub-line (11px) | 3 lines of benefit copy (13px) |
| CTA label | "استفد الآن" | "اطلب الآن" |
| CTA shadow | lime glow + black drop shadow | lime glow only (no black shadow) |
| Dark scrim | Required (both columns on same side) | **Not required** (columns separated) |
| Specular top line | Lime 40% + white 22% | White only 28% — no lime in background |
| Card height | 200px | 200px (now); 440px (future step) |
| Card border-radius | `24px` | `24px` (unchanged) |
| Overflow | `hidden` | `hidden` (unchanged) |

---

## 9. FILES THAT WILL CHANGE (when approved)

| File | What changes | What stays |
|---|---|---|
| `src/features/home/HomeScreen.tsx` | Replace `HeroIllustration` function + update hero section JSX | All other sections (search, categories, offers, restaurants, benefits) |
| `src/App.tsx` | Nothing in this step | Everything |

The hero redesign is self-contained within `HomeScreen.tsx`. The `HeroIllustration` function (lines 109–139) is replaced with `PlatinumCardIllustration`. The hero section JSX (lines 307–372) is updated for layout, background, text, and badge changes.

---

## 10. IMPLEMENTATION ORDER (after approval)

1. Add `PlatinumCardIllustration()` function — new SVG component replacing `HeroIllustration()`
2. Update hero background: `135deg` → `180deg`, remove 3 glow orbs, add single dark-green atmospheric orb
3. Move illustration from CSS `right` to CSS `left`
4. Update text column: `justifyContent: space-between` + top/bottom padding
5. Replace dual badge chips with single "PLATINUM EXCLUSIVE ★" lime chip
6. Update headline text and remove lime from headline
7. Add 3-line body text (will be hidden at 200px by overflow, visible at 440px)
8. Update CTA label "استفد الآن" → "اطلب الآن" and remove black shadow
9. Remove dark scrim (no longer needed — columns are separated)
10. Update specular line: remove lime, keep white only

This order ensures each step is independently reversible.

---

*No code was modified. Awaiting approval to implement.*
