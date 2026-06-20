# HAAT NOW — VISUAL BIBLE
**Forensic reconstruction document — "Luminous Obsidian" design language**
Method: pixel sampling + region-by-region crop inspection of the source board. RTL Arabic-first, dark-only.
Scope note: §1–15 are *extracted* from the image. §16–18 (Merchant/Driver/Admin) do **not** appear in the image — they are *derived* specifications that apply the extracted grammar, and are explicitly labeled as such.

---

## PART A — GLOBAL VISUAL LAWS

### 1. Visual Hierarchy
Four attention tiers, enforced by luminance — not size alone:

| Tier | Elements | Treatment |
|---|---|---|
| T1 — Action | CTA pills, prices, active nav, live ETA ("25 دقيقة"), + steppers | Neon lime `#9ed442`, the *only* saturated hue on screen. Lime ≈ 4–6% of any screen's area; scarcity is what makes it read as "press me". |
| T2 — Identity | Headlines, amounts ("250.75"), stat lockups ("25%") | Near-white `#f2f4f6`, weights 700–800, largest sizes |
| T3 — Content | Body, merchant names, list rows | `#aab0b6`, 400–600 |
| T4 — Ambient | Timestamps, placeholders, dividers, inactive nav | `#6e747a`, fades into surface |

Reading order per screen (RTL): top-right title → center hero → lime CTA → supporting rows. Every screen has exactly **one** dominant lime CTA; secondary actions are ghost/graphite pills (e.g., "عرض كل المعاملات").

### 2. Elevation Hierarchy
Six z-layers, expressed by the *triplet* (gradient + top-light + shadow), never by blur alone:

| Z | Layer | Recipe |
|---|---|---|
| Z0 | Canvas void | `#0e1114`, slight bottom vignette `radial(transparent, rgba(0,0,0,.35))` |
| Z1 | Screen background inside phone | flat `#101316`, no border |
| Z2 | Inline rows / chips | `linear(180deg,#1e2227,#15181b)`, border `rgba(255,255,255,.06)`, shadow `0 4px 14px rgba(0,0,0,.35)` |
| Z3 | Cards (default) | `linear(180deg,#24282c,#15181b)`, top edge `rgba(255,255,255,.14)`, sides `.07`, shadow `0 10px 30px rgba(0,0,0,.45)`, inset `0 1px 0 rgba(255,255,255,.08)` |
| Z4 | Panels / sheets / phone frames | as Z3 + shadow `0 18px 50px rgba(0,0,0,.55)`, radius +6px |
| Z5 | CTAs & live elements | lime gradient + outer glow `0 0 18px rgba(158,212,66,.35)` — glow substitutes shadow; lime elements never carry black shadows |

Law: **elevation = brightness of the top edge.** The higher the layer, the brighter its 1px top border (.06 → .10 → .14 → .18).

### 3. Card Architecture
Anatomy of every card (outside → in):
1. **Shadow plate** — soft black drop, offset-y ≈ radius/2.
2. **Border ring** — 1px; top segment 2× brighter than sides; bottom segment nearly invisible (light falls from above).
3. **Body gradient** — vertical graphite, light-to-dark, 180°; never horizontal, never radial.
4. **Specular inset** — `inset 0 1px 0 rgba(255,255,255,.08)` simulating polished edge.
5. **Content padding** — 16px all sides (20px for hero cards).
6. **Optional media zone** — photographic content blends into body via `linear(to left in RTL, transparent, rgba(8,10,12,.85))`; image never touches a hard edge.
Radii: rows 16 / cards 22 / hero & sheets 28 / pills ∞.

### 4. Surface Architecture
Three material families, never mixed within one element:
- **Graphite** (cards, nav, sheets) — vertical gradient, matte, top-lit.
- **Polished silver** (search field, metallic icons, phone bezels) — lighter base `#4e5359`, strong upper-left specular, feels machined. The search bar being *lighter than its surroundings* is intentional: it's the one "begging" surface on Home.
- **Photographic** (offer heroes, category renders, food) — full-bleed imagery, dark-graded, always re-anchored to the palette by a gradient scrim + lime CTA.
Background canvas behind the phones: brushed dark silk with sparse lime particle dust and a top-left light sweep — used only for marketing/splash framing, not in-app.

### 5. Lighting Model
- **Single key light, top-left, ~35° elevation.** Evidence: phone bezels have a specular streak upper-left; metallic icons highlight upper-left; card top edges brighter than bottoms; logo halo brightest at upper arc.
- **No ambient fill** — bottoms of objects fall to near-black, producing the cinematic contrast.
- **Lime is emissive**, not lit: lime elements glow outward (additive), are never shaded, and cast green light onto neighbors (logo ring tints surrounding smoke `#313f28`).
- Vignetting: every composed panel darkens ~12% toward its bottom corners.

### 6. Reflection Model
- **Floor reflections** under 3D renders (burger, coffee, cake): mirrored copy, 15–20% opacity, 8px gaussian blur, fades to 0 within 30% of object height.
- **Specular streaks** on bezels/silver: a soft diagonal white band, 6–10% opacity, blurred, upper-left → lower-right.
- **Screen glass**: faint diagonal sheen across phone mockups only — never inside functional UI.
- No mirror-world reflections inside app screens; reflections are reserved for product renders and hardware.

### 7. Metallic Rendering Style
(The "لماذا تختار Haat Now" icon set + HAAT wordmark)
- **Circular badge, 56–64px:** radial gradient `#3d4144 → #1b2024` (center-upper-left hotspot), 1px rim darker than body, outer shadow Z2.
- **Glyph:** 3D-embossed chrome object (compass, bag, shield, tag, headset) — white specular top, mid-gray body, near-black underside; reads as cast metal, not flat icon.
- **HAAT wordmark:** vertical 3-stop silver gradient (`#e8e9eb → #b1b2b4 → #7d7f83`) clipped to text, 800 weight, tight tracking; paired with **NOW** in lime gradient (`#c4e562 → #9ed442 → #7fb822`) + double glow halo (`0 0 40px` + `0 0 90px` lime).
- Rule: metallic = trust/brand surfaces; lime = action. They meet only in the logo lockup.

### 8. Glassmorphism Rendering Style
Restrained — this design is *graphite-first, glass-second*:
- Used on: driver info card (over map), app-bar region when over imagery, badge chips on photos.
- Recipe: `background: rgba(24,27,32,.55)` + `backdrop-blur(18px)` + the same top-light border. Blur is never frosted-white; tint stays graphite so glass reads as smoked glass.
- Never used for: primary cards, nav, inputs (those are opaque graphite/silver).

---

## PART B — COMPONENT FORENSICS
Format per component: **Structure / Spacing / Border / Shadow / Glow / Gradient / Animation.**

### 9. Navigation Composition (Bottom Bar)
- **Structure:** floating pill container, full-width minus 16px margins, height 72; 5 equal slots RTL: الرئيسية · الطلبات · المفضلة · المحفظة · الحساب; each slot = icon 24 over label 11; iOS home-indicator line sits *below* the pill.
- **Active state:** lime filled icon + lime 600 label; inactive: `#6e747a` outlined icon + label. (Image shows active home in lime, no pill background behind it — color alone signals state.)
- **Spacing:** slot padding 10v/12h; icon↔label gap 4.
- **Border:** top edge `rgba(255,255,255,.10)`, sides `.06`.
- **Shadow:** `0 -8px 30px rgba(0,0,0,.5)` (upward, since it floats over content) + Z3 drop.
- **Glow:** active icon `0 0 8px rgba(158,212,66,.6)`.
- **Gradient:** `linear(180deg,#16191c,#0c0f11)`.
- **Animation:** tab switch — icon scale 0.9→1 + color tween 150ms; label fades; no slide indicator.

### 10. Banner Composition (Exclusive Offers / 30% hero)
- **Structure (RTL):** card 28r, height 150–170. Right 45%: text column — qualifier caption lime ("خصم"/"عرض خالص" badge), stat `display/stat` white ("25%", "30%"), sub-line caption gray, lime CTA pill 36h bottom. Left 55%: cinematic food/vehicle photograph bleeding to edge.
- **Spacing:** text column padding 20; stat→sub 6; sub→CTA 14; card stack gap 16; parent section header (title right / lime "عرض الكل" left) margin-bottom 12.
- **Border:** standard Z3 ring; photo side's border disappears under the image.
- **Shadow:** Z3.
- **Glow:** CTA only.
- **Gradient:** scrim `linear(to photo-side, rgba(8,10,12,.9) 0%, rgba(8,10,12,.35) 55%, transparent 100%)` ensures text contrast; photo itself dark-graded (lifted blacks ≈ #0a0a0a, warm highlights).
- **Animation:** carousel snap-x with 3-dot indicator (active dot lime, wide); photo parallax 4–6px on scroll; CTA pulse-glow on idle 4s.

### 11. Category Card Composition (Home Bento)
- **Structure:** 3-col grid, square tiles. Top 70%: photoreal 3D render (burger+fries, grocery basket, pill bottle…) centered, floating with floor reflection (see §6). Bottom 30%: darker label strip containing centered name (label 13/600 white).
- **Spacing:** grid gutter 12–16; tile inner padding 10; render occupies ~80% tile width.
- **Border:** Z3 ring.
- **Shadow layers:** tile Z3 **plus** render's own drop shadow (`0 10px 18px rgba(0,0,0,.6)`) — two independent shadow systems per tile.
- **Glow:** none (categories are calm; lime is reserved).
- **Gradient:** tile `grad/graphite-card`; label strip is the gradient's darker tail, sometimes reinforced by `rgba(0,0,0,.25)` overlay.
- **Animation:** press → tile scale .97; render `anim/float` (±4px, 4s, staggered per tile) for premium liveliness.

### 12. Product Card Composition
Two variants observed:
**a) List/cart row:** graphite row 16r, RTL: name (label 600 white) + merchant caption + price lime 700 on right; product thumb 64×64 rounded-14 with subtle inner shadow center-left; lime circular 32 "+" (or − count + stepper pill) far left. Padding 12; thumb↔text gap 12.
**b) Detail hero (تفاصيل المنتج):** product cutout 60% screen-width, centered, floating on Z1 with reflection + large soft shadow; below: name (headline/sm centered), description (body, 2–3 lines, centered, `text/2`), price lime; then **الإضافات** checklist — rows 14r graphite, trailing rounded-6 checkbox (checked = lime fill + dark check), leading price caption ("+5 جنيه"); then **الملاحظات** — textarea pill `surface/input`-tinted; footer row: qty stepper pill (− / 1 / + with lime +) beside full-width lime CTA "أضف إلى السلة".
Borders/shadows/gradients: standard Z2 rows, Z5 CTA. Animation: hero entry — scale .92→1 + fade 300ms; checkbox tick springs 150ms; add-to-cart → CTA emits glow burst then thumbnail flies to cart icon (arc path 400ms).

### 13. Wallet Screen Composition
- **Structure (top→bottom):** app bar (back chevron left, centered title "المحفظة"); balance block centered — caption "الرصيد الحالي" `text/2`, amount "250.75" display/stat white with small lime currency glyph trailing; full-width lime CTA "شحن الرصيد" (52h, 24r margin 20); section title "المعاملات الأخيرة" right-aligned; transaction list; footer ghost pill "عرض كل المعاملات" (graphite, border `.10`, no fill).
- **Transaction row:** 16r graphite Z2, RTL: brand squircle 40×40 (Carrefour/KFC/PizzaHut logo on dark) at right, title label + date caption stacked, amount far left — `+100 جنيه+` lime / `−125` red `#ff6b6b`; row gap 10; row padding 12.
- **Border/Shadow:** rows Z2; CTA Z5.
- **Glow:** balance amount subtle `glow/text`; CTA standard.
- **Gradient:** screen flat Z1; rows graphite.
- **Animation:** balance counts up on mount (600ms ease-out); new transaction slides-up + lime flash on amount; top-up success → confetti-free, just glow pulse on balance.

### 14. Tracking Screen Composition
- **Structure:** app bar "تتبع الطلب"; status lockup centered — headline "طلبك في الطريق" white 700, caption "وصل السائق خلال", **ETA "25 دقيقة" in lime display weight** (the screen's T1 element); map panel 28r, ~38% height — near-black night map (`#0c0f10` base, street strokes `rgba(255,255,255,.05)`), route = lime dashed polyline 2px with `glow/dot`, two circular avatar nodes (origin merchant / moving driver) with lime ring; **driver glass card** overlapping map bottom (−24 offset): smoked glass (§8), avatar 48 + name + ★rating gold + vehicle "Honda - ABC123" caption, lime circular call FAB 44 far left with phone glyph; **timeline** below — vertical line right-aligned (RTL), 5 nodes: completed = lime filled dot + white text, **active = row highlighted (graphite pill bg, lime dot pulsing, lime text "طلبك في الطريق")**, pending = hollow gray dot + `text/3`.
- **Spacing:** lockup→map 16; card overlap −24; timeline row height 44; node↔text 12.
- **Shadow/Glow:** map Z3; glass card Z4 + blur; route glow; active node `anim/glow-pulse`.
- **Animation:** driver avatar translates along route (eased, real-time); dashed route marches (dash-offset loop 1.2s); on status change, timeline row promotes with 250ms slide + glow handoff.

### 15. Checkout / Cart Composition (السلة)
- **Structure:** title bar; item rows (×n, variant 12a); **coupon field** — pill 48h `surface/input`-dark variant with leading icon, placeholder "أضف كود خصم"; **totals block** — flat (no card): rows المجموع / رسوم التوصيل / الضريبة (label gray right, value white left), 1px divider, then **الإجمالي** row enlarged — label white 700, value "326 جنيه" lime display-weight; footer full-width lime CTA "إتمام الطلب" 56h.
- **Spacing:** rows gap 12; totals rows 10; divider margins 12; CTA bottom margin 24 (above nav-safe area).
- **Border:** divider `.06`; coupon pill border `.10`.
- **Shadow/Glow/Gradient:** rows Z2; CTA Z5 with inset highlight.
- **Animation:** qty change → price re-totals with 200ms count-tween; coupon accept → field border flashes lime + total strikes/retotals; CTA disabled state = 40% opacity, no glow.

---

## PART C — DERIVED PORTAL SPECIFICATIONS
*(Not present in the source image. The following applies Part A laws to desktop portals so the family stays coherent. Marked DERIVED.)*

### 16. Merchant Dashboard Composition — DERIVED
- **Frame:** 280px fixed sidebar (Z4 graphite, `#15181b` flat with top-light) right side (RTL); content canvas Z1.
- **Sidebar:** metallic-text brand lockup top; nav items 44h, 12r — active = lime text + lime 3px start-edge bar + `neon/tint-08` fill; merchant identity chip (avatar + branch name) pinned bottom.
- **KPI row:** 4 StatCards (Z3, 22r, padding 20) — caption gray, value display/stat white, delta badge pill (lime ▲ / red ▼ on tint fills).
- **Orders board:** incoming order cards Z3 with status Badge (pending=warning, preparing=lime-tint, on_the_way=lime); action buttons follow one-lime-per-card law (primary "قبول" lime, rest ghost).
- **Catalog table:** Z2 rows, thumb + name + price (lime, inline-editable → input adopts `surface/input` silver); toggle switches lime-filled when on.
- Lighting/shadows/animation: identical triplet + 300ms slide-up on card mount.

### 17. Driver Dashboard Composition — DERIVED
- Mobile-first like customer app; same bottom-nav grammar (الرادار · التوصيلات · المحفظة · الأداء · حسابي).
- **Online toggle hero:** Z4 card; toggle ON = lime track + `glow/cta`, OFF = graphite; status caption beneath.
- **Job cards:** route mini-map strip (night map + lime route, §14 recipe at 96h), pickup/dropoff two-node mini-timeline, payout in lime display weight, accept = full-width lime CTA with 10s countdown ring (lime arc depleting).
- **Earnings:** wallet pattern from §13 verbatim (consistency across roles is the design's trust signal).

### 18. Admin Dashboard Composition — DERIVED
- Sidebar frame as §16; denser 12-col grid.
- **Global KPI band:** 6 compact StatCards; one "live" card (active orders) carries `anim/glow-pulse` dot.
- **Charts:** lime single-series on graphite; grid lines `.05`; area fills `neon/tint-08→transparent`; no multi-hue palettes — secondary series use metallic gray.
- **Tables (drivers/merchants/finance):** Z2 zebra-less rows, status badges per token table, row hover = `surface/4` + top-light strengthens.
- **Support console:** ticket thread = chat bubbles (admin = lime-tint 12% bg + lime border, user = graphite); priority chips: high=red-tint, medium=warning-tint, low=neutral.
- Audit/permission views: monospace ids in `text/3`, destructive actions are the *only* red pills allowed platform-wide.

---

## PART D — RECREATION CHECKLIST (designer hand-off)
1. Build the triplet (gradient/top-light/shadow) as a master style; apply to every raised element first.
2. Place exactly one lime CTA per screen; audit lime coverage ≤6%.
3. Light everything from top-left; verify card bottoms are darker than tops.
4. Reflections only under 3D renders and on hardware; smoked glass only over imagery.
5. Numerals Latin, copy Arabic RTL; prices always lime 700.
6. Nav = floating graphite pill, color-only active state.
7. Photography: dark-graded, scrimmed toward the text side, never edge-cropped text.
8. Motion: 150/300ms standard-ease; glow-pulse for "live"; float for renders; nothing bounces.