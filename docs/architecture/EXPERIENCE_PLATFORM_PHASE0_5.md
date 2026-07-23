# Experience Platform — Phase 0.5: Digital Experience Platform Architecture

> Architecture only. No code changed, nothing created. Evolves the Phase 0 plan from
> "Website Studio → Experience Studio" to an **Engine-centric Digital Experience Platform**.
> Every layer maps to a primitive that ALREADY exists in the repo (cited), so this is a
> generalization of proven engines — not a greenfield design.

## Inversion vs Phase 0
Phase 0 was Studio-centric (`Website Studio → Experience Studio`). Phase 0.5 makes the
**Engine the platform**; the Studio is only its management UI:

```
Digital Experience Platform (DXP)
   └─ Experience Engine        ← the platform (resolves + renders experiences)
        ├─ Experience Runtime   ← per-channel execution of an Engine-resolved experience
        └─ Experience Channels  ← Website, Customer, Driver, Merchant, Affiliate, Partner, Admin, future
   └─ Experience Studio         ← management interface ONLY (thin client over Engine services)
   └─ Experience Services       ← Registry, Config Delivery, Publishing, Versioning, Rules, AI, Analytics
```

## Repo primitives this design generalizes (verified)
| DXP concept | Existing primitive |
|---|---|
| Engine (ports + adapters, pure) | `src/guardian/kernel/*` (kernel, events, config, registry, permissions, audit, ai, jobs, health) |
| App-screen experiences (proto-channel) | `src/experience/experience.service.ts` (`screen_experiences`, draft/published/version/history, `${country}:${screen}`) |
| Website experiences | `src/services/website.service.ts` (`Record_{draft,published,version,history}`) |
| Component registries | `features/website/blocks.tsx` (React) + `website-platform/rendering/renderer.ts` (string) |
| Theme / tokens | `src/design/designSystem.ts` (`DesignConfig`, `applyDesign`, `mergeDesign`) |
| Feature flags / rules context | `website-platform/flags/flags.ts` (`FlagContext`, `FlagRule`, `FlagResolver`, `Environment`) |
| Events | `website-platform/events/bus.ts` (`EventBus`, typed events) |
| Publishing | `website-platform/publishing/engine.ts` |
| Experiments | `website-platform/growth/experiments.ts` |
| AI editing | `src/services/aiStudio.ts` (prompt→`WebsiteBlock[]`, deterministic hash seed) |
| Tenant resolution | `src/services/tenant.service.ts` |
| Config signing pattern | `supabase/functions/payment-webhook` (HMAC-SHA256, fail-closed) |

## 1. Digital Experience Platform — layer responsibilities
- **Experience Engine** — resolves *what to render, for whom, when* and drives rendering. Pure, ports-and-adapters (mirrors `guardian/kernel`). Owns the runtime modules in §2.
- **Experience Runtime** — executes an Engine-resolved experience on a specific target (React DOM today; string SSR for public site; native/voice/AR later via render adapters).
- **Experience Channels** — Website, Customer, Driver, Merchant, Affiliate, Partner, Admin, future. Each is a descriptor (§6 channel model).
- **Experience Studio** — the management UI (author, preview, publish, rollback, approve). Thin — calls Engine services; holds no runtime rendering logic. `WebsiteCenter` generalizes into it.
- **Experience Services** — Registry, Config Delivery, Publishing, Versioning, Rules, AI, Analytics — consumed by the Engine through ports.
- **Experience Registry** — global catalog of every experience (§7).
- **Experience Schemas** — Base → per-channel inheritance (§9).
- **Experience Components** — metadata-driven catalog (§8).
- **Experience Analytics** — event-driven telemetry (§14).
- **Experience Rules** — context decisioning (§10).

## 2/3/4. Experience Engine (the heart)
Modeled on the **Guardian kernel** (a proven pure kernel already in the repo). All external
concerns arrive through PORTS; nothing in the Engine imports React/Supabase/DOM directly.

Engine-owned runtime modules (each a pure resolver, adapter-backed):
`Context Resolution` (build `ExperienceContext`: tenant, role, country, locale, device, env,
flags, segment) → `Rules` → `Version Resolution` → `Layout Engine` → `Component Engine`
(from the metadata catalog) → `Theme Engine` (tokens, white-label) → `Personalization` /
`Experiments` (variant selection) → `Rendering` (channel render adapter) → `Navigation` →
`Analytics Hooks` (emit events) → `Localization` (RTL/LTR). Plus `Publishing`, `Rollback`,
`Feature Flags`, `Tenant Resolution`, `White-Label Resolution`.

Engine ports (adapters supplied per host/channel): `ConfigDeliveryPort`, `StoragePort`,
`RenderPort` (target-specific), `ClockPort`, `EventPort`, `RulesPort`, `AiPort`,
`AnalyticsPort`. This is what makes the Engine channel- and target-agnostic.

**Runtime resolution flow:** request → resolve context → Rules pick experience+variant →
Version Resolution picks the published version for that context → Layout+Component Engines
build the tree from the metadata catalog → Theme applies tokens → RenderPort emits for the
channel → Analytics hooks fire.

## 5. Remote Configuration
Change experiences without rebuilding apps.
- **Storage:** Supabase tables (source of truth) — generalize `screen_experiences` + `website_*` into `experience_configs` (tenant, channel, experience, version, status, config, signature).
- **Delivery:** a signed, versioned config bundle per `{tenant, channel, env}` served from an edge function (CDN-cacheable).
- **Cache:** in-memory + `localStorage` **offline cache**; stale-while-revalidate; TTL/**expiration**.
- **Version resolution:** serve the published version matching context; staging overrides for previews.
- **Rollback:** serve a prior version id (history already modeled in website.service/experience.service).
- **Conflict detection:** optimistic version/etag; reject stale writes — generalize the existing `seedVersion`/`draftDirty` parity guard.
- **Validation:** schema-validate before publish (generalize `websiteSchema`).
- **Signing/Security:** HMAC-sign the bundle (reuse the payment-webhook HMAC pattern); client verifies authenticity; RLS-scoped reads; **no secrets in config**.
- **Environment overrides:** the `Environment` dimension already in `flags` (`production|staging|development|sandbox`).
- **Fail-safe:** on delivery failure, fall back to the last-known cached bundle, then to the baked-in baseline — never a blank experience.

## 6. Channel architecture (replaces "Surface")
Each **Channel** is a descriptor: `{ id, runtime (RenderPort adapter), navigation graph, layout schema, component registry subset, permissions/roles, publishing pipeline, analytics events }`.
- **Website** — Channel #1 (existing `features/website/runtime.ts` + renderer).
- **Customer App** — Channel #2 (existing `experience.service` splash/login/onboarding + home).
- **Driver / Merchant / Affiliate / Partner / Admin** — descriptors over their existing feature apps.
- Adding a channel = register a descriptor + a RenderPort adapter; the Engine is untouched.

## 7. Experience Registry (global)
A row per experience: `{ id, name, channel, platforms[], devices[], roles[], requiredPermissions[], locales[], themes[], featureFlags[], publishingStatus, version, dependencies[] }`.
The Registry answers "what experiences exist, for which channel/role/device, at which version."
Guardian's discovery graph becomes a consumer (experiences are nodes).

## 8. Component Metadata Model
Every component becomes metadata-driven:
`{ id, name, version, supportedChannels[], supportedRoles[], responsive, rtl, darkMode,
accessibility, featureFlagKey?, abTestable, personalizable, analyticsEvents[], dependencies[],
permissions[], validationRules, previewSupport, publishingConstraints }`.
The catalog is what the Layout/Component Engines resolve from, what the Studio lists, and what
the AI builder composes within. Today's `blocks.tsx` renderers become metadata entries + a
render impl.

## 9. Experience Schema hierarchy (replaces Website Schema)
```
BaseExperienceSchema { id, channel, layout, components[], theme, locales, meta, version }
   ├─ WebsiteSchema      extends Base + { pages[], nav, seo, blog }
   ├─ CustomerAppSchema  extends Base + { screens[], tabs, deeplinks }
   ├─ DriverSchema       extends Base + { shiftScreens, mapLayers }
   ├─ MerchantSchema     extends Base + { dashboards, kds }
   ├─ AffiliateSchema    extends Base + { referral, payouts }
   ├─ PartnerSchema      extends Base + { onboarding, applications }
   └─ AdminSchema        extends Base + { workspaces, consoles }
```
**Inheritance:** children share the Base fields + validators and add channel-specific fields;
unknown fields from newer versions are preserved at runtime (the forward-compat rule already in
`website.service`). One validator composes Base + channel rules.

## 10. Rules Engine
Context predicates → decision (which experience/variant). Inputs: country, role, subscription,
season, language, device, experiment, feature flag, time, location, merchant type, campaign,
user segment. Generalizes `flags.FlagResolver` + `growth/experiments`. **Pure and deterministic**
(deterministic seeding like `aiStudio`'s stable hash — no `Math.random`). Decides *what to
render, when, for whom*; the Engine executes the decision.

## 11. Lifecycle
`Draft → Review → Approval → Testing → Staging → Publishing → Monitoring → Rollback → Archive`.
Transitions are gated by **permissions + schema validation + the Guardian Release Gate** (already
built). Monitoring feeds the Guardian issue lifecycle; Rollback reuses version history; Archive is
a terminal, restorable state. This mirrors the issue-lifecycle state machine already shipped in
`guardian/ops/issues.ts`.

## 12. AI Experience Builder readiness
To support "make a Ramadan splash", "move wallet above orders", "premium merchant dashboard":
1. **Metadata-driven components** (§8) — AI composes only from a known, validated catalog.
2. **Stable Experience Schema** (§9) — AI output is a schema instance, machine-validatable.
3. **Validation layer** — reject invalid AI output before it can be saved.
4. **Draft-only + approval** — AI edits land in Draft; human approves through the lifecycle (never auto-publish).
5. **AI port** (`AiPort`, mirroring the kernel `AiRegistry`) — pluggable model, no vendor lock.
6. **Intent→schema translation** — generalize `aiStudio` (already prompt→blocks) to prompt→experience-patch.
7. **Guardrails** — permissions, publishing constraints, deterministic seeds, Guardian gate.
Mapping: "Ramadan splash" = generate a splash variant + a season Rule; "move wallet above orders"
= reorder layout nodes in `CustomerAppSchema`; "premium merchant dashboard" = compose a
Merchant-channel experience from the catalog.

## 13. Multi-tenant isolation
Every artifact keyed by `tenant_id`: experiences, channels, themes, components (tenant overrides),
assets, publishing, analytics, experiments, rules, flags, configs. **RLS enforces** (73 tables /
~200 policies already). Config delivery is scoped per tenant + signed. White-label = tenant theme
tokens via `designSystem`. Generalize the existing `${country}:${screen}` key to
`${tenant}:${channel}:${experience}`. No tenant can read another's config (RLS + signed, scoped bundles).

## 14. Event architecture
Reuse `EventBus`. Typed events: `ExperiencePublished`, `ExperienceViewed`, `ComponentRendered`,
`ComponentClicked`, `NavigationChanged`, `FeatureActivated`, `ThemeChanged`, `CampaignStarted`,
`ExperimentStarted`, `RulesTriggered`. Subscribers: Analytics (telemetry), Personalization
(segment learning), Guardian (health/issues), Experiments (exposure logging). Everything the
Engine does emits an event — the platform is observable by construction.

## 15. Extensibility (new channels without Engine change)
The Engine is target-agnostic via `RenderPort`. A new channel — Kiosk, Desktop, Smart TV, Car
Display, Wearable, Voice (SSML), AR/VR (scene graph) — plugs in with: (1) a Channel descriptor,
(2) a `RenderPort` adapter for its output target, (3) a component-metadata subset marking
`supportedChannels`. No Engine, Schema-base, Rules, or Registry change. This is the ports-and-
adapters guarantee, proven by the Guardian kernel's zero-change module installation.

## 16. Updated Migration Strategy
Supersedes Phase 0's facade-only plan; still additive + reversible per phase.
1. **Engine skeleton** — pure library `experience-engine/` (ports + context resolution + registry), modeled on `guardian/kernel`, re-using flags/events/publishing/versioning. No behavior change.
2. **Website = Channel #1** — adapter over the existing runtime/renderer.
3. **Customer App = Channel #2** — wrap `experience.service` (already draft/publish/version).
4. **Studio shell** — `WebsiteCenter` generalizes to consume Engine services (behavior identical).
5. **Remote Config delivery** — signed, cached, offline-safe.
6. **Rules + Personalization + Experiments** unified behind the Rules Engine.
7. **AI builder** — prompt→experience-patch on the metadata catalog, draft-only.
8+. **New channels** — descriptor + RenderPort adapter each.
Every phase: independently deployable, tests green, backward-compatible, reversible by deleting the new directory.

## 17. Updated Risk Analysis
- **High — blast radius:** the Engine renders everything → keep each channel's existing runtime working until its Engine path is proven; ports/adapters isolate.
- **High — config as runtime dependency + attack surface:** mitigate with signing, offline cache, and fail-safe to last-known/baked-in baseline.
- **High — content-model convergence:** `website.service` + `experience.service` must converge under `BaseExperienceSchema` without breaking either (both stay live during migration).
- **Medium — non-determinism:** personalization/AB → deterministic seeding (existing `aiStudio` pattern).
- **Medium — two component registries:** unify behind the metadata catalog gradually; keep the string SSR path (public site) until parity proven.
- **Medium — AI safety:** never auto-publish; validation + approval + Guardian gate.
- **Performance:** Engine indirection + config fetch → benchmark (`bench:website`), cache aggressively.

## 18. Final Recommendation
Adopt the **Engine-centric DXP model**: build the Experience Engine as a pure ports-and-adapters
kernel (the Guardian kernel proves the pattern in this codebase), converge `website.service` and
`experience.service` under a `BaseExperienceSchema`, deliver configuration remotely with HMAC
signing + offline cache, and layer the Studio and AI builder on top. Start with the Engine skeleton
+ Website-as-Channel-#1 adapter (additive, reversible) before any behavior moves. This turns a
Website Studio into a Digital Experience Platform without a rewrite, because the platform's hardest
parts — a pure kernel, an experience content model, publishing/versioning/rollback, flags, events,
tenancy, and an AI seam — already exist and only need generalizing.
