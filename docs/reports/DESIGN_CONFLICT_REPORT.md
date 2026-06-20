# DESIGN CONFLICT REPORT
**HAAT NOW Phase 2 — Conflict Analysis between HAAT-NOW-DESIGN-SPEC.md and VISUAL_BIBLE.md**

> Purpose: catalog every case where the two files give contradictory instructions.
> No code was modified to produce this report.
> "Current implementation" reflects the state of `HomeScreen.tsx` as of Phase 6.

---

## CONFLICT 1 — Category Tile Shape

| | Instruction |
|---|---|
| **DESIGN-SPEC §5** | `rounded-2xl` — square tiles with large corner radius |
| **VISUAL_BIBLE §11** | "square tiles" — explicitly labeled square |
| **Current implementation** | `rounded-full` — fully circular (per Phase 5 user instruction, not in either spec) |
| **Authoritative** | **VISUAL_BIBLE §11** (forensic pixel reconstruction). Both specs agree on square; circular was a user override, not a design-system decision. If restored to spec, `rounded-2xl` from DESIGN-SPEC is the correct square-with-radius form. |

---

## CONFLICT 2 — Category Grid Columns

| | Instruction |
|---|---|
| **DESIGN-SPEC §5** | `grid-cols-4` — 4 columns |
| **VISUAL_BIBLE §11** | "3-col grid" — explicitly 3 columns |
| **Current implementation** | 4 columns (matches DESIGN-SPEC) |
| **Authoritative** | **VISUAL_BIBLE §11**. The VISUAL_BIBLE was derived from forensic pixel inspection of the actual Lovable reference board; the DESIGN-SPEC was written separately and likely reflects a later iteration. However the user has explicitly asked for 4 columns across multiple phases — user instruction takes precedence over both. |

---

## CONFLICT 3 — Category Icon Glow

| | Instruction |
|---|---|
| **DESIGN-SPEC §5 + §9** | Lime icons with `drop-shadow-[0_0_12px_oklch(0.92_0.22_130/0.55)]` — neon halo on every category icon |
| **VISUAL_BIBLE §11** | "Glow: none (categories are calm; lime is reserved)" |
| **Current implementation** | Lime icons with glow (matches DESIGN-SPEC, violates VISUAL_BIBLE) |
| **Authoritative** | **VISUAL_BIBLE §11**. The VISUAL_BIBLE §1 law states lime occupies 4–6% of any screen area; eight glowing lime icons simultaneously would exceed this budget. However the user's Phase 5 instruction explicitly said "restore luxury glow" — user instruction currently overrides the spec. |

---

## CONFLICT 4 — Category Tile Content: Icons vs. 3D Renders

| | Instruction |
|---|---|
| **DESIGN-SPEC §5** | Lucide icons (`UtensilsCrossed`, `ShoppingCart`, `Pill`, etc.) inside glass tiles |
| **VISUAL_BIBLE §11** | "photoreal 3D render (burger+fries, grocery basket, pill bottle…) centered, floating with floor reflection" — no icons, photographic renders |
| **Current implementation** | Lucide icons (matches DESIGN-SPEC) |
| **Authoritative** | **VISUAL_BIBLE §11** for maximum Lovable parity; **DESIGN-SPEC §5** for practical implementation without 3D renders. Since 3D food renders do not exist in the asset library, DESIGN-SPEC §5 is the implementable authority. |

---

## CONFLICT 5 — Category Label Size

| | Instruction |
|---|---|
| **DESIGN-SPEC §5** | `text-[11px] font-semibold` — 11px |
| **VISUAL_BIBLE §11** | "label 13/600 white" — 13px, weight 600 |
| **Current implementation** | 10px (smaller than both specs) |
| **Authoritative** | **VISUAL_BIBLE §11** (13px) for Lovable parity. Current 10px is below both specs. |

---

## CONFLICT 6 — Glassmorphism Scope (Where Glass Is Used)

| | Instruction |
|---|---|
| **DESIGN-SPEC §4** | "Apply these utilities everywhere a glass surface is needed (header, cards, category tiles, search bar, badges)" — glass is the primary surface material |
| **VISUAL_BIBLE §8** | "Restrained — graphite-first, glass-second. Used on: driver info card (over map), app-bar region when over imagery, badge chips on photos. Never used for: primary cards, nav, inputs" |
| **Current implementation** | Glass used on category tiles, header, offer cards — broadly (matches DESIGN-SPEC, contradicts VISUAL_BIBLE §8) |
| **Authoritative** | **VISUAL_BIBLE §8**. Cards, nav, and inputs should be opaque graphite (`linear(180deg,#24282c,#15181b)`), not glass. Glass is reserved for surfaces over imagery. This is a fundamental architecture conflict — VISUAL_BIBLE's approach produces the "Luminous Obsidian" character; the DESIGN-SPEC approach produces a lighter, more transparent feel. |

---

## CONFLICT 7 — Search Bar Material

| | Instruction |
|---|---|
| **DESIGN-SPEC §6** | `glass glass-shine rounded-2xl` — glass material on search bar |
| **VISUAL_BIBLE §4** | "Polished silver (search field) — lighter base `#4e5359`, strong upper-left specular, feels machined. The search bar being *lighter than its surroundings* is intentional" — opaque silver/metallic, not glass |
| **Current implementation** | Metallic silver gradient `#6c7480 → #4e5359` with specular (matches VISUAL_BIBLE) |
| **Authoritative** | **VISUAL_BIBLE §4**. Current implementation is correct. The silver search bar is a deliberate contrast device — the one "begging" surface on Home. |

---

## CONFLICT 8 — Bottom Navigation: Slot Count

| | Instruction |
|---|---|
| **DESIGN-SPEC §8** | 4 tabs: "Home · Offers · Orders · Profile" |
| **VISUAL_BIBLE §9** | 5 slots: "الرئيسية · الطلبات · المفضلة · المحفظة · الحساب" |
| **Current implementation** | 5 slots: الرئيسية, طلباتي, سلتي (cart FAB center), المحفظة, حسابي (matches VISUAL_BIBLE count) |
| **Authoritative** | **VISUAL_BIBLE §9** for Lovable parity. |

---

## CONFLICT 9 — Bottom Navigation: Floating vs. Full-Width

| | Instruction |
|---|---|
| **DESIGN-SPEC §6** | `fixed bottom-0 inset-x-0` — full screen width |
| **VISUAL_BIBLE §9** | "floating pill container, full-width minus 16px margins" — floats with side margins |
| **Current implementation** | `left: 16px; right: 16px` — floating with margins (matches VISUAL_BIBLE) |
| **Authoritative** | **VISUAL_BIBLE §9**. Current implementation is correct. |

---

## CONFLICT 10 — Pulse-Glow Animation Duration

| | Instruction |
|---|---|
| **DESIGN-SPEC §7** | `animation: pulse-glow 2.4s ease-in-out infinite` |
| **VISUAL_BIBLE §10** | "CTA pulse-glow on idle 4s" |
| **Current implementation** | The `animate-pulse-glow` class is defined in `index.css` — need to check which duration is set |
| **Authoritative** | **VISUAL_BIBLE §10** (4s). Slower pulse = more premium and less distracting. DESIGN-SPEC's 2.4s is faster and feels more anxious. |

---

## CONFLICT 11 — Offer Banner Height

| | Instruction |
|---|---|
| **DESIGN-SPEC** | Not explicitly specified for offer banners |
| **VISUAL_BIBLE §10** | "height 150–170" |
| **Current implementation** | 178px (hero VIP banner: 200px) — both exceed VISUAL_BIBLE's range |
| **Authoritative** | **VISUAL_BIBLE §10** for offer cards (150–170px). The VIP hero banner is a Phase 5 addition not in either original spec; the 200px height is a user-directed decision. |

---

## CONFLICT 12 — Lime CTA: Black Shadow Prohibition

| | Instruction |
|---|---|
| **DESIGN-SPEC** | Not explicitly addressed |
| **VISUAL_BIBLE §2 (Z5 law)** | "lime elements never carry black shadows… glow substitutes shadow" |
| **Current implementation** | Lime CTAs carry both `box-shadow: 0 0 20px rgba(163,249,91,0.55)` (glow ✓) AND `0 4px 12px rgba(0,0,0,0.40)` (black shadow ✗) |
| **Authoritative** | **VISUAL_BIBLE §2**. Black drop shadows on lime CTA buttons violate the Z5 law. Only the lime glow should be present. |

---

## CONFLICT 13 — Card Border: Uniform vs. Graded

| | Instruction |
|---|---|
| **DESIGN-SPEC §4** | `.glass { border: 1px solid oklch(1 0 0 / 0.14); }` — single uniform border, all sides equal |
| **VISUAL_BIBLE §2 + §3** | "top edge rgba(255,255,255,.14), sides .07, bottom nearly invisible" — three brightness levels; **elevation = brightness of the top edge** |
| **Current implementation** | Graded border: top `0.12–0.16`, sides `0.06–0.08`, bottom `0.03` (matches VISUAL_BIBLE) |
| **Authoritative** | **VISUAL_BIBLE §2/§3**. The graded border is the Z-layer lighting law. Current implementation is correct. |

---

## CONFLICT 14 — Card Body Gradient Direction

| | Instruction |
|---|---|
| **DESIGN-SPEC §1** | `--gradient-obsidian: linear-gradient(180deg, …)` — vertical (correct), but also `linear-gradient(135deg, …)` used in some component examples (diagonal) |
| **VISUAL_BIBLE §3** | "Body gradient — vertical graphite, light-to-dark, 180°; **never horizontal, never radial**" |
| **Current implementation** | Offer banners use `linear-gradient(135deg, …)` (diagonal — violates VISUAL_BIBLE); restaurant card body uses `linear-gradient(180deg, …)` (correct) |
| **Authoritative** | **VISUAL_BIBLE §3**. Card bodies must use 180° vertical gradient. 135° diagonal is prohibited. The offer banner background is currently diagonal. |

---

## CONFLICT 15 — Primary CTA Height

| | Instruction |
|---|---|
| **DESIGN-SPEC §6** | Primary CTA: `h-14` = 56px |
| **VISUAL_BIBLE §13** | Wallet top-up CTA: 52h (52px) |
| **VISUAL_BIBLE §15** | Checkout CTA: 56h (56px) |
| **Current implementation** | Offer banner CTA: 36h; Hero CTA: 38h; Wallet CTA: 52h; Checkout: ~56h |
| **Authoritative** | **Context-dependent**: banner CTAs are pill-style (36–40px per §10), full-width screen CTAs are 52–56px (per §13/§15). No single number applies to all CTAs. |

---

## CONFLICT 16 — Wallet Balance Alignment

| | Instruction |
|---|---|
| **DESIGN-SPEC** | Not specified |
| **VISUAL_BIBLE §13** | "balance block centered" — horizontally centered on screen |
| **Current implementation** | Balance displayed left-aligned inside a card (`flex-start`) |
| **Authoritative** | **VISUAL_BIBLE §13**. Balance amount and its SAR currency glyph should be centered. |

---

## CONFLICT 17 — Background Body Lime Intensity

| | Instruction |
|---|---|
| **DESIGN-SPEC §3** | Central lime halo: `oklch(0.92 0.22 130 / 0.08)` — 8% opacity |
| **VISUAL_BIBLE §1** | "Lime ≈ 4–6% of any screen's area" — body background lime should be minimal |
| **Current implementation** | `oklch(0.92 0.22 130 / 0.08)` in body background (matches DESIGN-SPEC; marginally above VISUAL_BIBLE's 6% area rule) |
| **Authoritative** | **VISUAL_BIBLE §1**. The area-percentage rule is a global law. Reducing from 0.08 to 0.05–0.06 would bring the body orb inside the rule without conflict. |

---

## CONFLICT 18 — Offer Banner Illustration Side (RTL Layout)

| | Instruction |
|---|---|
| **VISUAL_BIBLE §10** | "Right 45%: text column; Left 55%: cinematic food/vehicle photograph" — in RTL, "right" = logical start = visually right on screen; illustration on visual left |
| **Current offer banners** | Illustration on CSS `left` (visual left ✓), text on CSS `right` (visual right ✓) — matches VISUAL_BIBLE |
| **Current hero VIP banner** | Illustration on CSS `right` (visual right ✗), text column also on CSS `right` (overlapping) — text is covered by illustration, scrim required to rescue legibility |
| **Authoritative** | **VISUAL_BIBLE §10**. Hero banner illustration should be on visual left (CSS `left`), text on visual right (CSS `right`), matching the offer card pattern. Current hero implementation is reversed. |

---

## CONFLICT 19 — Radii: Category Tiles

| | Instruction |
|---|---|
| **DESIGN-SPEC §5** | `rounded-2xl` — Tailwind class (16px in v3, varies in v4) |
| **VISUAL_BIBLE §3** | "rows 16 / cards 22 / hero & sheets 28 / pills ∞" — category tiles are closer to "cards" = 22px |
| **Current implementation** | `border-radius: 50%` (circular — overrides both) |
| **Authoritative** | If restoring to spec: **VISUAL_BIBLE §3** suggests 22px for card-class surfaces; DESIGN-SPEC §5 suggests `rounded-2xl` (16px). VISUAL_BIBLE is more precise. |

---

## CONFLICT 20 — Home Screen Route Content

| | Instruction |
|---|---|
| **DESIGN-SPEC §8** | `/home` = "Header · Search · Category tiles · Offers · Restaurants" — 5 sections |
| **VISUAL_BIBLE** | No explicit home screen hierarchy document; inferred from §10, §11, §9 components |
| **Current implementation** | Header · Hero VIP Banner · Search · Categories · Offers · Restaurants · Featured Stores · Benefits — 8 sections (per Phase 5 user instruction) |
| **Authoritative** | **User instruction (Phase 5)**. The Hero Banner, Featured Stores, and Benefits sections are user-directed additions that expand the DESIGN-SPEC baseline. Neither spec prohibits them. |

---

## SUMMARY TABLE

| # | Topic | DESIGN-SPEC says | VISUAL_BIBLE says | Currently | Authoritative |
|---|---|---|---|---|---|
| 1 | Category shape | `rounded-2xl` (square) | Square | `rounded-full` (circular) | VISUAL_BIBLE (user override active) |
| 2 | Category columns | 4-col | 3-col | 4-col | User instruction (4-col) |
| 3 | Category icon glow | Neon halo ✓ | No glow | Glow on (DESIGN-SPEC) | VISUAL_BIBLE (user override active) |
| 4 | Category content | Lucide icons | 3D renders | Lucide icons | DESIGN-SPEC (assets unavailable) |
| 5 | Category label size | 11px | 13px | 10px | VISUAL_BIBLE (13px) |
| 6 | Glass scope | Everywhere | Only over imagery | Everywhere | VISUAL_BIBLE |
| 7 | Search material | Glass | Polished silver | Silver | VISUAL_BIBLE ✓ |
| 8 | Nav slots | 4 | 5 | 5 | VISUAL_BIBLE ✓ |
| 9 | Nav width | Full-width | Floating (−16px margins) | Floating | VISUAL_BIBLE ✓ |
| 10 | Pulse-glow duration | 2.4s | 4s | Check index.css | VISUAL_BIBLE (4s) |
| 11 | Offer banner height | Not specified | 150–170px | 178px | VISUAL_BIBLE |
| 12 | Lime CTA shadows | Not specified | No black shadows | Has black shadow | VISUAL_BIBLE |
| 13 | Card border | Uniform 1px | Top 2× brighter | Graded | VISUAL_BIBLE ✓ |
| 14 | Card gradient dir | 135° some uses | 180° only | Mixed | VISUAL_BIBLE |
| 15 | CTA height | 56px (full-width) | 52–56px by context | Contextual | Context-dependent |
| 16 | Wallet balance | Not specified | Centered | Left-aligned | VISUAL_BIBLE |
| 17 | Body lime opacity | 0.08 | ≤6% area | 0.08 | VISUAL_BIBLE (reduce slightly) |
| 18 | Hero banner: illus. side | Not specified | Illustration on visual left | Reversed (visual right) | VISUAL_BIBLE |
| 19 | Card radius | rounded-2xl (16px) | 22px for cards | 22px (offer) / 50% (categories) | VISUAL_BIBLE |
| 20 | Home sections | 5 sections | Inferred | 8 sections | User instruction |

---

## KEY FINDING

The two documents represent different phases of the same design language:

- **VISUAL_BIBLE** = forensic reconstruction of the original Lovable reference board (source of truth for "what it looks like now").
- **DESIGN-SPEC** = aspirational implementation guide written separately (describes how to build it, with some detail that diverges from the actual Lovable board).

**When in conflict, VISUAL_BIBLE should be treated as authoritative** for visual parity decisions. DESIGN-SPEC should be used for implementation guidance (naming, token values, component structure) when VISUAL_BIBLE is silent on a topic.

The three highest-impact unresolved conflicts (by visual distortion):
1. **Conflict 6** — Glass used on cards/tiles where graphite is specified (broad visual character shift)
2. **Conflict 18** — Hero banner illustration is on the wrong side (reverses the intended layout)
3. **Conflict 12** — Black shadows on lime CTAs (violates Z5 law)

---

*Report generated: 2026-06-18. No code was modified.*
