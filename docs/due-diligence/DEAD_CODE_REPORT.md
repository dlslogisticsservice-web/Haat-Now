# Dead Code Report
**HAAT NOW — Enterprise Due-Diligence Audit (Part 3)**
Method: static import-graph analysis. For a file to be listed "dead," a search for imports of its path/basename across `src/` returned zero live consumers. High-confidence unless flagged UNVERIFIED. Read-only; nothing was deleted (per audit policy — this report *identifies*, it does not remove).

---

## 1. Confirmed dead files (0 importers in `src/`)

| File | Evidence | Confidence |
|---|---|---|
| `src/utils/seedHelper.ts` | No importer; runtime seeds via `demoSeed` (`main.tsx:21`), not this | High |
| `src/components/layout/AppPageLayout.tsx` | 0 matches for `from '…AppPageLayout'` | High |
| `src/components/location/LocationPicker.tsx` | 0 importers | High |
| `src/components/location/LocationCard.tsx` | 0 importers | High |
| `src/components/location/DistanceBadge.tsx` | Imported only by dead `LocationCard.tsx:1` → transitively dead | High |
| `src/components/location/EtaBadge.tsx` | Imported only by dead `LocationCard.tsx:2` → transitively dead | High |
| `src/assets/CategoryIllustrations.tsx` | 0 importers | High |
| `src/components/ui/TopAppBar.tsx` | Only re-exported by barrel `ui/index.ts:23`; no `<TopAppBar>` rendered anywhere | High |
| `src/components/ui/BottomNavBar.tsx` | Only re-exported by barrel `ui/index.ts:25`; no `<BottomNavBar>`/`CUSTOMER_NAV_ITEMS` consumer | High |

**Note on the UI barrel** `src/components/ui/index.ts`: near-dead — its only live consumer is `MerchantReports.tsx:2` (`import { Card }`). Every other file imports leaf modules directly (e.g. `…/ui/Primitives`). Removal candidate after re-pointing that one import.

**`src/db/`** is an empty directory (0 files).

## 2. Confirmed unused dependencies (`package.json`)

| Dependency | Evidence | Verdict |
|---|---|---|
| `@google/genai` | **0 imports** in the entire repo | REMOVE — *(also means the "AI" module is unimplemented; the dep is the only trace)* |
| `react-router-dom` | 0 imports; routing is role-based conditional render in `App.tsx:632-634` | REMOVE |
| `motion` | 0 imports (`\bmotion\b` → no files) | REMOVE |
| `express` | 0 imports/`require`; the only `'express'` match is an unrelated vertical-enum string in `platformModel.ts:9,112`; no `server.js` exists | REMOVE |
| `@types/express` (dev) | Dead with `express` | REMOVE |
| `dotenv` | 0 imports/`require` anywhere | REMOVE |

### Dependencies verified IN USE (do not remove)
`recharts` (`AdminDashboardHome.tsx:2`, `GrowthCenterB.tsx:3`) · `@vis.gl/react-google-maps` (`OrderTrackingMap.tsx:2`, `OrdersList.tsx:14`, `OperationsCommandCenter.tsx:3`) · `lottie-react` (`experience/blocks/LottieBlock.tsx:5`) · `i18next`/`react-i18next` (`i18n/index.ts` + 11 consumers) · `@supabase/supabase-js` (lib/services) · `@capacitor/*` (native shell) · `@tailwindcss/vite`, `lucide-react`.

## 3. Services — no orphans
A sweep of all 43 files in `src/services/` (+ `src/services/ops/`) for importers found **0 orphaned services** — every service has at least one live consumer. (Correcting a stale internal note in `docs/plans/PROJECT_CLEANUP_PLAN.md:7`: `product.service.ts` is **not** dead — it is used by `OrdersList.tsx:5`.)

## 4. Admin panels — no orphans
All 40 files under `src/features/admin/` are wired into a live shell (`AdminDashboard` → `OperationsCenter`/`DesignCenter` → sub-panels; verified importer-by-importer). None are dead. See the Duplication report for the two *redundant-but-live* pairs (GrowthCenter/GrowthCenterB) and naming collisions.

## 5. Unused assets / CSS / translations
- **Unused brand-asset slots (declared, no consumer):** `assets.service.ts` defines `invoice_logo_url` (`:35`) and `email_header_url` (`:36`) brand slots, but **no invoice or email generation exists** — these slots are placeholders with no rendering path (see White-Label review). Not "dead code" per se, but dead *capability wiring*.
- **CSS:** single Tailwind stylesheet (83 KB built); utility-based, so "unused CSS" is pruned by Tailwind's JIT at build. No hand-written dead stylesheets found (only `src/index.css` + tokens).
- **Translations:** the custom `L('ar','en')` strings are inline in components (no central catalogue to leave orphaned). The `i18next` catalogue in `src/i18n/index.ts` is small; a full unused-key analysis would require the two i18n systems to be unified first (see Duplication D2).

## 6. UNVERIFIED / caveats
- `src/platform/moduleRegistry.ts` references service files **by string** (`entryPoint`/`relatedServices`, e.g. `:132-133`, `:178-179`). These are **metadata strings, not `import()` calls** — they neither keep files alive nor were any dead file above found among them. No dynamic-import path was found that would resurrect any listed dead file.
- All deletions should be validated by the repo's own gate — `npm run lint` (`tsc --noEmit`) + `npm run build` — after removal. The dead-file list is high-confidence but a green typecheck is the final proof.

## 7. Cleanup impact
Removing the 9 dead files + 6 dead dependencies is **zero-risk** (no live importer) and would shrink `node_modules`, the dependency attack surface, and reader confusion. Estimated effort: **S** (an afternoon, gated by `tsc`/build). This is the top "Quick Win" in the cleanup roadmap.
