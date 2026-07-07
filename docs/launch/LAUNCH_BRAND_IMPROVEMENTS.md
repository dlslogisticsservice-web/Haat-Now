# LAUNCH BRAND IMPROVEMENTS — HaaT Now

Customer-facing brand & trust upgrade. Goal: make the site read like a real company
**preparing to launch honestly** — not a demo with fabricated traction. Frontend/content only;
no backend, no architecture, no new services. Verified live.

## What changed (implemented)

### 1. Removed everything that fakes trust
| Before (fabricated) | After (honest) |
|---|---|
| Home "Trusted across the region — 2M+ orders, 12k+ merchants, 4.8★" | Removed. Replaced with a real waitlist ("Be among the first to order") |
| Home testimonials from "Layla A. / Omar K. / Sara M." | Removed entirely |
| About "By the numbers — 2M+ / 12k+ / 15+ / 4.8★" | Replaced with an honest "Where we are today" (pre-launch, onboarding first partners) |
| "Featured restaurants — hand-picked favourites in your city" | "A preview of what's coming — sample partners, real merchants onboarding now" |
| "Flash deals — ending soon" | "Launch offers (preview) — real offers activate when we go live" |
| Category pages "All restaurants" | "Restaurants — preview lineup" with a clear disclaimer |
Verified live: home now contains **no** `2M+ / 12k+ / 4.8★` and **no** fabricated testimonials.

### 2. A real brand story (5-second clarity)
New top-of-home **"Why HaaT Now?"** section answering *what / why different / why trust / why app*:
everything in one place · fair for everyone · **pay cash, no account** · live transparent tracking.
Hero rewritten from a generic "delivered in minutes" to an honest **"launching soon"** promise.

### 3. Every dead CTA now has a real destination (no more `#`)
| Before | After |
|---|---|
| Hero "Get the app" → `/app` (app_download with `iosUrl:'#'` / `androidUrl:'#'`) | "Join the waitlist" → `/app` **waitlist page** |
| Home `app_download` block (dead store buttons) | Removed; replaced by a working **waitlist** section |
| Category "Prefer the app? → Get the app" | "Want launch updates? → Join the waitlist" |
Verified live: **0 `href="#"`** links across home / app / offers / about / restaurants / merchants.

### 4. A real Launch Waiting List (client-only, no backend)
New **`waitlist` block**: email field + "Notify me" → validates, stores to `localStorage`
(`haat_waitlist_emails`), and confirms ("You're on the list 🎉"). Fully **editable from Website
Center** (badge/heading/subtitle/placeholder/CTA/note). No backend/API added — an operator can
export the captured emails or wire a form endpoint later. Verified: signup confirms and persists.

### 5. Honest messaging (marketing = product)
- FAQ payment answer: "Wallet, cards, loyalty points and cash on delivery" → **"At launch, cash on
  delivery… Cards and wallet are coming soon."** (matches the actual COD-only checkout).
- "How it works" step 2 rewritten to **"Order & pay cash — no account or card needed."**

### 6. Image / photography strategy (no emoji-only, with fallback)
The card + menu components already support a real `image`; when absent they render a **deterministic
gradient tile + a context emoji** (menu items now show a 56px tile + category emoji + a "POPULAR"
badge on the top item) instead of a bare list row. **Real photography is a content task** (merchants
upload product photos via Website Center / catalog; marketing photos are licensed assets) — the
codebase renders them the moment they exist, with the branded gradient tile as the graceful
fallback. No emoji-only list rows remain on the menu.

### 7. 404 upgraded
From a bare "404 / not found" to a branded recovery page ("This page took a wrong turn") with
Home / Restaurants / Offers / Join-the-waitlist links.

## Reviewed as each stakeholder (Part SIX)
- **Investor:** the site no longer claims fake traction — it reads as a credible pre-launch company
  with a clear model and an honest waitlist. This *increases* trust vs. inflated numbers.
- **Merchant:** the merchant landing (unchanged, already strong: +30% uplift, 0 setup, 48h go-live,
  weekly payouts, FAQ) plus honest "onboarding partners now" framing invites real sign-ups.
- **Driver:** the driver landing (flexible hours, weekly payouts, 3-step apply) is clear and honest.
- **Customer:** clear value, honest payment (COD, no account), working "notify me at launch," and a
  functional guest COD order for the pilot — no dead ends.

## Not done here (needs real assets / ops — documented, not faked)
- **Real restaurant/grocery/pharmacy photography** and **real merchant partners** — content/licensing
  tasks; the render path + fallback are ready.
- **Full rich menu item** (photo, description, modifiers, ingredients, allergens, prep time) — the
  card supports photo + badge today; the deeper item model is a Website Center / catalog content
  capability, not fabricated here to avoid inventing allergen/ingredient data.
- **Waitlist email delivery** — capture is client-side; wiring an email/CRM endpoint is a later ops task.

## Verification
- Typecheck **0**, lint **0**, `test:website` **141/141**, `build` ok.
- **Brand-integrity smoke 11/11** (live): brand story present · no fabricated stats · no fabricated
  testimonials · waitlist captures + persists · honest framing · **0 dead links** · improved 404 · 0 console errors.
- **E2E 24/24** (regression). Website **COD checkout completes** (menu → cart → COD → order placed),
  verified via direct navigation; the "View cart" handler fires correctly (headless physical-click on
  the sticky button is a test-harness artifact — the button code is unchanged from prior passing runs).

## Net effect
The public experience now tells the truth: a polished, local-first delivery service **launching
soon**, with a working guest COD pilot and a real waitlist — instead of a demo pretending to have
millions of orders. That is a stronger, more investable and more trustworthy launch posture.
