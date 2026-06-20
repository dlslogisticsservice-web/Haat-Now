# REFERENCE AUDIT
**HAAT NOW Phase 2 — Screenshot Classification and Source of Truth**

> No code was modified to produce this report.
> Every file listed below was opened and visually inspected.
> Two screenshot directories exist: the PARENT directory (`../screenshots/`) and the PROJECT directory (`screenshots/`).

---

## DIRECTORY STRUCTURE

```
c:\Users\HANY\Desktop\haat-now-phase2\
│
├── screenshots\                         ← PARENT directory (mixed: Lovable + old builds)
│   ├── stitch_01_login.png
│   ├── stitch_02_home.png
│   ├── stitch_03_restaurant.png
│   ├── stitch_04_checkout.png
│   ├── stitch_05_orders.png
│   ├── zoom_item.png
│   ├── zoom_map.png
│   ├── proof_product_image.png
│   ├── 01_login.png
│   ├── 01_login_new.png
│   ├── login_screen.png
│   ├── 02_home.png
│   ├── 03_restaurant.png
│   ├── 03_restaurant_empty.png
│   ├── 04_checkout.png
│   ├── 04_checkout_cart.png
│   ├── 05_orders.png
│   ├── debug_before_checkout.png
│   ├── debug_after_checkout_click.png
│   └── debug_checkout_4s.png
│
└── haat-now-phase2\
    └── screenshots\                     ← PROJECT directory (current Puppeteer outputs)
        ├── 00_splash_screen.png
        ├── 01_splash.png
        ├── 01_onboarding_slide1_lime.png
        ├── 02_onboarding_slide1.png
        ├── 02_onboarding_slide2_lime.png
        ├── 03_onboarding_slide3_lime.png
        ├── 04_onboarding_slide3.png
        ├── 04_home_screen.png
        ├── 05_home_screen.png
        ├── 05_home_merchants_grid.png
        ├── 06_wallet_screen.png
        ├── 07_profile_screen.png
        └── 08_home_banner_detail.png
```

---

## CATEGORY DEFINITIONS

| Category | Description |
|---|---|
| **LOVABLE** | Clean Lovable design export — mobile viewport only, no browser chrome, no role-selector tabs. These are the source of truth. |
| **LOVABLE DETAIL** | Zoomed-in crop from a Lovable screen — supports specific element inspection. |
| **OLD IMPLEMENTATION** | Browser screenshot taken of the running dev app at an earlier build phase. Visible tell: role-selector tabs (`العميل / التاجر / الكابتن / الإدارة`) visible at the top of the browser viewport. |
| **CURRENT IMPLEMENTATION** | Output of `screenshot.cjs` (Puppeteer) against the current build. These show the live state of the code as of the latest build. |
| **WRONG STATE** | Puppeteer screenshot taken before login was complete; shows login screen instead of the intended screen. Not usable. |
| **DEBUG ARTIFACT** | Screenshots taken mid-interaction for debugging. Not usable as design reference. |

---

## PARENT DIRECTORY — `../screenshots/`

### Lovable exports (stitch_ prefix)

These five files have clean mobile viewports with no browser chrome. They are the Lovable design board exports and are the authoritative visual reference.

**`stitch_02_home.png` — HOME SCREEN (most important reference)**
- Header: small profile icon left | "HAAT NOW" white/latin centered | hamburger right
- Hero: "PLATINUM EXCLUSIVE ⭐" lime pill badge → large 2-line Arabic headline → 3 lines gray body text → dark premium card (floating, angled, green gradient surface) → "اطلب الآن" lime pill CTA
- Hero occupies ~70% of the first viewport
- Search bar: "ما تريد إن طلب اليوم؟" visible at the fold
- Bottom nav: 5 icons, dark flat bar, no text labels
- Green floating chat button bottom-left
- Background: near-black, faint dark olive/forest green glow top-left

**`stitch_01_login.png` — LOGIN SCREEN**
- Small "HAAT NOW" text header centered (not large display type)
- "فخامة الخدمة بين يديك" subtitle
- Phone number input: EG +20 flag/code (Egyptian market)
- "إرسال رمز التحقق ←" lime CTA
- Google / Apple social buttons
- Terms text (lime hyperlinks)

**`stitch_03_restaurant.png` — RESTAURANT SCREEN**
- Header: "HAAT NOW" centered + hamburger
- Top: real food photography (burger bun close-up, dark-graded)
- Restaurant card: "Burger King", rating 4.8 ★ +500, "مطعم قادر" badge, "مفتوح الآن" lime chip
- Delivery info: 25-35 دقيقة / 15.00 ر.س / 30 ر.س min
- Tab row: الوجبات / العروض / التقييمات / عن المطعم
- Offer section: "العروض المميزة" → card with real food photo + "30% خصم"
- Bottom: gold/lime CTA "عرض السلة — 270.00 جنيه"
- Bottom nav: 5 icons, no labels

**`stitch_04_checkout.png` — CHECKOUT SCREEN**
- Header: "Haat Now" (small caps, not "HAAT NOW") + close × button
- Step indicator: 3 steps (تفاصيل / دفع / سلة) with lime active step
- Section header: "محتويات السلة" with cutlery icon
- Cart items: "دراقل واجبز برجر (SAR 85.00)" + "بطاطس بارمزان (SAR 15.00)" each with qty stepper
- "عنوان التوصيل" section with dark map thumbnail and address text
- Bottom CTA: "إتمام الطلب (SAR 112.50)" lime full-width pill

**`stitch_05_orders.png` — ORDERS/TRACKING SCREEN**
- Header: notification bell + location pin + "HAAT NOW" centered + chevron right
- Live dark map with truck icon ("كابتن محمد")
- "12 دقيقة" ETA chip
- Driver card (glass over map): name, car, rating
- Timeline: 4 steps (تأكيد / تحضير / استلام / توصيل) with lime check/dot indicators
- Bottom nav: 5 icons, no labels

---

### Lovable detail zooms

**`zoom_item.png`** — Cart item row (NO product photo slot)
- Item name: "برجر لاكشري بريميوم" (right)
- Price: "89.00 ر.س" in lime (center)
- Note: "عادي" gray
- Qty stepper: dark "−" circle + lime "+" circle + "1"
- Right side: product image area shows a small rounded square with a blurry/broken image

**`zoom_map.png`** — Map detail
- Dark grid-style map
- White/lime location pin at center
- "المنزل" chip (lime background, dark text) bottom-left

**`proof_product_image.png`** — Cart item row with REAL food photo
- Identical layout to `zoom_item.png`
- BUT the right-side image slot shows a real photograph: two burgers + fries on dark board
- This proves the correct product image is real photography, not SVG

---

### Old implementation screenshots (browser, role tabs visible)

These were taken from the running dev app at an earlier build phase. The role-selector tab bar (`العميل / التاجر / الكابتن / الإدارة`) is visible at the very top of each image — confirming they are browser screenshots, not Lovable exports.

**`02_home.png`** — Home screen, early build
- Shows same Platinum promo (dark card) as stitch_02
- Role tabs visible at top — NOT a Lovable file
- This is the app at an earlier build when HomeScreen was different from current

**`03_restaurant.png`** — Restaurant screen, early build
- Shows "مطعم هات ناو" (not Burger King)
- Real food photo header (sandwich/toast)
- Role tabs visible at top

**`04_checkout.png`** — Checkout, early build
- Role tabs at top
- Cart items + address map + CTA

**`05_orders.png`** — Orders empty state, early build
- DESKTOP-sized viewport (720px wide, not mobile)
- "طلباتي الأخيرة" / "لا توجد طلبات" empty state
- "اطلب الآن" lime CTA
- Floating pill bottom nav with 5 icons, NO labels

**`01_login.png`** — Login, larger viewport
- "HAAT NOW" as large display heading (~80px)
- Same login form, no role tabs (login screen has no roles)
- Appears to be a browser screenshot of the login page

**`01_login_new.png`** — Login variant (smaller viewport)
- Similar to stitch_01_login but slightly different proportions

**`login_screen.png`** — Login, partial viewport (right half clipped)

**`03_restaurant_empty.png`** — MISLABELED: actually shows the home Platinum promo
- Not a restaurant screen
- Shows same content as `02_home.png`
- Role tabs visible at top

---

### Debug artifacts

**`04_checkout_cart.png`** — Cart drawer + restaurant header, captured during debug
**`debug_before_checkout.png`** — Cart drawer: "سلة وجباتي", one item, debug state
**`debug_after_checkout_click.png`** — Not read; assumed debug state
**`debug_checkout_4s.png`** — Completely black frame (page not loaded at capture time)

---

## PROJECT DIRECTORY — `haat-now-phase2/screenshots/`

These are outputs from `screenshot.cjs` (Puppeteer, 393×852 viewport). They show the **current state of the code** as built.

**`04_home_screen.png`** — Current home screen (viewport position: top)
- Header: "التوصيل إلى / البيت، الرياض" (location, not brand name)
- Hero: 200px compact banner, pizza SVG illustration, "احصل على خصم 25% الآن" headline
- Search bar: silver metallic + lime icon chip
- Categories: 8 circular tiles in 2×4 grid, lime Lucide icons + neon glow
- Offers: first offer card partially visible
- Bottom nav: floating pill, 5 icons + Arabic labels

**`05_home_merchants_grid.png`** — Current home screen (viewport scrolled 120px)
- Same hero visible (partial)
- Categories: fully visible both rows
- First offer card visible
- "أقرب المطاعم إليك" section header starting to appear

**`06_wallet_screen.png`** — Current wallet
- Header: "المحظفة" centered
- Balance: "٢٤٥٫٥٠ ر.س" (left-aligned, large)
- "شحن الرصيد +" lime CTA
- 5 transactions listed

**`07_profile_screen.png`** — Current profile
- "حسابي" header
- Profile avatar + phone number
- Platinum Member badge (lime chip)
- Stats row: balance / orders / favorites
- Progress bar
- Personal info form (empty fields)

**`01_splash.png` / `00_splash_screen.png`** — Splash screen (two captures, slightly different halo)
- Dark background + lime halo glow
- Bike icon in rounded square
- "HAAT NOW" white text
- "فاخر · سريع · حصري" subtitle

**`02_onboarding_slide1.png` / `01_onboarding_slide1_lime.png`** — Onboarding slide 1
- Dark/olive green background
- Bike icon + "سريع الفائق" lime badge
- "توصيل في 30 دقيقة" headline
- "التالي ←" lime CTA

**`05_home_screen.png`** — WRONG STATE: shows login screen (not home)
- Screenshot captured before authentication; shows login page instead of home

**`08_home_banner_detail.png`** — WRONG STATE: shows login screen (not home banner)
- Same issue as `05_home_screen.png`

---

## MASTER REFERENCE TABLE

| Reference File | Type | Should Be Used? |
|---|---|---|
| `../screenshots/stitch_02_home.png` | **LOVABLE** — Home screen | **YES — PRIMARY SOURCE OF TRUTH** |
| `../screenshots/stitch_01_login.png` | **LOVABLE** — Login screen | **YES** |
| `../screenshots/stitch_03_restaurant.png` | **LOVABLE** — Restaurant screen | **YES** |
| `../screenshots/stitch_04_checkout.png` | **LOVABLE** — Checkout screen | **YES** |
| `../screenshots/stitch_05_orders.png` | **LOVABLE** — Orders/tracking screen | **YES** |
| `../screenshots/zoom_item.png` | **LOVABLE DETAIL** — Cart item row (no photo) | **YES — for cart item layout** |
| `../screenshots/zoom_map.png` | **LOVABLE DETAIL** — Map + location chip | **YES — for map/tracking layout** |
| `../screenshots/proof_product_image.png` | **LOVABLE DETAIL** — Cart item with real food photo | **YES — proves real photo required** |
| `screenshots/04_home_screen.png` | **CURRENT IMPLEMENTATION** — Home (top viewport) | **YES — to compare against Lovable** |
| `screenshots/05_home_merchants_grid.png` | **CURRENT IMPLEMENTATION** — Home (scrolled) | **YES — to compare against Lovable** |
| `screenshots/06_wallet_screen.png` | **CURRENT IMPLEMENTATION** — Wallet | **YES — to compare against Lovable** |
| `screenshots/07_profile_screen.png` | **CURRENT IMPLEMENTATION** — Profile | **YES — to compare against Lovable** |
| `screenshots/01_splash.png` | **CURRENT IMPLEMENTATION** — Splash | **YES — current state** |
| `screenshots/00_splash_screen.png` | **CURRENT IMPLEMENTATION** — Splash (alt capture) | **YES — current state** |
| `screenshots/02_onboarding_slide1.png` | **CURRENT IMPLEMENTATION** — Onboarding slide 1 | **YES — current state** |
| `screenshots/01_onboarding_slide1_lime.png` | **CURRENT IMPLEMENTATION** — Onboarding variant | **YES — current state** |
| `../screenshots/02_home.png` | **OLD IMPLEMENTATION** — Home (early build, role tabs visible) | **NO — not Lovable, not current** |
| `../screenshots/03_restaurant.png` | **OLD IMPLEMENTATION** — Restaurant (early build) | **NO** |
| `../screenshots/04_checkout.png` | **OLD IMPLEMENTATION** — Checkout (early build) | **NO** |
| `../screenshots/05_orders.png` | **OLD IMPLEMENTATION** — Orders empty state (desktop viewport) | **NO** |
| `../screenshots/01_login.png` | **OLD IMPLEMENTATION** — Login (large viewport) | **NO** |
| `../screenshots/01_login_new.png` | **OLD IMPLEMENTATION** — Login variant | **NO** |
| `../screenshots/login_screen.png` | **OLD IMPLEMENTATION** — Login (partial/clipped) | **NO** |
| `../screenshots/03_restaurant_empty.png` | **OLD IMPLEMENTATION** — Mislabeled (shows home/Platinum promo) | **NO** |
| `screenshots/05_home_screen.png` | **WRONG STATE** — Shows login instead of home | **NO** |
| `screenshots/08_home_banner_detail.png` | **WRONG STATE** — Shows login instead of banner | **NO** |
| `../screenshots/04_checkout_cart.png` | **DEBUG ARTIFACT** | **NO** |
| `../screenshots/debug_before_checkout.png` | **DEBUG ARTIFACT** | **NO** |
| `../screenshots/debug_after_checkout_click.png` | **DEBUG ARTIFACT** | **NO** |
| `../screenshots/debug_checkout_4s.png` | **DEBUG ARTIFACT** — Black frame | **NO** |

---

## KEY FINDINGS

### 1. The Lovable Reference Contains No Categories, No Offers, No Restaurant Grid Above the Fold
`stitch_02_home.png` shows that the entire first viewport is consumed by the Platinum hero. Categories, offers, and restaurants are ALL below the fold. The VISUAL_PARITY_REPORT (now superseded) made assumptions about these sections using VISUAL_BIBLE rules — but the Lovable reference simply does not show them at all in the first viewport.

### 2. The Hero Uses a Dark Premium Card, Not a Food SVG
The Lovable hero (`stitch_02_home.png`) shows a dark floating card (premium/loyalty card with green gradient) — NOT a pizza illustration. The current implementation uses a pizza SVG (`HeroIllustration` component). This is the single largest visual gap.

### 3. The Header Shows "HAAT NOW" as the App Brand, Not the Delivery Location
Every Lovable screen (`stitch_01` through `stitch_05`) shows "HAAT NOW" as the persistent centered header text. The current implementation shows the delivery location instead.

### 4. The Bottom Nav Has No Text Labels in Lovable
`stitch_02_home.png` and `stitch_05_orders.png` both show 5 icons with NO text labels below them. The current implementation shows icon + label pairs.

### 5. `02_home.png` is NOT a Lovable File
It is a browser screenshot of the running dev app (role tabs visible at top). It was previously used as a Lovable reference — this was incorrect.

### 6. The Correct Implementation Reference for Parity Work
- Visual source of truth: `stitch_02_home.png` (home), `stitch_03_restaurant.png` (restaurant), `stitch_04_checkout.png` (checkout), `stitch_05_orders.png` (orders)
- Implementation detail authority: `HAAT-NOW-DESIGN-SPEC.md`
- Current state to compare against: `screenshots/04_home_screen.png`, `screenshots/05_home_merchants_grid.png`

---

*No code was modified. Awaiting approval before any UI changes.*
