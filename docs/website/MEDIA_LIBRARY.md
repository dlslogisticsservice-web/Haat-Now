# Media Library — Assets, Transforms & Usage

> HaaT Now · Phase 10 · Design only (Part 7). Builds on the ONE real backend touchpoint today:
> `MediaPicker → assetsService.upload → storage.service` (Supabase Storage, 5 buckets,
> `src/services/storage.service.ts`). Today there is **no media metadata table, no folders, no
> variants, no usage tracking** — uploads are blobs with public URLs. This spec adds the library.

## 1. Model (see WEBSITE_DATABASE_SCHEMA.md)
- `website_assets` — one row per uploaded **original** (filename, kind, dimensions, bytes, checksum,
  alt, storage path).
- `website_media` — derived **variants** of an asset (orig, webp, avif, responsive widths) with CDN
  URLs.
- `website_media_folders` — nested folders/collections.
- `website_asset_usage` — the graph of where an asset is referenced (block/page/field) → powers
  delete-safety, usage tracking, and replace-everywhere.

## 2. Capabilities (Part 7)

| Capability | Design |
|---|---|
| **Upload** | via Media Service → Supabase Storage (reuse `storage.service`); creates `website_assets` + kicks the transform pipeline |
| **Drag & drop** | multi-file drop onto the library or a block image slot |
| **Folders / Collections** | `website_media_folders` tree; assets belong to a folder; collections = saved queries/tags |
| **Compression** | transform pipeline re-encodes to efficient formats; quality tuned per kind |
| **WebP / AVIF** | edge transform emits `webp` + `avif` variants alongside the original |
| **Auto resize** | responsive widths (e.g. 320/768/1200/1600) generated once at upload |
| **Alt text** | required for images (a11y + SEO); editable; surfaced in the picker |
| **Image cropping** | client crop UI → server writes a new variant (non-destructive; original kept) |
| **CDN URLs** | Supabase Storage public URL (already deterministic, `storage.service.getPublicUrl`); optional CDN in front |
| **Bulk upload** | queue with progress; dedup by checksum (skip identical re-uploads) |
| **Image search** | by filename/alt/tag/folder + dimension/kind filters (indexed) |
| **Usage tracking** | `website_asset_usage` lists every block/page using an asset |
| **Replace asset everywhere** | update the asset; all variants + all referencing blocks resolve to the new file (single RPC over the usage graph) |

## 3. Transform pipeline
```
Upload → website_assets(orig, checksum)
  → transform edge function (Deno + image lib / Storage image transforms):
       emits webp, avif, and width variants → website_media rows (+ CDN URLs)
  → block references the ASSET id; the renderer picks the best variant per breakpoint (srcset)
```
- **Idempotent** on checksum: re-uploading the same bytes reuses the asset (no duplicate storage).
- **Non-destructive**: crops/edits create new variants; the original is retained for re-derivation.
- **Lazy option**: variants can be generated on first request (Storage image transform) or eagerly
  at upload — configurable per plan (eager for enterprise, lazy for free).

## 4. Rendering contract (performance)
- Blocks store an **asset id**, not a URL. The renderer emits
  `<img srcset>` + `sizes` + `width/height` + `loading=lazy` + `decoding=async` → CLS 0, LCP-friendly.
- AVIF first, WebP fallback, original last (`<picture>` or `srcset type`).
- Above-the-fold hero images are marked `fetchpriority=high` and preloaded in the snapshot `<head>`.

## 5. Multi-tenant & security
- `website_assets/media/folders/usage` are all `tenant_id`-scoped with RLS — no cross-tenant asset
  access (a white-label guarantee).
- Storage buckets: reuse existing buckets or add a per-tenant-prefixed `website-media` bucket; paths
  namespaced by `tenant_id/…`. The Phase 9.5 advisor flagged public buckets allow listing —
  **fix**: object read via signed/deterministic URLs, disable directory listing on the website bucket.
- Alt text and filenames are user input → sanitized; SVG uploads are sanitized or converted (XSS
  vector).

## 6. Delete safety & replace-everywhere
- Deleting an asset with non-empty `website_asset_usage` is **blocked** (or offered as
  replace-everywhere). This prevents the classic "broken image across 40 pages" failure.
- Replace-everywhere: one RPC swaps the underlying storage object + re-points all variants; because
  blocks reference the asset id, no per-block edit is needed.

## 7. What we reuse vs build
| Reuse | Build |
|---|---|
| `storage.service` (Supabase Storage upload + public URL), `MediaPicker`, `assetsService` | metadata tables, folders, variant pipeline (webp/avif/resize), usage graph, replace-everywhere, dedup, image search, alt-text enforcement |
