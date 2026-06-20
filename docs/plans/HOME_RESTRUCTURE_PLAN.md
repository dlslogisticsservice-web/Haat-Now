# HOME RESTRUCTURE PLAN
**Layout hierarchy — hero-first, luxury premium feel**

> No code was modified to produce this plan.
> Scope: HomeScreen layout and hero content only.
> Constraints preserved: delivery location header, bottom nav labels, functional UX.

---

## PART 1 — CURRENT LAYOUT

### Y-position map (viewport = 852px, header = 56px sticky, main has `pt-6` = 24px)

```
y=0   ┌─────────────────────────────────┐
      │  STICKY HEADER   56px           │  ← delivery location, user icon
y=56  ├─────────────────────────────────┤
      │  pt-6 padding    24px           │
y=80  ├─────────────────────────────────┤
      │                                 │
      │  HERO BANNER    200px  (23%)    │  ← pizza SVG, "خصم 25%", compact
      │                                 │
y=280 ├─────────────────────────────────┤
      │  mb-3 gap        12px           │
y=292 ├─────────────────────────────────┤
      │  SEARCH BAR      52px  (6%)     │  ← silver metallic, lime chip
y=344 ├─────────────────────────────────┤
      │  mb-4 gap        16px           │
y=360 ├─────────────────────────────────┤
      │  CATEGORIES                     │
      │  row 1  ~80px                   │  ← 4 circular tiles
      │  row 2  ~80px                   │  ← 4 circular tiles
      │  total ~170px  (20%)            │
y=530 ├─────────────────────────────────┤
      │  mb-3 gap        12px           │
y=542 ├─────────────────────────────────┤
      │  OFFERS HEADER   42px           │
y=584 ├─────────────────────────────────┤
      │  OFFER CARD     178px  (top)    │  ← partially visible
y=762 │  ...                            │
      │                                 │
y=852 └─────────────────────────────────┘  FOLD
      │  (rest scrolled)                │
      │  RESTAURANTS                    │
      │  FEATURED STORES                │
      │  BENEFITS                       │
```

### Summary: what is above the fold today

| Component | Y-start | Visible at fold | % of viewport |
|---|---|---|---|
| Header | 0 | YES | 7% |
| Hero | 80 | YES (full) | 23% |
| Search | 292 | YES (full) | 6% |
| Categories | 360 | YES (full — both rows) | 20% |
| Offers header | 542 | YES | 5% |
| Offer card | 584 | YES (partial) | ~20% |
| **Total above fold** | — | **5 distinct sections** | **~81%** |

**Problem**: The home screen reads like an information-dense app grid. The hero has the same visual weight as the categories below it. Nothing commands attention. The premium Platinum content is crammed into 200px.

---

## PART 2 — TARGET LAYOUT

### Design intent from user instruction

> "Home screen must be hero-first. Hero section should occupy roughly 45–55% of the first viewport. Search bar should appear directly after hero. Categories should start below the fold. Focus on premium luxury feeling, not discount-store feeling."

### Strategy

Two changes only:
1. **Remove `pt-6` from `<main>` in App.tsx** — eliminates the 24px dead space between header and hero, so the hero starts immediately at the header bottom.
2. **Expand hero from 200px → 440px** in HomeScreen.tsx — and update the hero's inner content to fill the taller space properly.

### Y-position map (after changes, viewport = 852px, header = 56px sticky, main has `pt-0`)

```
y=0   ┌─────────────────────────────────┐
      │  STICKY HEADER   56px           │  ← unchanged
y=56  ├─────────────────────────────────┤
      │                                 │
      │                                 │
      │                                 │
      │  HERO BANNER    440px  (52%)    │  ← expanded, premium content
      │                                 │
      │                                 │
      │                                 │
y=496 ├─────────────────────────────────┤
      │  mb-3 gap        12px           │
y=508 ├─────────────────────────────────┤
      │  SEARCH BAR      52px  (6%)     │  ← unchanged
y=560 ├─────────────────────────────────┤
      │  mb-4 gap        16px           │
y=576 ├─────────────────────────────────┤
      │  CATEGORIES (row 1)   ~80px     │  ← tiles peek at bottom of screen
y=656 │  CATEGORIES (row 2)   ~80px     │  ← below fold
y=852 └─────────────────────────────────┘  FOLD
      │  (rest scrolled)                │
      │  OFFERS                         │
      │  RESTAURANTS                    │
      │  FEATURED STORES                │
      │  BENEFITS                       │
```

### Summary: what is above the fold after restructure

| Component | Y-start | Visible at fold | % of viewport |
|---|---|---|---|
| Header | 0 | YES | 7% |
| Hero | 56 | YES (full) | **52%** |
| Search | 508 | YES (full) | 6% |
| Categories row 1 | 576 | YES (partial — top edge only) | ~10% |
| Categories row 2 | 656 | NO | 0% |
| Offers | ~780+ | NO | 0% |
| **Total above fold** | — | **Hero + Search + hint of cats** | **~65%** |

### Why categories "start below fold" but row 1 is still visible

At 52% hero height (440px), category row 1 starts at y=576. The first tile tops are visible (~35% of row 1 peek in). Row 2 and everything below is completely off-screen.

To push categories **fully** below fold, hero would need to be ~680px (~80% of viewport). That exceeds the 45–55% instruction. The plan honors the 45–55% constraint: categories are **dramatically lower** than today (y=360 → y=576) and the tiles only hint at the edge, reinforcing the scroll invitation.

---

## PART 3 — HERO CONTENT CHANGES

The hero must fill 440px with premium content. It cannot just be the same 200px content scaled up — that would leave empty dark space.

### Current hero content (fits in 200px, text column at `justifyContent: center`)

```
[VIP gold chip]  [Platinum ⓟ chip]
احصل على خصم
[lime 25%] الآن
عرض حصري لأعضاء Platinum فقط
[استفد الآن CTA]
```

### Target hero content (fills 440px, aligned to `justifyContent: space-between` with top/bottom anchoring)

```
[PLATINUM EXCLUSIVE ★ lime chip]           ← top of text column

ارتق بتجربتك
مع HAAT NOW Platinum                       ← 2-line headline, ~28–30px
                                            (replaces discount-focused "خصم 25%")

توصيل فاخر غير محدود،                     ← 3-line body text, ~13px gray
خصومات حصرية وأولوية
في الطلب

[اطلب الآن CTA]                            ← bottom of text column
```

### Illustration

The pizza SVG is kept as-is for now (replacing with a dark premium card image requires an asset that doesn't exist in the codebase). The illustration will be repositioned for the taller container — it currently overflows 200px; at 440px it will fill naturally without needing overflow margins.

---

## PART 4 — AFFECTED COMPONENTS

### What CHANGES

| # | Component | Location | What changes |
|---|---|---|---|
| 1 | `<main>` top padding | `App.tsx:298` | `pt-6` → `pt-0` (removes 24px dead space above hero) |
| 2 | Hero height | `HomeScreen.tsx:317` | `height: '200px'` → `height: '440px'` |
| 3 | Hero text column | `HomeScreen.tsx:344` | `justifyContent: 'center'` → `justifyContent: 'space-between'`, `padding: '24px 18px 24px 0'` |
| 4 | Hero badge | `HomeScreen.tsx:346–354` | Replace VIP + Platinum dual chips with single "PLATINUM EXCLUSIVE ★" lime chip |
| 5 | Hero headline | `HomeScreen.tsx:356–360` | Change from "احصل على خصم / 25% الآن" → "ارتق بتجربتك / مع HAAT NOW Platinum", size 28–30px |
| 6 | Hero body text | `HomeScreen.tsx:361` | Expand sub-line to 3 lines of benefit copy |
| 7 | Hero CTA label | `HomeScreen.tsx:367` | "استفد الآن" → "اطلب الآن" |
| 8 | Hero illustration | `HomeScreen.tsx:333–335` | Adjust positioning for 440px container (remove overflow hacks) |
| 9 | Hero glow orbs | `HomeScreen.tsx:326–330` | Scale glow positions for taller card |
| 10 | Hero background | `HomeScreen.tsx:317` | Change gradient from `135deg` → `180deg` (vertical per spec) |

### What does NOT change

| Component | Reason |
|---|---|
| Header content | User instruction: keep delivery location |
| Bottom nav labels | User instruction: keep labels |
| Search bar (content, height, material) | Layout position changes only (due to hero expansion) |
| Categories (tiles, icons, glow, grid) | No visual changes — just pushed lower by hero expansion |
| Offers section | No changes — pushed lower |
| Restaurant cards | No changes — pushed lower |
| Featured Stores section | No changes |
| Benefits section | No changes |
| All data fetching / Supabase logic | Not touched |
| All navigation / routing | Not touched |
| Wallet, Profile, Restaurant, Orders screens | Not touched |

---

## PART 5 — ESTIMATED FILES

| File | Change type | Lines affected | Risk |
|---|---|---|---|
| `src/App.tsx` | 1 CSS class word removed | Line 298 | Very low — removes padding only |
| `src/features/home/HomeScreen.tsx` | Hero section inner content | Lines 308–372 | Low — visual only, no logic change |

**Total files: 2**
**Total sections changed: 1 (hero banner only)**
**Business logic touched: None**

---

## PART 6 — BEFORE / AFTER COMPARISON

### First viewport impression

| Aspect | Before | After |
|---|---|---|
| First thing user sees | Compact pizza banner (23% of screen) | Immersive Platinum promo (52% of screen) |
| Visual hierarchy | 5 competing sections fighting for attention | Hero dominates, everything else is secondary |
| Premium signal | Discount ("25% off") | Membership ("ارتق بتجربتك مع Platinum") |
| CTA prominence | Small "استفد الآن" button at bottom of 200px card | Prominent "اطلب الآن" with room to breathe in 440px card |
| Content below fold | Restaurants, Featured, Benefits | Categories row 2, Offers, Restaurants, Featured, Benefits |
| Scroll invitation | None — all content is visible | Hero + search + hint of categories → user knows there's more |

---

## PART 7 — IMPLEMENTATION SEQUENCE

If approved, changes will be applied in this order:

1. **`App.tsx` line 298**: Remove `pt-6` (change `pt-6` to `pt-0`) — 30 seconds, 1 word
2. **`HomeScreen.tsx` hero section** (lines 308–372): 
   - Expand height to 440px
   - Update text column padding/alignment
   - Replace badge chips with single Platinum Exclusive lime chip
   - Update headline copy and size
   - Add 3-line body text
   - Update CTA label to "اطلب الآن"
   - Fix gradient direction to 180deg
   - Adjust illustration and glow positions for taller card

No build configuration changes. No new dependencies. No new files.

---

*No code was modified. Awaiting approval to proceed.*
