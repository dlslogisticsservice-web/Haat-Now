# SAFE_AREA_AUDIT.md

## Global fixes applied
1. **`index.html`** viewport → `width=device-width, initial-scale=1.0, viewport-fit=cover` (enables `env(safe-area-inset-*)`).
2. **Bottom nav** (`.bottom-nav`) → `bottom: calc(12px + env(safe-area-inset-bottom))` — clears the iPhone home-indicator / Android gesture bar.
3. **Customer main** + **Profile** scroll containers → `paddingBottom: calc(104px + env(safe-area-inset-bottom))` — content never hides behind the floating nav (was `pb-24`/`72px`, flagged tight).
4. **Merchant & Admin portals** (CRITICAL, fixed) — `EnterpriseSidebar` is `hidden md:flex`, but content kept a hard `margin-inline-start: 280px` on all sizes → mobile content was crushed into ~95px. Changed to `md:ms-[280px]` so **mobile uses full width**; the 280px offset applies only at `md+` (where the sidebar exists).

## Runtime overlap audit (iPhone SE 375×667, prior + this sprint)
| Screen | Result |
|---|---|
| Customer home / restaurant / wallet / profile | ✅ no control overlaps nav (nav band y≈597–655) |
| Merchant / Admin | ✅ content now full-width on mobile (was crushed) |
| Bottom nav vs FAB / checkout swipe | ✅ FAB (84px) + swipe CTA (88px) sit above nav band |

## Cross-device reasoning
- The fixes are size-independent (`env()` + responsive class). Notched iPhones (X+) get safe-area padding; Android gesture bars covered; tablet/desktop show the sidebar at `md+` with the offset.
- Verified at runtime on iPhone SE (worst case for height) + 4-col/8-col responsive grid checked at 393/1024 widths.

## Remaining (documented, not regressions)
- Keyboard-safe handling for fixed-bottom CTAs (`visualViewport` listener) — not yet added; on-screen keyboard can overlay the checkout swipe CTA. Tracked for a follow-up.
- Merchant/Admin mobile **navigation** (sidebar is desktop-only) — content is now usable full-width, but a mobile drawer/hamburger is a future enhancement.

## Status: ✅ critical overlaps fixed; keyboard + mobile-sidebar-nav noted
