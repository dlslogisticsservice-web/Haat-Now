# Rendering Pipeline (Phase 1, Wave 3)

> The Experience Engine can now EXECUTE rendering. A resolved experience flows through the
> pipeline to real output. The existing Website renderer (renderer.ts) is WRAPPED as a
> RenderingPort — never rewritten. Website Studio, runtime, SEO, publishing and rollback are
> unchanged (parity 5/5, journeys 52/52).

## Pipeline diagram
```
ExperienceRequest
   → ExperienceResolver        (Wave 2) → ExperienceResolution { schema }
   → RendererResolver          select best RendererMetadata (channel + target + version + priority)
   → RenderingPort             execute the port registered for the target
   → RenderingResult           { status, renderer, target, version, executionMs, output, warnings, diagnostics }
   → ExperienceResponse        { resolution, renderingResult }
```

## Execution flow (never throws)
`RenderingPipeline.render(resolution, context, opts)`:
1. Resolution not `resolved` → **skipped**.
2. `resolveRenderer` selects a renderer (exact target+version → target-only → channel fallback), highest `priority` wins.
3. No renderer → **renderer-missing**.
4. `requireVersion` mismatch → **version-conflict**.
5. No RenderingPort for the renderer's target → **unsupported-target**.
6. Execute the port inside try/catch, timed by an injected clock:
   - success → **rendered** (`output` set)
   - throw → **renderer-failed** (graceful; `output: null`, diagnostic captured)

Every path returns a `RenderingResult`; the pipeline is total.

## Renderer selection
- `RendererRegistry` (completed this wave) supports `byChannel`, `byTarget`, and
  `matching({channel,target,version,capability})` sorted by `priority` (desc).
- `resolveRenderer(registry, {channel, target, version})` returns `{ renderer, fallback, diagnostics }`.
- Website registers two renderers: `website:html-string` (priority 10, the executable SSR
  target) and `website:react-dom` (priority 5, the existing browser runtime — declared, bound
  by the host later). With no explicit target the pipeline picks `html-string`.

## Adapter architecture (wrap, never rewrite)
`createWebsiteHtmlRenderingPort()` implements `RenderingPort<string>` for target `html-string`:
- reconstructs `{ type, props }` blocks from the schema's component nodes (the mapper preserved
  the original blocks in `props`),
- feeds them to the **existing** `SnapshotRenderer.renderPageBody`, which dispatches through the
  same `BLOCK_RENDERERS` the public site uses.
No block renderer is reimplemented; XSS-escaping comes from renderer.ts unchanged (tested).

## Multi-target readiness (STEP 8)
`RenderTarget = 'html-string' | 'react-dom' | 'react-native' | 'flutter' | 'json' | 'voice' | 'email' | 'pdf' | …`.
Only `html-string` is executable today. A new target ships as: a `RendererMetadata` entry + a
`RenderingPort` adapter registered into the pipeline — **no engine change** (ports-and-adapters).

## Performance (measured, tsx/node, 20k ops)
| Operation | Cost |
|---|---|
| `registry.byChannel` | ~0.31 µs |
| `resolveRenderer` (selection) | ~0.46 µs |
| `pipeline.render` (12-block page) | ~5.05 µs |
| `resolveAndRender` (full) | ~7.45 µs |

Lookups are O(renderers) over a tiny list; rendering is O(blocks). **Caching opportunities**
(future): memoize `resolveRenderer` per (channel,target,version); cache rendered output per
(experienceId, version, locale) — the version model already gives a natural cache key.

## Compatibility
Website Studio · Runtime · renderer.ts · blocks.tsx · SEO · Publishing · Rollback — all
unchanged this wave (no file touched; parity 5/5, journeys 52/52). Only the engine + channel
adapter layers changed, additively.

## Future multi-platform rendering (Wave 4+)
Bind the `react-dom` RenderingPort to the existing blocks.tsx runtime (browser host), then add
`react-native` / `voice` / `pdf` ports for new channels — each a self-contained adapter behind
the same `RenderingPort` contract. The pipeline, resolver and registry never change.
