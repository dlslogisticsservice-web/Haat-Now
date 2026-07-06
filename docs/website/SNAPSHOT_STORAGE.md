# Website Platform · Snapshot Storage (Wave 1)

> **Persistence only — no rendering.** Stores draft + published snapshots with a deterministic
> content hash, a checksum, a monotonic version, and an optional storage reference. Backed by
> `website_snapshots` (memory or Supabase).

## Record
```ts
interface SnapshotRecord {
  id; tenantId; siteId;
  kind: 'draft' | 'published';
  version: number;                 // monotonic per (site, kind)
  hash: string;                    // deterministic content hash (FNV-1a, stable key order)
  checksum: string;                // `${len}:${hash}` integrity token
  storageRef: string | null;       // optional pointer to Storage (large snapshots)
  snapshot: JsonObject;            // the compiled content graph (opaque here)
  createdAt;
}
```

## Determinism & integrity
- `contentHash(value)` canonicalizes with **sorted keys** before hashing, so semantically-equal
  snapshots hash equal regardless of key order — enabling dedup + change detection.
- `checksum(value)` = length + hash; `store.verify(record)` recomputes and compares to detect
  tampering/corruption. No async crypto — cheap enough to run inline on every save (see benchmarks).

## Streams
Draft and published are **separate versioned streams** per site. `latest(site, kind)` returns the
highest version; `getByVersion(site, kind, v)` is exact. Publish version allocation uses the DB RPC
`website_next_publish_version(site)` (runtime migration).

## What Wave 1 does / does not do
- **Does:** persist snapshots, hash/checksum, version, retrieve, verify integrity, store a storage
  reference. `unique(site_id, kind, version)` enforces version integrity at the DB.
- **Does NOT:** compile the snapshot from the content graph, render HTML, or publish to the edge/CDN
  (those are the Publishing Engine + Rendering Engine — later waves). Wave 1 is the storage substrate.

## Storage integration
Large snapshots may set `storageRef` to a Supabase Storage object (via the `StorageGateway`,
tenant-namespaced) instead of inlining the JSON — the record keeps the hash/checksum for integrity.

## Tests
`__tests__/snapshot.test.ts`: hash determinism/order-independence, save + verify + tamper detection,
`latest` / `getByVersion`, draft/published stream separation.
