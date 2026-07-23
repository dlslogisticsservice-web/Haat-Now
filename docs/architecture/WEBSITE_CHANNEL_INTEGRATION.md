# Website Channel Integration (Phase 1, Wave 2)

> The Experience Engine's FIRST integration. The engine now resolves Website experiences by
> **wrapping** the existing Website — website.service, renderer.ts, blocks.tsx and the Website
> schema are untouched. Website Studio, publishing, rollback, SEO, routes and the public site
> all behave exactly as before (parity 5/5, journeys 52/52).

## Architecture
A new integration layer `src/experience-channels/website/` sits BETWEEN the pure engine and
the live Website. It may import the engine (contracts) and website.service; the engine imports
neither — purity preserved (Guardian: 0 edges from `experience-engine`).

```
src/experience-channels/website/
  types.ts          WebsiteContentSource — the injectable boundary (type-only website.service)
  mapper.ts         PURE WebsiteSite → WebsiteSchema projection (no copied logic)
  resolvers.ts      Context / Version / Rule / Experience resolvers (depend on the boundary only)
  channel.ts        WebsiteChannel descriptor + registerWebsiteChannel() (registry population)
  contentSource.ts  The ONE file that imports website.service at runtime (browser glue)
  index.ts          Barrel
  __tests__/website-channel.test.ts   end-to-end + unit (fake source, fully isolated)
```

## Adapters (wrap, never rewrite)
- **Content**: `WebsiteContentSource` names exactly what the channel needs (published/draft
  site, version, site ids). `createWebsiteContentSource()` delegates to `websiteService`
  (`getPublishedSite`/`getDraftSite`/`healthReport().latest`/`listSites`). No new logic.
- **Renderers**: registered by target — `website:html-string` (the existing SnapshotRenderer)
  and `website:react-dom` (the existing blocks.tsx runtime). Declared, not reimplemented;
  execution stays where it is today (Wave 3+ binds a RenderingPort).
- **Schema**: `mapSiteToSchema` re-shapes the existing content model into the engine's
  channel-neutral `WebsiteSchema` — a data projection (block → component node, page → layout),
  proven non-mutating.

## Resolution flow (end-to-end, verified in tests)
```
ExperienceRequest
   → ContextResolver     build ExperienceContext (tenant, country, locale→direction, device, role, env, flags, channel)
   → RuleResolver        select experience by locale/country/theme/feature-flags (no personalization yet)
   → VersionResolver     wrap website.service version (healthReport().latest)
   → Website Adapter     fetch content (published, or draft for preview) via the content source
   → WebsiteSchema       pure projection of WebsiteSite
   → ExperienceResponse  { status:'resolved', channel:'website', version, schema, appliedRules, diagnostics }
```
Missing content/version returns an honest `not-found`/`no-version` — never a fabricated schema.

## Dependency graph
- `experience-engine` → (nothing outside itself) — pure.
- `experience-channels/website` → `experience-engine` (type-only) + `services/website.service`
  (value, only in `contentSource.ts`).
- Nothing depends on `experience-channels` yet — the engine is capable but **not connected to
  production flows** (that is Wave 5). Guardian: 0 cycles, 0 layer violations, 0 dead files.

## Compatibility
| Concern | Status |
|---|---|
| Website Studio (WebsiteCenter) | unchanged (no file touched) |
| website.service / renderer.ts / blocks.tsx | unchanged this wave |
| Publishing / Rollback / SEO | unchanged (wrapped read-only) |
| Runtime / Routes / Public website | unchanged (parity 5/5, journeys 52/52) |
| Existing tests / Guardian / build | green (384 tests, 0 regressions) |

Only additive change to existing code: `scripts/test-website.cjs` (+1 line registering the
channel test directory).

## Future Customer Channel migration (Wave 3)
The same shape applies: define a `CustomerContentSource` boundary over the existing
`experience.service` (which already does draft/publish/version/history for splash/login/
onboarding), a pure `mapScreenToSchema` (ScreenExperience → CustomerSchema), the four
resolvers, and `registerCustomerChannel(engine, source)`. No rewrite of `experience.service`.
The engine gains Channel #2 exactly as it gained Channel #1 — additively and reversibly.
