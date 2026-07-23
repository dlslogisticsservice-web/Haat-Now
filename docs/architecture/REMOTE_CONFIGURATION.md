# Remote Configuration (Phase 1, Wave 8)

> The first functional capability built on the DXP kernel. It **composes** the existing pieces —
> the Provider Registry (a `ConfigurationProvider`), the Delivery `ConfigurationCache`, and the
> Policy Engine — into one coordinator that the Runtime's `configuration` stage drives. **No new
> infrastructure layer** is introduced. Additive and pure; nothing else changes (tests 455/455,
> journeys 52/52, parity 5/5, Guardian 0/0/0). Only **configuration** policies participate — no
> Feature Flags, no Personalization, no new channels.

## Architecture
```
Runtime · configuration stage
        ↓  RemoteConfiguration.resolve(context)
  Configuration Policy eval  ── Policy Engine (types: ['configuration'])
        ↓
  Cache lookup (TTL + version) ── Delivery ConfigurationCache
        ↓ (miss)
  Configuration Provider     ── Provider Registry.resolve('configuration', ctx)
        ↓
  Signature verify (verify-before-trust)
        ↓
  Cache store
        ↓
  Effective Configuration    = bundle.config ⊕ policy directives  → execution.configuration
```
`configuration.ts` depends only on context/types/providers/policy/delivery (one-directional —
nothing it uses imports it back), so Guardian's runtime-cycle count stays **0**. It reuses the
generic `Cache<V>` / `InMemoryCache` and the registries already in the kernel; it adds no layer.

## Flow (RemoteConfiguration.resolve)
1. **Policy** — evaluate `configuration`-typed policies for the context. A `deny` effect blocks
   configuration outright (`rejected`, `configuration.rejected`). Otherwise the decision's
   directives are carried to step 5.
2. **Cache lookup** — `ConfigurationCacheController.lookup(key, now, version?)` returns the bundle
   only when it is **fresh** (within TTL) and **version-valid** (non-empty; matches a pin if given).
   A hit skips the provider (`source: 'cache'`, `fromCache: true`).
3. **Provider** (on miss) — `providers.resolve('configuration', ctx)` selects the highest-priority
   healthy `ConfigurationProvider`; `provider.load(ctx)` returns a `ConfigurationResult`. No
   provider → empty effective config (`source: 'none'`), never an error.
4. **Signature + store** — verify (below), build a `ConfigurationBundle` (with metadata + checksum),
   `store` it in the cache with its verified signature status (`configuration.cached`).
5. **Effective configuration** — `{ ...bundle.config, ...policyDirectives }` (policy wins), returned
   with full diagnostics (`configuration.loaded`).

## Configuration Provider (STEP 1)
`createStaticConfigurationProvider(bundles, opts)` implements the **existing** `ConfigurationProvider`
contract verbatim — `load(ctx)` returns a `ConfigurationResult { config, version, fromCache,
signature? }`; `supports(ctx)` matches tenant·channel·environment; `health()` reports the four
states; an optional `verifySignature` is honoured. Version, signature, metadata and health are all
supported. A real deployment swaps this for a network-backed provider behind the same contract.

## Cache integration (STEP 3)
The coordinator drives the **existing** Delivery `ConfigurationCache` (`Cache<unknown>`) through a
`ConfigurationCacheController` that adds:
- **Lookup / Store** — keyed deterministically by `tenant|channel|environment`.
- **TTL** — an entry is stale once `now − storedAt > ttlMs` (default 60 s; injectable clock).
- **Version validation** — a cached bundle whose version is empty, or does not match a requested
  pin, is treated as a miss.
- **Invalidation** — `invalidate(scope?)` removes one key or every key within a
  tenant/channel/environment scope (a private key index makes scoped invalidation possible over the
  key-less `Cache<V>`), emitting `configuration.invalidated`.

## Policy integration (STEP 5)
Configuration is evaluated **through the existing Policy Engine**, restricted to
`types: ['configuration']`. Directives from the effective decision override matching bundle keys
(policy wins, conflicts recorded by the engine); a `deny` effect rejects the configuration. No
other policy type participates — Feature Flags and Personalization are untouched.

## Runtime integration (STEP 4)
Only the `configuration` stage changed. It calls `deps.configuration.resolve(context, {preview,
experienceId})`, stores the `EffectiveConfiguration` on `execution.configuration`, and records a
one-line diagnostic. The engine wires the coordinator over the **same** provider registry, policy
engine, and delivery configuration cache it already owns. With no configuration provider registered
the stage loads an empty effective config (`source: 'none'`) — a graceful default, not a placeholder.
**No other runtime stage was modified.** (A legacy `ConfigurationResolver` fallback + a placeholder
note remain for runtimes constructed without the coordinator.)

## Diagnostics (STEP 6)
`EffectiveConfiguration` exposes **source** (`cache | provider | none`), **fromCache**, **version**,
**providerId**, **signatureStatus**, **rejected/reason**, a **policySummary** (matched, ignored,
effect, conflicts, directive count), **metadata** (version, generatedAt, checksum, size), and a
**diagnostics** trail. The stage summarises them, e.g.
`configuration v1.0.0 source=provider cache=miss provider=cfg.website sig=unsigned policies=1`.

## Events (STEP 7)
`configuration.loaded`, `configuration.cached`, `configuration.invalidated`, `configuration.rejected`
— to an optional sink (`onConfigurationEvent` on the execution, or the coordinator's `onEvent`).

## Security
- **No secrets in the client.** Signature verification is **injected** — supplied by the
  `ConfigurationProvider.verifySignature` or a coordinator `verifier` (server-derived in a real
  deployment). This module never holds a signing key.
- **Verify before trust.** A signed bundle whose signature **fails** verification is **rejected**
  (`configuration.rejected`, `signatureStatus: 'invalid'`) and never cached. A signed bundle that
  **cannot** be verified (no verifier available) is accepted but flagged `unverified` — it is
  **never** fabricated as `valid`. Unsigned bundles are `unsigned`.
- **Graceful, never fail-open into a wrong state.** Provider errors and policy denials reject with a
  reason and an empty effective config, not a partial/guessed one.
- The stored signature status travels with the cache entry, so a cache hit reports the status the
  bundle was *actually* verified with, not a re-guess.

## Provider integration
Selection is the Wave-6 machinery unchanged: priority, capability/scope match, and health decide
which `ConfigurationProvider` serves a context. Registering a second provider (e.g. a remote one at
higher priority) transparently takes over; an offline provider is skipped in favour of a healthy
lower-priority one.

## Performance (measured, tsx/node, 50k warmed ops)
| Path | Cost |
|---|---|
| `policyEngine.evaluate` (configuration type, 2 policies) | ~8 µs |
| `resolve` — cache **miss** (policy + provider + store) | ~21 µs |
| `resolve` — cache **hit** (policy + cache lookup) | ~25 µs |

Configuration **policy evaluation (~8 µs) dominates** and runs on *every* resolve — policy is
re-evaluated per context by design, so a cache hit does not skip it. The cache lookup itself is
sub-microsecond; it removes the provider round-trip, but with a trivial in-memory provider the hit
and miss totals sit within run-to-run noise (the hit's cost is the same policy pass). The cache's
real payoff scales with provider cost — a network-backed provider is where the hit wins. Against the
~20 µs runtime orchestration the whole stage is negligible.

## What this wave deliberately did NOT do
- **No Feature Flags, no Personalization** — only configuration policies participate.
- **No Customer / Driver channel.**
- **No runtime redesign** — one stage's body changed; stage order and all other stages are intact.
- **No new infrastructure** — the cache, registries, and policy engine are the existing kernel; the
  static provider and coordinator are capability code, not a new layer.
- **No client-side signing / secret material.**

## Recommended next steps
A network-backed `ConfigurationProvider` (behind the same contract) with a server-derived
`verifySignature`; wiring `configuration.invalidated` to the Wave-5 cache-invalidation triggers on
publish/rollback; and — as a separate, explicitly-scoped wave — Feature Flags and Personalization as
their own policy types reusing this exact pipeline.
