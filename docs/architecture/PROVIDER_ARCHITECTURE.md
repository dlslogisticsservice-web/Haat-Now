# Provider Architecture (Phase 1, Wave 6)

> Providers make the Delivery Layer pluggable. Instead of talking to one concrete source, the
> Delivery Layer now orchestrates the experience source **through a Provider Registry** that
> registers providers, matches them by capability, selects by priority, and reports health.
> Additive and pure; the Website, Studio, renderer, pipeline, runtime, and the Delivery
> pipeline are unchanged (tests 428/428, journeys 52/52, parity 5/5, Guardian 0/0/0).
> **Remote Configuration is NOT implemented** — the Configuration Provider is a contract only.

## Architecture
```
Runtime
  ↓
Delivery Layer                         (deliver: Lookup → Validate → Resolve → Update → Return)
  ↓  ExperienceProviderGateway         (structural seam — Delivery never imports the registry)
Provider Registry                      (register · match · prioritise · health)
  ↓
Experience Provider   ← IMPLEMENTED (wraps the existing DeliverySource; behaviour unchanged)
Configuration Provider ← contract only (Remote Config NOT implemented)
Snapshot Provider      ← contract only
Manifest Provider      ← contract only
Theme Provider         ← contract only
Asset Provider         ← contract only
Future Providers…
```
The dependency is **one-directional**: `providers.ts` imports the delivery/context/type
contracts; `delivery.ts` imports **nothing** from `providers.ts`. Delivery holds a structural
`ExperienceProviderGateway` (defined in `delivery.ts`), and `providers.ts` adapts the registry
into it. This is what keeps Guardian's runtime-cycle count at **0**.

## Provider contracts (STEP 1)
A `Provider` is identity + capability match + health:
```ts
interface Provider {
  readonly metadata: ProviderMetadata;   // id, name, kind, version, priority?, capabilities?
  supports(ctx: ProviderContext): boolean;
  health(): ProviderHealth;              // { status, since?, detail? }
}
```
- **ProviderKind** — `experience | configuration | snapshot | manifest | theme | asset | (string & {})`.
- **ProviderPriority** — a number; higher wins among providers of the same kind.
- **ProviderCapabilities** — `{ channels?, environments?, preview?, tags? }`, matched against a
  **ProviderContext** `{ tenantId, channel, environment, locale?, preview?, now?, capability? }`.
- **ProviderHealth** — status is one of the four states below.

Each kind extends `Provider` with its own operation: `ExperienceProvider.resolve`,
`ConfigurationProvider.load`, `SnapshotProvider.getSnapshot`, `ManifestProvider.getManifest`,
`ThemeProvider.getTheme`, `AssetProvider.resolveAsset`. **Only ExperienceProvider is implemented
this wave** (STEP 3); the rest are contracts (STEPs 4–8).

## Provider lifecycle
1. **Register** — `registry.register(provider)` keys it by `metadata.id`.
2. **Match** — for a request, `registry.matching(kind, ctx)` keeps providers of that kind that
   are *usable* (health healthy/degraded) **and** `supports(ctx)` (capability match), sorted by
   priority desc, healthy before degraded at equal priority.
3. **Select** — `registry.resolve(kind, ctx)` returns the single best match, or `null`.
4. **Serve** — the caller invokes the kind-specific operation on the selected provider.
5. **Health** — `registry.health()` snapshots every provider's status by id (for the monitor).
6. **Unregister** — `registry.unregister(id)` removes it; selection reflects the change immediately.

## Registry (STEP 2)
`ProviderRegistry` = `register · unregister · get · has · all · byKind · matching · resolve ·
health · ids · size · clear`. The `InMemoryProviderRegistry` impl is pure infrastructure — a
`Map<id, Provider>` with the match/priority/health logic above and **no business logic**.
`createProviderRegistry()` returns a fresh one.

## Selection flow (Delivery integration · STEP 9)
On a cache **miss**, the Delivery pipeline's *Resolve Source* step now:
```
selected = gateway.resolveExperienceProvider(deliveryCtx)   // registry.resolve('experience', …)
source   = selected ?? this.source                          // graceful fallback to direct source
resolution = await source.resolve(deliveryCtx)
metadata.providerId = selected?.id                          // recorded for observability
```
- The engine registers the `deliverySource` as `experience.website` and passes the gateway to
  Delivery, so the experience source is resolved **through the registry**.
- **The direct source remains the fallback**: if no provider supports the context (e.g. all
  offline), Delivery uses `this.source` — behaviour is identical to Wave 5. When Delivery is
  constructed with no gateway at all, it calls the direct source exactly as before.
- The cache **hit** path does not consult a provider (`providerId` absent) — the cached
  resolution is served directly, so provider selection cost is paid once per key, not per read.

## Health (STEP 10)
Every provider reports one of four states via `health()`:

| Status | Meaning | Selection |
|---|---|---|
| `healthy` | fully operational | eligible; preferred |
| `degraded` | operational, reduced (slow / partial) | eligible; used only if no healthy peer of higher/equal priority |
| `offline` | temporarily unavailable | **skipped** |
| `unsupported` | cannot serve this context/kind | **skipped** |

`offline`/`unsupported` are filtered out before priority sorting, so a healthy lower-priority
provider correctly wins over an offline higher-priority one — the basis of graceful degradation.

## Compatibility
Inserting the provider layer is behaviour-preserving. The engine registers exactly one always-
healthy experience provider wrapping the same `deliverySource`, so every request selects it and
resolves identically to Wave 5; the fallback guarantees a result even if selection returns null.
Verified: the Delivery Wave-5 tests (constructed with no gateway) are untouched and still pass,
runtime miss-then-hit still holds, journeys 52/52, parity 5/5.

## Performance (measured, tsx/node, 50k ops, warmed)
| Path | Cost |
|---|---|
| `registry.resolve` (6 providers, priority + capability + health) | ~0.9 µs |
| `gateway.resolveExperienceProvider` (context map + resolve) | ~1.7 µs |

Provider selection adds ~1.7 µs to a cache **miss** and **nothing** to a cache hit. Negligible
against the ~20 µs orchestration and paid once per cache key.

## What this wave deliberately did NOT do
- **No Remote Configuration** — `ConfigurationProvider` is a contract; nothing loads config.
- **No Customer / Driver / Merchant provider or channel** — only the website experience provider
  is registered.
- **No Website Runtime / Studio / renderer / Delivery-pipeline changes** — the provider layer is
  inserted at the *Resolve Source* seam only; the cache, snapshot, key and event logic are as in Wave 5.
- **No non-experience provider implementations, no persistence, no remote transport.**

## Future Remote Configuration integration
Remote Configuration arrives as a **ConfigurationProvider** implementation registered under the
`configuration` kind. The runtime's configuration stage (today a placeholder) will call
`registry.resolve('configuration', ctx)?.load(ctx)`, populating `ExecutionContext.configuration`
before resolution — with priority/capability/health selection and the Delivery `ConfigurationCache`
+ snapshot signature shape already in place. Snapshot/Manifest/Theme/Asset providers follow the
same pattern behind their existing contracts, with no change to the Registry or the Delivery pipeline.
