# HAAT NOW Website Studio — Overview

A visual application builder inside the HAAT NOW admin. Built across Phases 8A–9E; every subsystem
plugs into one shared architecture.

## Surfaces (all open from `WebsiteCenter`)
- **Website Studio** — CMS pages/blocks (pre-existing block model + versions).
- **Application Studio** — live runtime preview of Customer/Merchant/Driver apps via the Runtime
  Registry/Adapters; Runtime Selection → Inspector → transaction editing → undo/redo → draft (8A–8I).
- **Motion Studio** (8J/8K) — entry-screen layers/timeline/effects/presets, device preview, boot
  simulator, validated publish pipeline + versioning.
- **Visual Component Platform** (9A) — component library (14 categories, 87 components), drag & drop
  canvas, responsive breakpoints, property inspector, reusable master/instance components, design tokens.
- **Application Logic Platform** (9B) — variables, data binding, actions, state, conditions, forms,
  workflows, live debugger; safe expression engine.
- **Visual Data Platform** (9C/9D) — see `DataPlatform.md`.

## One unified architecture
- **One store**: `BuilderStore` (design model undoable; rows + runtime state separate).
- **One registry**: Component Registry (+ Runtime Registry for app screens).
- **One renderer**: registry render functions (`NodeView`) / runtime adapters.
- **One expression/binding engine**: `logic/expression.ts`.
- **One query engine**: `data/queryEngine.ts`.
- **One publish/versioning path**: `DraftEngine` + `PublishEngine`.

## Guarantees (CI-enforced)
- Architecture Guardian: 0 cycles, 0 violations (516 files).
- Feature isolation: `features/*` never import sibling features; no `lib/supabase` in features.
- Demo isolation: fabricated datasets gated behind `DEMO_CONTENT_ENABLED`.

## Verification harnesses
- Unit: `npm run test:website` (738 tests; pure engines).
- Studio regression: `docs/testing/app_studio_shots.cjs` (43), `experience_studio_shots.cjs` (32).
- Stress: `npx tsx scripts/stress-9e.ts`.
- Per-phase browser verifications (Puppeteer) run against local + production.
