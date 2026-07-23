# Experience Studio — Phase 0: Freeze, Backup & Transformation Plan

> Planning only. No code changed, nothing extracted, no Experience Studio created.
> Every fact below is verified from the repository at commit `c233720` (+ uncommitted sprint work).

## Repository Health (STEP 1 — verified now)
| Gate | Result |
|---|---|
| TypeScript (`tsc --noEmit`) | ✅ 0 errors |
| Architecture boundary | ✅ 0 feature→lib/supabase imports |
| Demo isolation guard | ✅ 3 datasets gated, 0 strays |
| Unit/integration tests | ✅ 369 / 369 |
| Build (sandbox) | ✅ + Guardian snapshot emitted |
| Guardian validation | ✅ 0 architectural regressions |
| Production readiness | ✅ 90% (config gaps are manual) |

**Working tree:** branch `feat/website-platform-architecture`, last commit `c233720`, **28 modified + 37 untracked** files (all prior-sprint work) **uncommitted**. This MUST be committed before tagging or the tag will not capture it.

## Backup (STEP 2 — instructions only; run nothing automatically)
```bash
# 1. Commit the current green state first (28 M + 37 ?? are uncommitted).
git add -A
git commit -m "chore: freeze pre-Experience-Studio (369 tests green, Guardian pass)"

# 2. Tag the frozen baseline.
git tag -a v1.0-pre-experience-studio -m "Frozen baseline before Experience Studio transformation"

# 3. Create the transformation branch.
git switch -c feature/experience-studio      # (alt: experience-studio-v1)

# Rollback at any time:
git switch feat/website-platform-architecture # back to the working branch
git reset --hard v1.0-pre-experience-studio   # restore exact frozen tree (destructive)
git tag -d v1.0-pre-experience-studio         # remove tag if re-cutting
```
Nothing is pushed. The tag is the single restore point for every later phase.

## Architecture Snapshot (STEP 3 — from source)
| Concern | Where it lives (verified) | Lines |
|---|---|---|
| Website Studio UI (canvas/inspector/blocks/publish) | `src/features/admin/WebsiteCenter.tsx` | 1074 |
| Shared Studio primitives (Field/Select/Toggle/styles) | `src/features/admin/studioUI.tsx` | 100 |
| Component Registry (React block renderers) | `src/features/website/blocks.tsx` | 825 |
| Component Registry (string SSR renderers) | `src/website-platform/rendering/renderer.ts` | 161 |
| Media Library | `src/features/website/MediaPicker.tsx` + `experience/assets.service.ts` | 71 |
| Content model + Draft/Publish/Version/Rollback | `src/services/website.service.ts` (`Record_{draft,published,version,history}`) | 708 |
| Schema + validation + migration | `src/services/websiteSchema.ts` | 194 |
| Publishing engine | `src/website-platform/publishing/{engine,contracts}.ts` | 256 |
| SEO Studio | `src/website-platform/seo/seo.ts` | — |
| Theme Engine / Design Tokens | `src/design/designSystem.ts` + `DesignContext.tsx` | — |
| Feature Flags | `src/website-platform/flags/flags.ts` (`WEBSITE_FLAGS`, `FlagContext`, `Environment`) | — |
| Rules / Experiments / Promotions | `website-platform/growth/experiments.ts`, `promotions/`, `marketing/` | — |
| Website Runtime | `features/website/runtime.ts`, `PublicSiteApp.tsx`, `features/site/SiteApp.tsx` | — |
| Persistence / Repositories | `website-platform/repositories/*`, `persistence/unit-of-work.ts` | — |
| Guardian integration | discovery graph nodes (routes/services); `guardian/ops/*` gate | — |

**Platform scope:** `src/website-platform/` is a 37-domain library (rendering, publishing, seo, flags, growth, analytics, conversion, promotions, events, outbox, realtime, workers, persistence, repositories, domain, finance, …).

**Critical coupling (verified):** `website-platform` is already imported **outside** website —
`src/services/payment-orchestrator.service.ts` (uses `finance/cod`), `src/services/marketing.service.ts`, `src/features/admin/MarketingOS.tsx`. It is therefore **already a partially-shared platform**, not website-only. Any "extraction" must not break payments or marketing.

## Shared Components Matrix (STEP 4 — identify only, extract nothing)
| Candidate | Exists today as | Reuse readiness |
|---|---|---|
| Canvas / preview | `WebsiteCenter.tsx` (inline) | Coupled to website.service — needs a surface descriptor |
| Inspector / Property Panel | `studioUI.tsx` (`Field/Select/Toggle`) + WebsiteCenter editors | **High** — already generic UI primitives |
| Layers / Selection / History / Undo/Redo | `website.service` (`version` + `history[]`), WebsiteCenter selection state | Medium — versioning shared; selection is inline |
| Component Registry | `blocks.tsx` (React) **and** `renderer.ts` (string) — two parallel registries | Medium — unify behind one descriptor |
| Assets / Media | `MediaPicker.tsx` + `experience/assets.service.ts` | **High** |
| Publishing | `website-platform/publishing/engine.ts` | **High** — already a service |
| Rollback / Versioning | `website.service` `Record_.history` + `version` | **High** — already a model |
| Theme Engine / Design Tokens | `design/designSystem.ts` (`applyDesign`, `mergeDesign`) | **High** — already centralized |
| Configuration Engine / Feature Flags | `website-platform/flags/flags.ts` | **High** — already generic (`Environment`, `FlagContext`) |
| Rules Engine | `growth/experiments.ts`, `promotions/`, `marketing/` | Medium |
| Renderer / Runtime interfaces | `rendering/renderer.ts`, `features/website/runtime.ts` | Medium — website-shaped, needs a channel-neutral contract |

## Target Experience Studio Architecture (STEP 5)
A **channel-agnostic authoring kernel** where **Website is one Experience Surface among many** — Website Studio is *plugged in*, never replaced.

```
Experience Studio (shell)
 ├─ Kernel (shared, channel-neutral)
 │   ├─ Studio UI primitives     ← studioUI.tsx
 │   ├─ Publishing               ← publishing/engine.ts
 │   ├─ Versioning / Rollback    ← website.service Record_ model
 │   ├─ Theme Engine / Tokens    ← design/designSystem.ts
 │   ├─ Media / Assets           ← MediaPicker + assets.service
 │   ├─ Feature Flags / Config   ← flags/flags.ts
 │   └─ Rules / Experiments      ← growth/promotions
 └─ Experience Surfaces (adapters — one per channel)
     ├─ Website Surface          ← blocks.tsx + renderer.ts + runtime.ts  (surface #1, unchanged behavior)
     ├─ Customer App Experience  ← future descriptor
     ├─ Driver / Merchant / Affiliate / Partner / Admin  ← future descriptors
```
Each surface supplies: a **block/component registry**, a **renderer**, a **schema**, and a **runtime binding**. The kernel owns everything shared.

## Migration Plan (STEP 6 — strangler-fig, additive, reversible)
Every phase is a pure ADDITION behind a facade; rollback = delete the new directory.

| Phase | Change | Reversible | Testable | Verify |
|---|---|---|---|---|
| **A** Kernel facade | New `src/experience-studio/kernel/` that **re-exports** existing primitives (no move/delete) | delete the dir | new re-export tests | 369 tests + Studio parity unchanged |
| **B** Surface contract | Define `ExperienceSurface` interface; register Website by **wrapping** blocks/renderer/schema (adapter, no rewrite) | delete adapter | contract tests | public site renders identically |
| **C** Studio shell | `WebsiteCenter` consumes a surface **descriptor** — behavior identical, code generalized | revert file | Studio parity + journeys | Studio↔Public parity check |
| **D** Kernel services | Formalize Theme/Media/Flags/Rules as kernel services (facades over existing) | delete facades | service tests | no runtime change |
| **E** Second surface | Add one non-website surface descriptor as proof | delete descriptor | surface test | additive only |
| **F+** DXP features | Shared Analytics / A/B / Personalization / Campaign engines | per-feature flag | per-feature | additive |

## Backward Compatibility (STEP 7 — guaranteed by construction)
| Guarantee | How |
|---|---|
| No broken imports | Kernel is a facade that re-exports; existing paths keep working |
| No broken routes | Routing untouched until Phase C (behavior-identical) |
| No broken APIs | `website.service` signature unchanged |
| No broken tests | Additive; existing 369 stay; new tests per phase |
| No broken Guardian | New graph nodes only; gate rules unchanged |
| No broken Production audit | `production_readiness_audit.cjs` unaffected |
| No broken Runtime | Public site render path untouched until a single registry is proven |
| No broken Website Studio | Unchanged until Phase C, then descriptor-driven with identical behavior |

## Risk Analysis (STEP 8)
- **High:** `WebsiteCenter.tsx` (1074 lines) is tightly coupled to `website.service` + `blocks.tsx`; generalizing risks Studio regressions → mitigate with the descriptor adapter, keep it working unchanged until the shell is proven.
- **High:** `website-platform` already feeds **payments** (`finance/cod`) and marketing → any refactor must keep `payment-orchestrator` + `marketing.service` green.
- **Medium (Runtime):** two parallel registries (React `blocks.tsx` + string `renderer.ts`, the latter feeding `dangerouslySetInnerHTML`); unifying risks the public site → keep both until one registry is verified.
- **Medium (Regression):** Studio↔Public parity relies on the fragile `seedVersion`/`draftDirty` logic in `website.service`; versioning generalization must preserve it.
- **Performance:** kernel indirection could add render cost → benchmark (`bench:website`).
- **Developer:** large surface; the facade prevents import churn.
- **User:** none while additive (Website Studio behavior frozen until Phase C proven).

## Files that WILL eventually change (STEP 12 — DO NOT modify now)
`src/features/admin/WebsiteCenter.tsx` · `src/features/admin/studioUI.tsx` · `src/features/website/blocks.tsx` · `src/website-platform/rendering/renderer.ts` · `src/website-platform/publishing/engine.ts` · `src/website-platform/flags/flags.ts` · `src/services/website.service.ts` · `src/services/websiteSchema.ts` · `src/design/designSystem.ts` · `src/design/DesignContext.tsx` · `src/features/website/runtime.ts` · `src/features/website/PublicSiteApp.tsx` · `src/features/site/SiteApp.tsx` · `src/features/website/MediaPicker.tsx`

## Estimated Effort
- Phases A–C (facade + contract + descriptor-driven shell): **~2–3 engineer-weeks**.
- Phases D–E (kernel services + second surface proof): **~2–3 weeks**.
- Full DXP vision (all channels + A/B + personalization + campaign engines): **~2–3 months** incremental, each phase shippable.
