# Live Runtime Integration (Phase 1.5, Wave 16)

> The Experience Engine is now **in the live public website's render path**. It runs on real traffic
> for one canary experience and decides which authored sections render. No new framework, no second
> renderer: the live runtime keeps its single `SectionShell + BlockRenderer` path and the Engine
> only decides. Verified against the real browser (journeys 52/52, Studio↔Public parity 5/5, live
> homepage probe: 127 sections, 0 console errors) with 564/564 unit tests and Guardian 0/0/0.

## What the live path actually is
An important correction carried into this wave: the deployed website renders through
**`PublicSiteApp` → `BlockRenderer`** over `WebsiteBlock[]`. It does **not** use `SnapshotRenderer`
(`SiteApp.tsx` is an unmounted shell). The integration therefore targets the real loop:

```
resolveSite → resolved.page.sections → hydrateSections(live catalog)
   → decideLiveSections(...)            ← the Engine decides here (Wave 16)
   → .filter(s => s.enabled !== false)  ← the CMS's own per-section switch, unchanged
   → SectionShell + BlockRenderer       ← the SINGLE render path, untouched
```
The Engine sits beside the CMS's existing `enabled` switch: authored content in, decided content
out. One render path, one id scheme, no duplication.

## STEP 1 · Stable block ids
Positional `blk_0 / blk_1 / blk_2` are gone. `assignBlockIds()` derives an id from the block's
**authored identity** — `type` plus `heading/title/subtitle/body` — hashed, with an occurrence
suffix (`~2`) only for genuinely indistinguishable duplicates.

Two properties make it safe for targeting:
- **Insertion-stable.** Adding or removing an unrelated section never changes another block's id, so
  a plan cannot silently retarget the wrong section.
- **Hydration-stable.** Volatile fields are deliberately excluded from the fingerprint — above all
  `items`, which `hydrateSections` replaces with live catalog data. Including them would have made a
  block's id change the moment live data arrived, breaking targeting intermittently.

The engine mapper and the live runtime both call the same helper, so there is exactly one id scheme
(asserted by a test comparing mapper output to live ids).

## STEP 2 · Runtime integration
`decideLiveSections(sections, { tenantId, path, locale, preview })` runs the existing decision chain
**synchronously**:
```
audiences → flags → enforcement → render instructions → render plan → project onto sections
```
Synchronous by design: no effect, no state, no second paint, no content flash. The async Policy
stage is intentionally not on this path — flags → enforcement is the complete chain for block-level
decisions, and Policy remains available via the full `engine.execute()`.

Projection rules: a `hidden` node drops that section; an `override` rewrites a field the block
**already has** (never invents one on authored content). Everything else passes through.

### Safety properties (this runs on real traffic)
- **Gate first.** Non-canary requests return the input array **by reference** — React sees literally
  the value it would have without this wave. Measured at **0.065 µs**.
- **Never throws.** Any failure inside the chain returns the original sections, reports to
  monitoring, and counts toward the circuit breaker. A broken plan cannot blank a page.
- **Double-guarded.** `decideLiveSections` also wraps runtime construction itself in try/catch.
- **No import-time coupling.** The channel does **not** import `monitoring.service` (it reads
  `import.meta.env` at load and would break every non-Vite consumer). The host injects the sink via
  `setLiveRuntimeReporter` — an issue caught by the tests during this wave.

## STEP 3 + 4 · Feature gate and canary
```ts
export const WEBSITE_CANARY: RolloutConfig = {
  enabled: true,            // scoped — NOT a global rollout
  experiences: ['/'],       // exactly ONE website experience
  tripAfterFailures: 3,
};
```
`enabled: true` is not "on for everyone": any request matching no criterion resolves to
`no-criteria` → OFF. With a single-entry allowlist the Engine executes for the homepage only;
`/pricing`, `/contact` and every other page take the by-reference path.

**With no feature flags registered — the shipped state — the canary experience also renders
identically.** The Engine runs, evaluates, decides "no change", and the page is byte-for-byte what
it was. Registering a flag named for a stable block id is the single step that makes it visibly
load-bearing. That is the safest possible live enablement: the machinery is genuinely on the
critical path and proven, while the rendered output is unchanged until an operator opts in.

## STEP 5 · Metrics export
Applied plans are exported through the **existing** monitoring seam as
`monitoring.track('experience.plan_applied', { tenantId, path, reason, hidden, nodesModified,
planSize, ms })`, and failures via `monitoring.captureError`. No-change decisions are deliberately
**not** reported — the signal would be pure noise on every render. Aggregates remain available at
`runtime.metrics.snapshot()` (executions, failures, latency, plan size, nodes modified, operations).

## STEP 6 · Rollback
Three layers, all covered by tests against the real path:
1. `websiteLiveRuntime().rollout.disable('<incident>')` — the next render returns the authored
   sections by reference. Instant, no deploy.
2. Failure fallback — a throwing chain renders authored content and reports the error.
3. Circuit breaker — three consecutive failures trip the gate; subsequent renders short-circuit at
   `tripped` and require an explicit `reset()`.

## STEP 7 · Parity
| Surface | Result |
|---|---|
| Studio↔Public parity | 5/5 |
| Product journeys (live browser) | 52/52 |
| Live homepage probe (canary experience) | 127 sections, 5.6 KB text, **0 console errors** |
| Unit suites | 564/564 |
| Guardian | 0 cycles · 0 violations · 0 regressions |

## Performance (measured, 100k warmed ops, 14-section homepage)
| Path | Cost |
|---|---|
| `decide` — non-canary page (gate denies) | **0.065 µs** |
| `decide` — canary, no flags registered (shipped state) | ~7.2 µs |
| `decide` — canary, 1 flag hiding 1 of 14 | ~22.1 µs |
| `assignBlockIds` (14 sections) | ~12.1 µs |

Per React render. The non-canary path is effectively free; the shipped canary state costs ~7 µs;
an actively-applied plan ~22 µs, of which id assignment is the majority — the obvious optimisation
if the canary widens (memoise ids per section array).

## What this wave deliberately did NOT do
- **No new framework or architectural layer** — only wiring existing pieces into the live path.
- **No Personalization, no Experiments, no AI decisions.**
- **No second render path** — `BlockRenderer` remains the only website renderer.
- **No global rollout** — one experience, everything else by-reference.
- **No change to authored content, publishing, or the Studio.**

## Operating notes
- **Enable a change:** register a flag whose id is the target block's stable id
  (`stableBlockId(block)`), defaulted off, on `websiteLiveRuntime().engine.flags`.
- **Verify:** `runtime.metrics.snapshot().nodesModified > 0` and an `experience.plan_applied` event.
- **Abort:** `websiteLiveRuntime().rollout.disable(reason)`.
- **Widen:** add a path to `WEBSITE_CANARY.experiences`, or switch to `percentage` for a ramp.
