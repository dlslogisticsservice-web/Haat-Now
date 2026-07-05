# Technical Debt Report
**HaaT Now — Phase 6 (Production Code Quality & Technical Debt Reduction)**
Date: 2026-07-05. Debt measured before/after this sprint (baseline = the enterprise audit + Phase-2 state).

## Debt scorecard — before → after
| Metric | Before | After | Change |
|---|---:|---:|---|
| Unused dependencies | 6 | **0** | ✅ removed |
| Dead files | 9 | **0** | ✅ removed |
| Empty/duplicate dirs | 2 (`location/`,`layout/`) | **0** | ✅ removed |
| Documentation roots | 2 (`docs/` + `documentation/`) | **1** | ✅ merged |
| Generic package name | `react-example` | **`haat-now`** | ✅ renamed |
| Unused imports / locals | 24 | **0** | ✅ + `noUnusedLocals` guard |
| `tsconfig` strictness flags | 0 | **3** | ✅ `forceConsistentCasing`, `noFallthroughCasesInSwitch`, `noUnusedLocals` |
| Duplicated persistence helpers | 7 inline | **1** (`lib/kv.ts`) | ✅ (Phase-2 S7) |
| Features importing `lib/supabase` | 11 | **0** | ✅ (Phase-2) + CI-guarded |
| `@ts-ignore` | 0 | **0** | ✅ (already clean) |
| Debt markers (TODO/FIXME/HACK) | 2 | 2 | — both verified non-actionable (UI placeholder + valid seam) |
| `as any` casts | 100 | 100 | ⏳ unchanged (see remaining) |
| src files / LOC | 169 / 28,653 | 182 / 28,278 | +repository layer, −dead code |

*(File count rose because Phase-2 added the 19-file repository layer — an architectural improvement — while LOC fell despite it, thanks to dead-code removal and thinner service bodies.)*

## What was reduced
- **Dependency surface**: 6 packages + their transitive trees gone (smaller install, smaller attack surface).
- **Dead code**: 9 files + 24 unused symbols, now guarded by `noUnusedLocals`.
- **TypeScript rigor**: 3 zero-cost strict flags enabled; casing + switch-fallthrough + unused-locals now fail CI.
- **Structure**: single doc root, product-named package, single persistence primitive (Phase-2).

## Remaining debt (honest, prioritized)
| # | Debt | Size | Recommended approach |
|---|---|---|---|
| R1 | **`as any` = 100** | L | Load-bearing today (loose Supabase types + sandbox stub `any`). Reduce by generating typed Supabase types + enabling `strictNullChecks`, then removing casts file-by-file. Not safe to bulk-remove now (each masks a real gap). |
| R2 | **Full `tsconfig strict` off** | L | `strictNullChecks`/`noImplicitAny` would surface many errors; enable incrementally after R1. Interim: `noImplicitReturns` (14 errors) and `noUnusedParameters` (~a dozen) are smaller next steps. |
| R3 | **Two i18n systems** | L | ~1,278 inline `L('ar','en')` calls vs `react-i18next` in ~11 files. Consolidate onto `react-i18next` (audit finding; large mechanical pass). |
| R4 | **23 low-traffic services still call Supabase directly** | M | Continue the Phase-2 service→repository migration (one per commit) for admin/ops/growth/website/auth/storage. |
| R5 | **6 oversized components** (MerchantApp 1220, ProfileScreen 1156, …) | L | Phase-2 deferred; split screen-by-screen with E2E verification. |
| R6 | **Cross-feature imports (4)** + shared component relocation | S | Move `NotificationCenter`/`OnboardingForm`/website pieces to `src/components/*`. |

R1–R6 are documented backlog items with clear, gated approaches. None block the current build (all CI-green); they are quality/scalability improvements for later gated passes.

## Net
Actionable, provable debt (dead deps/files, unused symbols, duplicate roots, generic name, missing unused-locals guard) is **eliminated**. The remaining debt (`as any`, full strict, i18n, remaining service migrations, god-object splits) is **larger, riskier, and explicitly sequenced** — appropriate for dedicated future passes rather than a rushed cleanup.
