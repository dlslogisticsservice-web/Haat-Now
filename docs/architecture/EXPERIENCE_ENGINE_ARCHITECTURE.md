# Experience Engine — Architecture (Phase 1, Wave 1: Foundation)

> The Experience Engine chassis. A pure, isolated, interface-first library under
> `src/experience-engine/`. It compiles, is tested, and is **not yet connected** to Website
> Studio or any runtime. Built to the source-of-truth docs `EXPERIENCE_STUDIO_PHASE0.md`
> and `EXPERIENCE_PLATFORM_PHASE0_5.md`.

## Folder structure
```
src/experience-engine/
  index.ts          Public API barrel (the ONLY import surface)
  types.ts          Shared primitives + Result idiom (ok/err/isOk/isErr)
  metadata.ts       10 metadata models (Experience/Component/Channel/Renderer/Theme/Asset/Analytics/Rule/Plugin/Validation)
  tree.ts           Visual component-tree models (TreeNode/ComponentNode/LayoutNode + Studio projections)
  schema.ts         Experience Schema hierarchy (Base → 7 channel schemas)
  events.ts         Typed event model + EventMap (14 events)
  context.ts        Core request/response (Context/Request/Response/Resolution/Descriptor/Manifest/Version/Environment)
  ports.ts          20 ports (Config/Storage/Publishing/Rendering/Analytics/Rules/Theme/Asset/Registry/Localization/Navigation/FeatureFlag/Experiment/Tenant/Permission/AI/Notification/Logging/EventBus/Health)
  channels.ts       7 channel contracts + base (Website/Customer/Driver/Merchant/Affiliate/Partner/Admin)
  registries.ts     Generic InMemoryRegistry + 10 named EMPTY registries
  services.ts       15 service skeleton contracts (resolvers + coordinators)
  sdk.ts            Plugin SDK contracts (register* — interfaces only)
  marketplace.ts    Marketplace contracts (Package/Theme/Component/Plugin/Template/Bundle/Manifest/Version/Dependency/Signature)
  engine.ts         ExperienceEngine interface + createExperienceEngine() chassis
  __tests__/foundation.test.ts   8 tests pinning purity + honesty
```

## Responsibilities (by layer)
- **types** — the platform vocabulary (ids, channels, roles, locales, devices, environments) + the predicate-guarded `Result` (repo has no `strictNullChecks`).
- **metadata** — everything describable/governable: what the registries hold, the Studio lists, the AI builder composes within, Guardian audits.
- **schema** — the channel-neutral `BaseExperienceSchema` and its 7 channel extensions; forward-compat via an `ext` bag (preserves unknown newer fields).
- **tree** — an experience as a node tree (runtime) + Studio projections (canvas/selection/inspector/hierarchy).
- **events** — the observable surface; everything the Engine does emits one.
- **context** — WHO asks / WHAT they asked / WHAT they get; descriptors describe registered experiences.
- **ports** — every external concern as an interface an adapter satisfies later.
- **channels** — how experiences reach a surface; each channel is a descriptor bound to its schema.
- **registries** — the Engine's catalogs; empty at foundation stage.
- **services** — the resolver/coordinator seams later waves fill.
- **engine** — composes registries + (optional) ports/services; `resolve()` is honest `not-found` until a resolver is installed.

## Dependency rules (enforced by construction)
1. **Purity** — no imports from React, DOM, Supabase, `src/features`, or `src/services`. Verified: Guardian shows **0 edges** from the engine into other layers.
2. **No clock/randomness** — the engine takes `context.now`; `resolve()` is deterministic and unit-testable.
3. **Single inbound edge** — everything is reached through `index.ts`, so Guardian dead-code analysis sees every file as live (verified: 0 engine files flagged dead).
4. **No runtime cycles** — cross-file references are `import type` (erased); Guardian reports **0 cycles**.
5. **Additive only** — no existing file's behavior changed; the sole non-engine edit is one additive line registering the test directory.

## Extension points
- **Ports** — swap any external implementation without touching the core.
- **Registries** — register channels/components/themes/rules/renderers/etc.
- **SDK** (`register*`) — the contributor surface for plugins and the Marketplace.
- **Channels** — add a channel = a descriptor + a RenderingPort adapter; the Engine is untouched (supports future Kiosk/TV/Car/Voice/AR/VR per §15 of the platform doc).

## Ports · Registries · Metadata · Schemas · SDK · Marketplace
See the corresponding source files — each is interface-first and documented inline. Counts:
**20 ports · 10 registries · 10 metadata models · 8 schemas (base + 7) · 15 services · 14 events · 9 SDK registration contracts · 10 marketplace contracts · 7 tree models.**

## Future integration plan (NOT this phase)
- **Wave 2** — install real resolvers (Context/Version/Rule/Experience) behind the ports; register **Website as Channel #1** via an adapter over the existing runtime/renderer (no rewrite).
- **Wave 3** — register **Customer App** (wrap `experience.service`), then the remaining channels.
- **Wave 4** — Remote Configuration delivery (signed, cached, offline-safe) behind `ConfigurationPort`.
- **Wave 5** — the Studio shell consumes the Engine; **Website Studio behavior stays identical**.
- **Wave 6+** — Rules/Personalization/Experiments unification, then the AI Experience Builder (draft-only), then new channels.

Every wave is additive, independently deployable, and reversible by deleting its directory — the foundation never forces a change to existing code.
