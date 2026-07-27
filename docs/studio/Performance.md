# HAAT NOW Website Studio — Performance

Benchmarks from `scripts/stress-9e.ts` (pure-engine load test, Node/tsx, single core).
Run: `npx tsx scripts/stress-9e.ts`.

## Enterprise-scale benchmark (before → after 9E hardening)

| Operation | Before 9E | After 9E | Gain |
|---|---:|---:|---:|
| 1,000 expression evaluations | 4,784 ms | **41 ms** | **115×** |
| Undo (large state) | 310 ms | **5 ms** | **57×** |
| Redo (large state) | 348 ms | **9 ms** | **39×** |
| Import 10,000 rows (validated) | 201 ms | **35 ms** | 5.7× |
| Seed 100,000 records | 167 ms | **288 ms** | 1.7ms/1k |
| 20 filtered+sorted queries / 100k | 1,299 ms | **1,355 ms** | ~68ms each |
| Aggregate sum over 100k | 33 ms | **33 ms** | — |
| Health + analyzer (full model) | 252 ms | ~250 ms | — |
| **Peak heap (100k rows + undo stack)** | **479 MB** | **158 MB** | **3.0×** |

## What changed (Part 1–4)
1. **Records out of the undo snapshot** (`recordStore` separate from `state`). Design-time ops and
   undo/redo no longer serialize data rows → undo/import/memory all improve dramatically.
2. **Lazy `db` scope** — `scope()` exposes `db.<entity>` via getters; rows are materialised only
   when an expression actually reads them. Bindings/conditions/computed-vars that use `var.*` /
   `state.*` (the majority) evaluate in ~0.04ms regardless of dataset size.
3. **`validationErrorCount` O(total rows)** — builds the scope + per-entity row list once (was
   O(n²)).

## Rendering (Part 3)
- `NodeView` re-renders only the selected subtree on edit; Motion Studio / Component Platform /
  Logic panels subscribe **locally** to their stores (Phase 8K/9A) so a change never re-renders the
  whole `WebsiteCenter` tree.
- Data Explorer table paginates via `offset/limit`; large collections are query-projected before
  render (virtualization-ready).
- Component library, presets, and audit lists cap rendered rows (slice) with the full set queryable.

## Known characteristics (not defects)
- Snapshot-based undo is O(tree) per op — inserting thousands of components programmatically is
  O(n²). Interactive use (tens–hundreds of components) is sub-10ms.
- `.xlsx` binary import/export intentionally handled via CSV (no heavy spreadsheet lib bundled).

## Bundle
Route-split via Vite dynamic imports; the admin/studio bundle is code-split from the customer app.
Guardian tracks 516 files, 0 cycles.
