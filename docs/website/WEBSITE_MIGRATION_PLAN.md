# Website Migration Plan — Current Center → Website OS

> HaaT Now · Phase 10 · Design only (Part 15). A safe, staged migration from the localStorage-only
> Website Center to the DB-backed, edge-rendered Website OS — **do not rewrite blindly**.

## 1. Component disposition

| Current artifact | Disposition | Rationale |
|---|---|---|
| `WebsiteSite`/`WebsitePage`/`WebsiteBlock` model (`website.service.ts:26-60`) | **Reuse → normalize** | Sound shape; map onto `website_*` tables |
| `WebsiteCenter.tsx` editor UX (sections, block reorder, device preview, templates) | **Reuse → rewire** | Good UX; swap localStorage calls for repository/RPC calls |
| `BlockRenderer` (`blocks.tsx`, 12 block types) | **Reuse → extend** | Becomes the seed of the component registry + SSR renderer |
| `runtime.ts` host resolution + SEO composition + sitemap/robots | **Reuse → promote to edge** | Logic is correct; move server-side |
| `MediaPicker` + `storage.service` | **Reuse → extend** | Real Storage integration; add library tables |
| `website.service.ts` localStorage persistence (`readStore`/`writeStore`, `publish`, `rollback`) | **Replace** | Replace with repositories + `publish_site` RPC + snapshots |
| `emitChange` same-tab CustomEvent (`website.service.ts:70`) | **Replace** | Replace with CDN revalidate on publish |
| Cosmetic domain/SSL dropdown | **Replace** | Replace with real Domain Service |
| `defaultSite()` seed generator (`website.service.ts:85-158`) | **Reuse → templatize** | Becomes a `website_templates` starter |

## 2. Dead code / legacy / debt to retire
- **Dead**: the same-tab `emitChange` event as a "publish" mechanism; the in-JS sitemap/robots that
  are never served at a route; the manual `sslStatus` dropdown.
- **Legacy**: the single-blob `haat_sb_website_v1` store (one JSON per browser) — replaced by
  normalized rows. Keep a one-time importer (localStorage → tables) for demo continuity.
- **Debt**: presentational-only blocks (no dynamic data); path-based nav (should be id-based);
  client-only SEO (crawler-invisible). All addressed by the new design.

## 3. Reuse-vs-replace summary
- **~60% reuse** (model, editor UX, renderer, media on-ramp, SEO/host logic) — this is an
  *evolution*, not a greenfield rewrite.
- **~40% replace/new** (persistence, publish/snapshot, edge rendering, domain/SSL, dynamic blocks,
  translations, analytics, forms, media library).

## 4. Safe migration sequence (each step independently shippable, behind a flag)

1. **Schema first (additive, dark).** Ship the `website_*` migrations. No behavior change; tables
   empty. (Idempotent/additive, the Phase 9 style; gated by `20260627*` tenant prerequisites.)
2. **Repositories + services behind a flag.** Introduce `website*.repository` + services; the editor
   can dual-write (localStorage + DB) behind `website.db_backend` feature flag, defaulting off.
3. **Importer.** One-time import of the current localStorage site into `website_*` rows per tenant
   (for anyone who has edited a demo site). Idempotent.
4. **Edge rendering (read path).** Stand up the Rendering Engine reading `website_published_pages`;
   route a canary tenant's public site through it. Old SPA path remains for others.
5. **Publish path.** Wire `publish_site` RPC + snapshot compile + CDN revalidate; flip publish to
   write snapshots. Editor's Publish button now truly goes live.
6. **Cutover per tenant.** Move tenants from the SPA-localStorage path to the DB+edge path,
   monitored; keep a per-tenant rollback flag.
7. **Feature build-out.** Dynamic blocks, theme token editor, media library, translations, forms,
   analytics — each an independent feature increment (see ROADMAP phases).
8. **Retire legacy.** Once all tenants are on DB+edge, remove localStorage persistence and the SPA
   public render branch.

## 5. Rollback strategy
- **Per step**: every step is behind a feature flag; flipping it off reverts to the prior path.
- **Data**: `website_*` are additive; the localStorage store is untouched until step 8, so any step
  1–7 can revert with zero data loss.
- **Publish**: snapshots are immutable + versioned → instant rollback to any prior version
  (Publishing Engine §5).
- **Edge**: the renderer can fall back to serving the last-good snapshot if a compile is bad; the
  reconcile job re-purges on recovery.

## 6. Risk controls (Phase 8/9 lessons applied)
- No `using(true)` policies; strict tenant RLS from day one.
- Atomic, idempotent publish RPC (no partial publishes; the order-creation lesson).
- Live `pg_policies` + `get_advisors` review after applying the website migrations on staging
  (the Phase 9.5 lesson — verify applied state, don't trust files).
- CI: typecheck both code paths, Lighthouse + bundle-budget gates on a sample tenant.
