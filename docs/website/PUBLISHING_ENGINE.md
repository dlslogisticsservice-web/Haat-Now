# Publishing Engine

> HaaT Now · Phase 10 · Design only (Part 11). This is the component that **fixes "publish doesn't
> go live."** Today publish copies draft→published inside one browser's localStorage
> (`website.service.ts:244-253`). Website OS makes publish an **atomic, server-side, snapshot-based,
> CDN-invalidating** operation.

## 1. The publish contract
**Publish compiles the current draft graph of a site (or a subset of pages) into a new immutable
snapshot version, atomically, and revalidates the CDN so the new content is live in seconds.**

```
draft tables (website_pages/sections/blocks/nav/theme/seo/translations)
   │  publish_site(site_id, scope, idempotency_key)   ← SECURITY DEFINER RPC, one transaction
   ▼
website_publish_history(version N, snapshot)          ← immutable, monotonic version
website_published_pages(site_id, path, locale, ...)   ← per-page denormalized snapshot (O(1) reads)
   │  emit revalidate event
   ▼
Rendering Engine / CDN                                 ← purge keys host:path → next request re-renders
```

## 2. States & flow (Part 11)

```
Draft ──edit──► Draft
  │ request review
  ▼
Review ──approve──► Approved ──publish──► Published
  │ reject                                   │ rollback
  ▼                                          ▼
Draft                                   Published (earlier version)
```

| Stage | Meaning | Permission |
|---|---|---|
| **Draft** | editable; visible only in Preview | `website.edit` |
| **Preview** | authenticated render of the draft (no cache), device frames, shareable signed link | `website.edit` |
| **Review** | submitted for approval; locked from further edits (optional) | `website.edit` |
| **Approval** | a publisher approves/rejects | `website.approve` |
| **Publish** | compile snapshot + go live | `website.publish` |
| **Rollback** | re-point live to an earlier version | `website.publish` |

Approval is **configurable per site** (enterprise: require approval; SMB: publisher self-serves).

## 3. Publish modes

| Mode | Behaviour |
|---|---|
| **Instant Publish** | compile snapshot now; revalidate affected CDN keys immediately |
| **Scheduled Publish** | set `publish_at`; the Phase 9 scheduler (pg_cron / scheduled edge) fires `publish_site` at the time |
| **Atomic Publish** | the whole compile is one transaction; either the entire new version is live or nothing changes — never a half-published site |
| **Partial Publish** | publish a subset of pages (scope='partial') — only those `website_published_pages` rows + CDN keys change; the rest of the site is untouched |

## 4. Atomicity & idempotency (Phase 9 patterns)
- `publish_site` is a **SECURITY DEFINER RPC** wrapped in one transaction; it writes the new
  `website_publish_history` row and upserts `website_published_pages` in the same commit.
- **Idempotent** on a client-supplied `idempotency_key` (unique) → a double-click or retry returns
  the same version, never double-publishes (mirrors the Phase 9 order/refund idempotency fix).
- Version numbers are monotonic per site (`unique(site_id, version)`).

## 5. Rollback & version history
- `website_publish_history` retains every version's full snapshot (immutable).
- Rollback re-points `website_published_pages` to a chosen historical version's content and bumps a
  new version (never mutates history) — the current `rollback` semantics (`website.service.ts:256`),
  made server-side and atomic.
- Diff view between any two versions (page/block level) for auditability.

## 6. Preview Engine
- Authenticated edge route renders the **draft** snapshot on the fly (no CDN cache), so editors see
  exactly what will publish. Device frames + a **shareable signed preview link** (expiring token)
  let stakeholders review without an account.
- Preview never caches and is never indexable (robots noindex + auth).

## 7. Cache invalidation
- On publish: compute the set of changed `(host, path, locale)` keys and purge/revalidate only
  those CDN entries (surgical, not full-site) → fast, cheap at 10k tenants.
- Dynamic-data blocks additionally carry a short TTL (ISR) so live platform data (stores/offers)
  stays fresh without a publish.

## 8. Audit
Every publish/rollback writes: a `website_publish_history` row (who/when/version/scope) **and** an
`operation_events` audit row (reusing the platform's audit timeline) — full accountability, matching
the enterprise-ops requirement.

## 9. Failure & safety
- If snapshot compile fails, the transaction rolls back → the currently-live version is untouched
  (no partial publish — the class of failure the Phase 8 audit worried about for orders).
- If CDN revalidation fails after commit, a reconcile job (Phase 9 scheduler) re-emits the purge;
  the snapshot is already authoritative, so eventual consistency is safe.
