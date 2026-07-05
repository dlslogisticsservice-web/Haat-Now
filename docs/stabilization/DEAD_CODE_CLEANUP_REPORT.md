# Dead Code Cleanup Report
**HaaT Now — Phase 6 (Production Code Quality & Technical Debt Reduction)**
Date: 2026-07-05. Every removal was re-verified against the *current* tree (post-Phase-2), done as its own gated commit (tsc → build → E2E 24/24), and is backward-compatible.

## Dependencies removed (6) — commit `1865270`
Re-verified **0 imports/requires** across the entire repo before removal:
| Package | Why dead |
|---|---|
| `@google/genai` | The "AI" module was never implemented — this dep was its only trace |
| `react-router-dom` | App uses role-based conditional render, not a router |
| `motion` | 0 imports |
| `express` | 0 imports; no `server.js`; the only `'express'` string is an unrelated vertical enum |
| `dotenv` | 0 imports |
| `@types/express` (dev) | Dead with `express` |

`package.json`: **deps 21 → 16, devDeps 11 → 10.** Build + E2E unaffected (nothing imported them).

## Files removed (9) — commit `e0a0436`
Re-verified **0 live importers** (transitive dead confirmed):
| File | Note |
|---|---|
| `src/utils/seedHelper.ts` | superseded by `demoSeed` |
| `src/components/layout/AppPageLayout.tsx` | 0 importers → `layout/` dir removed |
| `src/components/location/LocationPicker.tsx` | 0 importers |
| `src/components/location/LocationCard.tsx` | 0 importers |
| `src/components/location/DistanceBadge.tsx` | only imported by dead `LocationCard` → `location/` dir removed |
| `src/components/location/EtaBadge.tsx` | only imported by dead `LocationCard` |
| `src/assets/CategoryIllustrations.tsx` | 0 importers |
| `src/components/ui/TopAppBar.tsx` | only re-exported by the barrel; no live consumer |
| `src/components/ui/BottomNavBar.tsx` | only re-exported by the barrel; no live consumer |

Also removed the `TopAppBar`/`BottomNavBar` re-exports from `src/components/ui/index.ts` (no live consumers). Two now-empty directories (`components/location/`, `components/layout/`) are gone.

## Unused imports / locals removed (24) — commit `b17ec54`
`tsc --noUnusedLocals` proved 24 symbols dead across 18 files (mostly leftovers from the Phase-2 repository migration): unused lucide icons (`MapPin`, `Truck`, `Building2`, `Plus`, `UserCircle2`, `LayoutTemplate`), `StatCard`/`SidebarSection`, `authService`/`useTranslation`/`useRbac`, the `OrderItem`/`OrderStatusHistory`/`DBOffer` type imports, and dead locals (`SummaryRow` component, `batt` dead-write, `displayBranches`, `currentStatusIndex`, `cur`, `country`, `lang`×2, `can`, `has`). All removals are behaviour-preserving (dead writes / unused declarations only). **`noUnusedLocals` is now enabled** so this can never regress.

## Not removed (verified NOT dead)
- `product.service.ts` — used by `OrdersList` (corrects a stale internal cleanup note).
- `recharts`, `@vis.gl/react-google-maps`, `lottie-react`, `i18next`/`react-i18next` — all have live importers.
- The `platform.service.ts:5` "TODO seam" — a still-accurate description of the unwired production `platform_registry` path (not obsolete).

## Verification
Each cleanup commit passed `tsc` (+ arch guard) + `npm run build` + `node docs/testing/e2e_runner.cjs` = **24/24**. No functionality removed, no UI changed.

**Totals: 9 files removed · 6 dependencies removed · 24 unused symbols removed · 2 empty dirs removed.**
