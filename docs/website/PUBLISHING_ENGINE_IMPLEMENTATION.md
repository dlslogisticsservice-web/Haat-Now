# Publishing Engine — Implementation (Wave 2)

> The draft→published pipeline built on the Wave 1 persistence engine (snapshot store,
> repositories, outbox, jobs). Compilation + persistence + integrity; HTML rendering is the
> separate Renderer (`../rendering`). Additive, flag-gated (`website.publishing_engine`), unwired.

## Pipeline
```
draft (website_pages/sections/blocks/seo/themes)
  → RepositorySnapshotCompiler.compile()  → immutable SiteSnapshot (CompiledPage[])
  → WebsitePublishingEngine.publish()      → version + integrity + checksum + store + history + event
  → website_snapshots (kind='published')   + website_publish_history + website_published_current view
```

## Capabilities (Part 1)
| Capability | Where |
|---|---|
| Draft → Published | `WebsitePublishingEngine.publish()` |
| Immutable snapshots | `website_snapshots` (unique `site,kind,version`) + Wave 1 `SnapshotStore` |
| Snapshot / Asset / Version manifests | `buildSnapshotManifest`, `buildAssetManifest`, `history()→VersionManifest` |
| **Atomic publish** | compile+validate+store+history in one call; failure short-circuits before storing |
| **Idempotent publish** | dedup on `idempotencyKey` (publish history unique) → no double publish |
| Rollback | `rollback(toVersion)` — verifies integrity, re-points live as a NEW version (history immutable) |
| Scheduled publish | `schedule(request, runAfter)` → enqueues a `publishing` job (Wave 1 job queue) |
| Preview URLs | `previewUrl()` — signed, expiring, `?preview=1` (draft; not indexable) |
| Publish history | `history()` → monotonic version list |
| Content-integrity validation | `validateSnapshotIntegrity()` — path format, duplicate path+locale, etag presence |
| Checksum verification | `SnapshotStore.verify()` (FNV-1a hash + `len:hash` checksum) |

## Compilation
`RepositorySnapshotCompiler` reads the draft graph via **repositories only** (no direct DB):
pages → sections → enabled blocks → SEO → active theme tokens (light/dark) → `CompiledPage[]`.
Each page gets a stable `etag = hash(content+seo)`. Partial publishes compile a `pageIds` subset.

## Atomicity & safety
- Versions are monotonic (`SnapshotStore.latest + 1`); `unique(site,kind,version)` enforces at the DB.
- Integrity is validated **before** the snapshot is stored — a bad compile never becomes live.
- A durable `website.publish.completed` event is emitted (outbox) with the invalidated cache keys
  (the future edge purges them).

## Reuse (white label)
The engine is tenant-scoped and content-agnostic — it publishes any tenant's site identically. The
official HaaT site is just the first caller (`seedHaatSite` → `publish`).

## Tests
`__tests__/publishing.test.ts`: publish + versioning, idempotency, rollback + history, scheduled
job, preview URL, integrity + manifest.
