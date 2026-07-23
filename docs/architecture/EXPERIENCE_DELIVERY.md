# Experience Delivery Layer (Phase 1, Wave 5)

> The single cache-aware gateway between the Runtime and every Experience source. It inserts a
> cache / version / snapshot layer in front of resolution so a resolved experience is served
> from cache on repeat requests instead of re-resolving the source each time. Additive and
> pure; the Website, Studio, renderer, pipeline, runtime and resolvers are unchanged
> (tests 417/417, journeys 52/52, parity 5/5, Guardian 0/0/0). **Remote Configuration is NOT
> implemented** — its cache is a declared placeholder only.

## Where it sits
```
engine.execute(request)
   → ExperienceRuntime  (8 stages)
        └─ resolution stage
              → ExperienceDelivery.deliver          ← the gateway (Wave 5)
                   → Lookup Cache → Validate → Resolve Source → Update Cache → DeliveryResult
                        └─ DeliverySource.resolve  = engine.resolve  (the resolvers, Wave 2)
                             → website channel adapter → WebsiteContentSource → website.service
```
The Delivery Layer is decoupled from the concrete source via `DeliverySource` — it knows nothing
about `website.service`. The engine wraps its own `resolve` as the source, so delivery slots a
cache in front of the existing resolution path without redesigning it.

> **Wave 6 update.** Delivery no longer calls a single concrete source directly — its *Resolve
> Source* step now goes through the **Provider Registry** via a structural
> `ExperienceProviderGateway`, selecting the experience source by priority/capability/health.
> The direct `source` remains the graceful fallback. See `PROVIDER_ARCHITECTURE.md`. The cache,
> snapshot, key, and event logic below are unchanged.

## The delivery pipeline (STEP 4)
`deliver(ctx: DeliveryContext): Promise<DeliveryResult>` — **never throws**:
1. **Lookup Cache** — hit → serve the cached resolution verbatim (`cache.hit`; `snapshot.loaded`
   if a snapshot is stored). The source is **not** consulted.
2. **Validate** — a malformed context returns an `error` result (no source call).
3. **Resolve Source** — call `DeliverySource.resolve`. A throw is caught → graceful `error`.
4. **Update Cache** — only a `resolved` result with a schema is cached: schema + version +
   snapshot are stored (`cache.updated`, `snapshot.stored`). `not-found`/`error` are **not**
   cached (they must be re-attempted next time).
5. **Return** `DeliveryResult { status, resolution, metadata, diagnostics }`.

## Deterministic cache keys (STEP 3)
`deliveryCacheKey(ctx)` = `tenant | channel | experience | locale | environment | version | preview`.
Same identity → same key; locale, version, environment and preview each change the key. This
keeps a preview render, an Arabic render and a `v4` render in separate cache slots.

## Cache contracts (STEP 2)
`Cache<V>` (`get`/`set`/`has`/`delete`/`clear`) with one generic pure impl, `InMemoryCache<V>`
(a typed `Map` — infrastructure, not business logic, mirroring `InMemoryRegistry`). Named caches:

| Cache | Holds | Status this wave |
|---|---|---|
| `SchemaCache` | resolved `ExperienceSchema` | **active** |
| `VersionCache` | resolved `SemVer` | **active** |
| `SnapshotCache` | `ExperienceSnapshot` | **active** |
| `ManifestCache` | `SnapshotManifest` | contract only |
| `ComponentCache` | `ComponentMetadata` | contract only |
| `AssetCache` | `AssetMetadata` | contract only |
| `ConfigurationCache` | — | **placeholder** (Remote Config not implemented) |

The layer also keeps an internal resolution store so a cache hit returns the source's original
resolution (diagnostics preserved), not a reconstruction.

## Snapshot model (STEP 6)
`ExperienceSnapshot { id, experienceId, channel, version, schema, metadata, signature? }` with
`SnapshotMetadata`, `SnapshotVersion`, `SnapshotManifest`, and a detached `SnapshotSignature`
(`HMAC-SHA256` shape, mirroring the marketplace signature — verified before trust once remote
delivery exists). `buildSnapshot(resolution, generatedAt)` is pure. No signing is performed
client-side; the signature field is a forward-looking contract only.

## Cache invalidation (STEP 5) — contracts only
`CacheInvalidator.keysFor(trigger, scope)` with triggers `publish | rollback | version-change |
theme-change | asset-change | rule-change` and an `InvalidationScope { tenantId?, channel?,
experienceId? }`. A pure `keyInScope(key, scope)` helper matches a key against a scope. **No
invalidation is executed** — this is the contract a future publishing/rollback bridge implements.

## Delivery events (STEP 7)
`cache.hit`, `cache.miss`, `cache.updated`, `snapshot.loaded`, `snapshot.stored`,
`manifest.loaded` — delivered to an optional `onEvent` sink. No external telemetry is wired.

## Runtime integration (STEP 8)
`RuntimeEngineDeps.delivery` is **optional and additive**. When present, the resolution stage
delivers through the layer (cache-first, then source) and records
`resolution via delivery (cache|source): <status>`; when absent it falls back to `resolve`
directly (Wave 4 behaviour, unchanged). The engine always constructs a delivery whose source is
its own `resolve`, and exposes it as `engine.delivery`. `resolveAndRender` and `resolve` stay
direct (uncached) — delivery is the gateway for the **orchestrated** (`execute`) path only, per
"the single gateway between the Runtime and the sources."

## Backward compatibility
Inserting delivery is behaviour-preserving: the first `execute` is a cache miss that resolves
via the same source and returns the same resolution; the second is a hit serving the identical
(diagnostics-preserved) resolution. A bare engine (no resolver) still delivers `not-found`
gracefully. Verified: runtime preview/draft echo, graceful-failure, and bare-engine tests all
still pass.

## Performance (measured, tsx/node, 20k ops, warmed)
| Path | Cost |
|---|---|
| `deliver` — cache **hit** (key + lookup, serve cached resolution) | ~1.6 µs |
| `deliver` — cache **miss** (resolve source + cache write + snapshot) | ~2.8 µs |
| `execute` — full 8 stages, delivery **hit** | ~28 µs |
| `execute` — full 8 stages, delivery **miss** | ~22 µs |

At the delivery layer itself a hit is ~1.8× cheaper than a miss and removes the source
round-trip. At the full-`execute` level the hit is **not** measurably faster than the miss here:
the 8-stage orchestration dominates (~20 µs) and the benchmark's source is a trivial in-memory
function, so the ~1 µs the cache saves is well inside run-to-run variance. The cache's payoff is
proportional to source cost — it matters when resolution is expensive (real content assembly,
future IO), which this micro-benchmark deliberately does not model. Absolute cost stays negligible
per request either way.

## What this wave deliberately did NOT do
- **No Remote Configuration** — the configuration stage + `ConfigurationCache` remain placeholders.
- **No Customer / Driver / Merchant channel** — the Website is still the only wired source.
- **No Website Runtime / Studio / renderer changes** — delivery wraps `resolve`, nothing else.
- **No cache invalidation execution, no persistence, no eviction** — caches are in-memory and
  request-lifetime; invalidation is a contract. A future wave bridges publish/rollback events to
  `CacheInvalidator` and swaps `InMemoryCache` for a persistent/edge cache behind the same `Cache<V>`.

## Next seam
Remote Configuration (a signed, versioned, cache-aware config bundle via `ConfigurationPort`)
populates the `ConfigurationCache` and the runtime's configuration stage — the delivery pipeline
already has the cache slot and the signature shape waiting for it.
