# Website Platform · Event Catalog (Wave 0)

> The complete set of typed platform events (`src/website-platform/events/events.ts`). Every event
> is strongly typed — there is no `emit(string, any)`. Wave 0 ships the typed catalog + an in-memory
> typed bus; durable outbox delivery (DB trigger → events table → scheduled drainer) implements the
> same `EventBus` interface in a later wave, so consumers never change.

## Envelope
Every event carries an `EventMeta`:
```ts
interface EventMeta { id: UUID; tenantId: UUID; occurredAt: ISODateTime; actorId: UUID | null; idempotencyKey: string | null }
```
`idempotencyKey` supports at-least-once delivery with idempotent consumers (the Phase 9 discipline).

## Catalog (24 events)

| Type | Payload (key fields) | Emitted when |
|---|---|---|
| `website.page.created` | siteId, pageId, slug, locale | a page is created |
| `website.page.updated` | siteId, pageId, version | a page draft changes |
| `website.page.deleted` | siteId, pageId | a page is soft-deleted |
| `website.page.moved` | siteId, pageId, parentId, position | a page is reordered/reparented |
| `website.publish.requested` | siteId, scope, pageIds | a publish is requested |
| `website.publish.completed` | siteId, publishVersion, scope | a snapshot goes live |
| `website.publish.failed` | siteId, reason | a publish compile fails |
| `website.publish.rolled_back` | siteId, toVersion | live reverts to an earlier version |
| `website.revision.created` | siteId, entityType, entityId, revisionId | a revision is checkpointed |
| `website.revision.restored` | siteId, entityType, entityId, revisionId | a revision is restored |
| `website.asset.uploaded` | assetId, kind, bytes, checksum | an asset is uploaded |
| `website.asset.replaced` | assetId | replace-everywhere runs |
| `website.asset.deleted` | assetId | an asset is deleted |
| `website.asset.variants_generated` | assetId, variants | the transform pipeline finishes |
| `website.seo.updated` | pageId, locale, score | SEO fields change |
| `website.redirect.created` | siteId, sourcePath, targetPath | a redirect rule is added |
| `website.seo.broken_link` | siteId, path, target | the broken-link scan finds a dead link |
| `website.theme.activated` | siteId, themeId | a theme becomes active |
| `website.theme.tokens_updated` | themeId, groups | theme tokens change |
| `website.workflow.submitted` | instanceId, targetType, targetId | content enters review |
| `website.workflow.approved` | instanceId, stageKey, approverId | an approval stage passes |
| `website.workflow.rejected` | instanceId, stageKey, approverId | an approval stage rejects |
| `website.realtime.snapshot_invalidated` | siteId, keys | CDN keys are invalidated |
| `website.domain.status_changed` | domainId, host, status | a domain verify/SSL state changes |

Runtime catalog: `WEBSITE_EVENT_TYPES` (asserted to contain exactly these 24 in `events.test.ts`).

## Bus API
```ts
interface EventBus {
  on<T extends WebsiteEventType>(type: T, handler: EventHandler<EventOfType<T>>): Unsubscribe;
  onAny(handler: EventHandler): Unsubscribe;
  publish(event: WebsiteEvent): Promise<void>;
}
```
- `on(type, …)` delivers a **typed** payload (`EventOfType<T>`), verified by tests.
- A throwing handler is isolated; `publish` collects failures and raises `AggregateEventError` after
  running the rest (one bad subscriber never blocks the others).
- `RecordingEventBus` (testing) captures published events for assertions.

## Consumers (later waves)
Journeys (triggers), Experiments (exposure/conversion), Analytics (rollups), Personalization
(profile updates), Observability (health), Realtime blocks (snapshot invalidation). All subscribe to
this catalog — the contracts are frozen now so those waves add consumers without touching producers.

---

## Wave 1 — Durable delivery (Outbox)
The Wave 0 in-memory bus is superseded (interface-compatibly) by the **transactional outbox**
(`OUTBOX_PATTERN.md`). Every published event is now persisted to `website_event_outbox` before/with
delivery, adding: **idempotency** (dedup by `meta.idempotencyKey`), **replay** (re-deliver
pending/failed), **retry** (attempts++), and **dead-letter** (status `dead` at 5 attempts). Producers
still call `EventBus.publish(event)` unchanged; `PageService` emits `website.page.created` through it.
The typed event catalog (24 events) is unchanged.
