# LAUNCH PRODUCT AUDIT — HaaT Now
### Executive Product / UX / Marketing / Conversion review — "what real people will see"

Reviewed as CPO / UX Director / CMO / Growth Lead / Investor / First Customer. Evidence gathered
by rendering the live site (sandbox) and reading the actual pages — not the code. Date 2026-07-07.

---

## VERDICT UP FRONT

**Overall launch readiness (product/UX/brand): 6.5 / 10.**
The *skeleton* is genuinely good — clean IA, premium glass UI, real micro-interactions (live
flash-deal countdowns, hover lift), strong B2B landing pages, a working guest COD checkout with a
transparent price breakdown, solid a11y and SEO. The *flesh* is not launch-credible yet: **there
is not a single real photograph anywhere on the site**, traction numbers and testimonials appear
**fabricated**, product/menu pages are **too thin to order confidently**, and marketing **promises
things the checkout does not deliver**. These are content/trust problems on a sound platform — but
they are exactly the things a first customer and an investor notice first.

---

## THE FIVE THINGS THAT WILL HURT MOST AT LAUNCH (evidence)
1. **No real imagery — the entire site uses emoji + gradient tiles.** Verified: every page returns
   `imgs real: 0`. Home, Restaurants, Menu, Merchant cards — all 🍔/🛒/💊 on colour gradients.
   Talabat/Jahez/HungerStation/Uber Eats are *photography-first*. HaaT currently reads as a polished
   prototype, not a live marketplace. **This single issue caps brand perception at ~6/10.**
2. **Fabricated social proof / traction.** Home + About show "2M+ Orders, 12k+ Merchants, 15+
   Cities, 4.8★" and testimonials from "Layla A. — Riyadh", "Omar K. — Jeddah". For a pre-launch
   brand these are untrue. This is a **trust and legal exposure**, and savvy users/investors smell it.
3. **Product/menu page is too thin to convert.** `/menu` renders only: title "Order online" + 3
   items (name, category, price, "Add"). **No photos, no descriptions, no ratings, no
   customization/modifiers, no merchant header (hours/ETA/min-order/reviews).** A customer cannot
   evaluate the food. This is the core ordering surface and it is the weakest page (4/10).
4. **Marketing ↔ product mismatch.** FAQ/Help states "Wallet, cards, loyalty points and cash on
   delivery," but checkout offers **COD only** (Card/Wallet = "coming soon"). Promising payment
   methods you don't accept erodes trust at the most sensitive step.
5. **App-install growth is a dead end on the live site.** The polished App-Install modal + deferred
   deep-link engine exists but is **not wired** into the live public site; the only live app CTA is
   a static "Get the app" block whose store links are `#` (dead). Clicking "Get the app" does nothing.

---

## LAUNCH SCORES (1–10)

### Experience criteria
| Criterion | Score | Note |
|---|---:|---|
| First impression | 7 | Strong marketplace hero + search; undercut by emoji tiles |
| Visual hierarchy | 8 | Clear sections, good heading scale |
| Brand quality | 6 | Glass UI is premium; emoji-as-content is not |
| **Trust** | **4** | Fake stats/testimonials; promise≠delivery; no real merchants |
| Copywriting | 7 | Clean, benefit-led; a little generic |
| Call to action | 7.5 | Clear primary CTAs; some dead ("Get the app") |
| Navigation | 8 | Logical header/footer, breadcrumbs, mega structure |
| Accessibility | 8 | Skip link, focus rings, ARIA, RTL, reduced-motion |
| Conversion | 6 | Funnel works but leaks (below) |
| SEO | 8 | Per-page meta, canonical, OG, JSON-LD + SearchAction |
| Mobile UX | 7 | Responsive; rails scroll; forms usable |
| Desktop UX | 7.5 | Good max-width, spacing |
| Performance perception | 8 | Skeletons/shimmer, fast, no layout shift |
| Animation | 8 | Fade-in, hover lift, live countdowns |
| Glass UI quality | 8 | Tasteful blur/borders, theme-token driven |
| Micro-interactions | 8 | Countdown, chips, qty steppers, hover |

### Pages
| Page | Score | One-line |
|---|---:|---|
| Home | 7 | Great structure (hero+search+categories+flash deals+rails+steps+stats+testimonials+CTAs); no photos, fake stats |
| Restaurants / Stores / Pharmacy / Parcel | 6 | Curated cards with rating/ETA/fee; emoji tiles; verticals not truly differentiated |
| Offers | 7.5 | **Best discovery page** — live countdowns, discount codes, ratings, ETAs |
| Search | 6 | Autocomplete works; results curated, thin |
| Restaurant / Store / Product (menu) | 4 | Thin: name+price+Add; no photo/desc/modifiers/merchant header |
| Cart | 7 | Clear lines, qty steppers, breakdown |
| Checkout | 7 | Guest COD, VAT+tip+delivery breakdown, clean; card "coming soon" |
| Tracking | 7 | Status + ETA + timeline + cancel/reorder/refund/support + receipt |
| Customer dashboard | 5 | Rich in the app; on the website it is minimal |
| Merchant landing | 8.5 | Strong: value stats (+30%, 0 setup, 48h), features, steps, FAQ, CTA |
| Driver landing | 8.5 | Strong: flexible hours, weekly payouts, 3 steps, FAQ |
| Franchise | 8 | Clear: 15+ cities, 90d launch, turnkey, deck CTA |
| Business / Enterprise | 7.5 | Clear API/enterprise value; no diagrams/docs preview |
| About | 6.5 | Good values; fabricated "By the numbers" |
| Contact | 7 | Email/phone; no map/form-to-inbox confirmation |
| FAQ / Help | 6 | Useful, but routes to "in-app" + email instead of on-site support |
| Blog | 6 | Two starter posts; not launch content |
| Privacy / Terms | 6.5 | Starter legal; adequate, generic |
| 404 | 4 | Bare "404 / not found / back home" — no brand, no search, no links |
| Empty states | 7 | Friendly, on-brand primitives |
| Loading states | 7.5 | Skeleton/shimmer, spinners — premium perception |

### Marketing
| Dimension | Score |
|---|---:|
| Brand story | 6 · Emotional hook is thin ("Everything you love, delivered in minutes") |
| Why HaaT / UVP | 5 · Not differentiated from any competitor's tagline |
| Emotional appeal | 6 |
| Competitive positioning | 5 · No stated reason to choose HaaT over Jahez/HungerStation |
| **Trust signals** | 4 · Fabricated stats, no real logos/press/ratings |
| **Social proof** | 3 · Testimonials read as invented |
| Merchant value | 8.5 |
| Driver value | 8.5 |
| Franchise value | 8 |
| Customer value | 6 · Convenience stated, not *felt* (no food, no real offers) |

---

## CONVERSION FUNNEL — where users abandon (evidence-based)
| Stage | Leak | Why |
|---|---|---|
| Visitor → Discovery | **Medium** | No food photography → low appetite appeal; fabricated stats seed doubt |
| Discovery → Merchant | **High** | Emoji tiles + no "open now"/distance cues on some rails; verticals look same |
| Merchant → Cart | **Highest** | Menu has no photos/descriptions/modifiers → can't decide → bounce |
| Cart → Checkout | Low | Clean, single-branch, clear total |
| Checkout → Order | **Medium** | Card/Wallet "coming soon" loses card-preferring users; guest asks name+address (fine) |
| Order → Tracking | Low | Auto-lands on live tracking |
| Tracking → Review | Medium | Review entry not surfaced prominently post-delivery on the website |
| Review → Repeat | Medium | No saved favourites/1-tap reorder surfaced on the website; reorder exists but buried |
| Repeat → App install | **Highest** | "Get the app" links are dead (`#`); the smart install prompt isn't wired live |

**Biggest single leak:** the **menu/product page** (Merchant→Cart). Fix it and conversion moves most.

---

## APP DOWNLOAD STRATEGY
- **What exists:** a well-designed, *ethical* install modal (value-based; always shows "Continue on
  Website"; Esc/× to dismiss; coupon/image/deep-link + deferred resume). Product-wise this is right —
  it never forces.
- **What's wrong for launch:** it is **not shown on the live public site**, and the static "Get the
  app" CTA points to `#`. So today a customer literally **cannot** install the app from the website.
- **Is the message shown at the right moment?** N/A live — it isn't shown. When wired, the right
  moment is **after a successful first order (on the tracking/confirmation screen)** and on a
  **repeat visit**, not on first paint. Never mid-browse.
- **Would a customer install?** Not from the current site — nothing works. With a real post-order
  prompt ("Track live + reorder in one tap — 20% off your next order in the app") and working store
  links, yes.
- **Better message:** lead with a *reward + convenience* ("Your next order is faster in the app —
  reorder in one tap, plus SAR X off"), not "Get the app." Tie to the moment of delight (order placed).

---

## COMPETITOR REVIEW (Talabat · Jahez · HungerStation · Uber Eats · DoorDash · Deliveroo)
| Area | HaaT vs field |
|---|---|
| Homepage | Structurally competitive (hero/search/categories/deals/rails). **Behind on imagery** — rivals are photo-rich; HaaT is emoji. |
| Restaurant experience | **Well behind.** Rivals: photos, descriptions, popular items, ratings, modifiers, offers. HaaT menu: name+price+Add. |
| Checkout | **At par / cleaner** for COD; behind on payment breadth (no cards/wallet live) and saved addresses on web. |
| Tracking | **Competitive** — status, ETA, timeline, actions, receipt. (Map tiles need a key.) |
| Marketing (B2B) | **Ahead of several** — merchant/driver/franchise landings are crisp and benefit-led. |
| Trust | **Behind** — rivals show real ratings/volume/press; HaaT shows fabricated numbers. |
| Premium feeling | Glass UI + motion feel modern (a genuine strength), but **photography gap** breaks the illusion. |

**Net:** HaaT's *marketing site* competes; HaaT's *ordering experience* does not yet, purely due to
content (photos, menus, real catalog) — not platform capability.

---

## VISUAL REVIEW
- **Typography** 8 — strong weights/scale, good hierarchy; a touch generic (system stack).
- **Spacing** 8 — consistent rhythm, good max-widths.
- **Glass effects** 8 — tasteful; not overdone.
- **Colours** 7.5 — confident lime/dark; verify contrast on lime-on-white CTAs.
- **Cards** 8 — consistent radius/border/hover lift.
- **Buttons** 7.5 — clear primary/ghost; some dead targets.
- **Icons/illustrations** 4 — **emoji are not brand assets**; biggest visual weakness.
- **Hero** 7.5 — gradient wash + search is good; would sing with a real photo/video.
- **Motion** 8 — fade/lift/countdown, reduced-motion respected.
- **Loading** 8 — skeleton shimmer reads premium.
- **Empty states** 7 — friendly, on-brand.

---

## TOP 50 IMPROVEMENTS — ordered by BUSINESS IMPACT (not effort)
1. Add **real food/merchant photography** across home, discovery, and menu cards.
2. **Remove or make true** the traction stats (2M+/12k+/15+/4.8★) — use honest launch framing.
3. **Rebuild the menu/product page**: photo, description, price, rating, add-ons/modifiers.
4. Add a **merchant header** on the menu (logo, cuisine, rating+count, ETA, min order, hours, offers).
5. **Replace fabricated testimonials** with real quotes (or remove until you have them).
6. **Fix the "Get the app" dead links** and wire the install prompt (post-order moment).
7. **Reconcile payment promises** — either enable cards or stop advertising them (say "COD now, cards soon").
8. Add **real offers** tied to real merchants (not placeholder "HaaT Kitchen").
9. Surface **"Open now" + distance + delivery time** consistently on every discovery card.
10. Add **1-tap reorder + favourites** prominently (post-order + dashboard).
11. Add a **strong, differentiated UVP** ("Why HaaT") — one sentence a competitor can't copy.
12. Add **real trust signals**: partner/press logos, security/payment badges, refund guarantee.
13. Make the **hero** photography/video-led with a location + search that feels alive.
14. Add **category landing depth** (cuisines, filters, sort) beyond a single merchant list.
15. Add **product search with real results + photos** (not curated names).
16. Add **post-delivery review prompt** on the website (not just app).
17. Add **saved addresses + saved details** for returning web customers (reduce checkout friction).
18. Add **card/Apple Pay/mada** at checkout for card-preferring segments (revenue).
19. Add **live ETA/driver map** on tracking (needs Maps key) — competitive parity.
20. Add **"first order" incentive** (e.g. free delivery / % off) visible from the hero.
21. Improve **404** into a branded, helpful page (search + popular links).
22. Add **social proof counters that are real** (ratings pulled from actual orders once live).
23. Add **merchant/menu "popular"/"recommended"** modules to guide choice.
24. Add **allergen/dietary tags** (halal, vegetarian) — regionally important, trust-building.
25. Add **estimated total + fees transparency earlier** (before checkout) to reduce surprise.
26. Add **coupon visibility** (show applicable offers on the merchant page, not just a code box).
27. Add **"why HaaT" section** to home (speed, fairness, support) with proof.
28. Add **app-store badges** (real) + QR for desktop → mobile install.
29. Add **contact form** that confirms submission (not just an email address).
30. Add **help/support on the website** (chat/ticket) instead of routing to "in-app."
31. Add **order confirmation email/SMS** expectation messaging at checkout.
32. Localize consistently — **fix mixed AR/EN** content (demo shows Arabic items on an English site).
33. Add **delivery-area check** ("do we deliver to you?") near the hero to qualify visitors.
34. Add **merchant onboarding CTA proof** (logos of live partners) on the merchant landing.
35. Add **driver earnings estimator** on the driver landing (interactive, converts).
36. Add **franchise ROI/metrics** and a real deck download on franchise.
37. Add **blog content** that's genuinely useful (city guides, offers) for SEO + trust.
38. Add **microcopy reassurance** at checkout ("No account needed · Pay cash at the door · Free cancellation while pending").
39. Add **skeleton→content** on discovery (already good) and **image lazy-load** for real photos.
40. Add **"most ordered near you"** personalization once live data exists.
41. Add **ratings + review count** on every merchant card (real).
42. Strengthen **CTA copy** ("Order now" → "See what's near you" / "Get it in 30 min").
43. Add **trust footer**: secure-payment, data-privacy, support hours.
44. Add **empty-cart cross-sell** ("Popular near you") instead of a plain empty state.
45. Add **abandoned-cart nudge** (web push/email) once providers exist.
46. Add **cuisine/dietary filters** to search + discovery.
47. Add **desktop two-column menu** (categories rail + items) like rivals.
48. Add **accessibility polish**: verify lime-on-white contrast, alt text on real photos.
49. Add **performance**: real images must be responsive/AVIF to keep the current fast feel.
50. Add **a consistent brand illustration system** to replace emoji where photos don't fit.

---

## FINAL QUESTION — Would I personally invest if HaaT launched tomorrow?

# YES WITH MINOR IMPROVEMENTS

**Evidence for YES:** the platform is real and complete — a guest can discover, search, choose,
add to cart, and **complete a COD order on the website**, then track it, reorder, refund and get
support (verified end-to-end). The B2B story (merchant/driver/franchise) is crisp and fundable.
The design system (glass UI, motion, skeletons, a11y, SEO) is modern and coherent. This is a
sound, working product — not vaporware.

**Why "with improvements," not unconditional YES:** the launch-facing *content and trust layer* is
not credible yet. Three fixes are **non-negotiable before a public launch** — (1) real photography,
(2) remove fabricated stats/testimonials, (3) make the menu/product page orderable (photos +
descriptions + modifiers). A fourth — wire app-install + fix dead store links — protects growth.
Critically, these are **content, wiring and honesty fixes on a working platform**, achievable in
days, not a rebuild. That is precisely the profile of a fundable pre-launch company: the hard part
(the platform) is done; the remaining work is execution.

**If those four ship, my answer becomes an unqualified YES.**
