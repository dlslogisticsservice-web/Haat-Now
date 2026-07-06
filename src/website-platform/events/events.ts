// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Typed event catalog (Wave 0).
// The complete set of platform events. Every event is strongly typed; there is no
// untyped "emit(string, any)". Consumers (journeys, analytics, observability,
// realtime invalidation) subscribe to these. Wave 0 defines the contracts + an
// in-memory bus; durable outbox delivery is a later wave.
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID, ISODateTime } from '../shared/types';

/** Envelope shared by every event. `idempotencyKey` supports at-least-once + dedup. */
export interface EventMeta {
  id: UUID;
  tenantId: UUID;
  occurredAt: ISODateTime;
  actorId: UUID | null;
  idempotencyKey: string | null;
}

interface Base<TType extends string, TPayload> {
  type: TType;
  meta: EventMeta;
  payload: TPayload;
}

// ── Page events ─────────────────────────────────────────────────────────────
export type PageCreated = Base<'website.page.created', { siteId: UUID; pageId: UUID; slug: string; locale: string }>;
export type PageUpdated = Base<'website.page.updated', { siteId: UUID; pageId: UUID; version: number }>;
export type PageDeleted = Base<'website.page.deleted', { siteId: UUID; pageId: UUID }>;
export type PageMoved = Base<'website.page.moved', { siteId: UUID; pageId: UUID; parentId: UUID | null; position: number }>;

// ── Publishing events ───────────────────────────────────────────────────────
export type PublishRequested = Base<'website.publish.requested', { siteId: UUID; scope: 'full' | 'partial'; pageIds: UUID[] }>;
export type PublishCompleted = Base<'website.publish.completed', { siteId: UUID; publishVersion: number; scope: 'full' | 'partial' }>;
export type PublishFailed = Base<'website.publish.failed', { siteId: UUID; reason: string }>;
export type PublishRolledBack = Base<'website.publish.rolled_back', { siteId: UUID; toVersion: number }>;

// ── Version events ──────────────────────────────────────────────────────────
export type RevisionCreated = Base<'website.revision.created', { siteId: UUID; entityType: string; entityId: UUID; revisionId: UUID }>;
export type RevisionRestored = Base<'website.revision.restored', { siteId: UUID; entityType: string; entityId: UUID; revisionId: UUID }>;

// ── Media events ────────────────────────────────────────────────────────────
export type AssetUploaded = Base<'website.asset.uploaded', { assetId: UUID; kind: string; bytes: number | null; checksum: string | null }>;
export type AssetReplaced = Base<'website.asset.replaced', { assetId: UUID }>;
export type AssetDeleted = Base<'website.asset.deleted', { assetId: UUID }>;
export type AssetVariantsGenerated = Base<'website.asset.variants_generated', { assetId: UUID; variants: string[] }>;

// ── SEO events ──────────────────────────────────────────────────────────────
export type SeoUpdated = Base<'website.seo.updated', { pageId: UUID; locale: string; score: number | null }>;
export type RedirectCreated = Base<'website.redirect.created', { siteId: UUID; sourcePath: string; targetPath: string }>;
export type BrokenLinkDetected = Base<'website.seo.broken_link', { siteId: UUID; path: string; target: string }>;

// ── Theme events ────────────────────────────────────────────────────────────
export type ThemeActivated = Base<'website.theme.activated', { siteId: UUID; themeId: UUID }>;
export type ThemeTokensUpdated = Base<'website.theme.tokens_updated', { themeId: UUID; groups: string[] }>;

// ── Workflow events ─────────────────────────────────────────────────────────
export type WorkflowSubmitted = Base<'website.workflow.submitted', { instanceId: UUID; targetType: string; targetId: UUID }>;
export type WorkflowApproved = Base<'website.workflow.approved', { instanceId: UUID; stageKey: string; approverId: UUID | null }>;
export type WorkflowRejected = Base<'website.workflow.rejected', { instanceId: UUID; stageKey: string; approverId: UUID | null }>;

// ── Realtime events ─────────────────────────────────────────────────────────
export type SnapshotInvalidated = Base<'website.realtime.snapshot_invalidated', { siteId: UUID; keys: string[] }>;
export type DomainStatusChanged = Base<'website.domain.status_changed', { domainId: UUID; host: string; status: string }>;

/** The discriminated union of every platform event. */
export type WebsiteEvent =
  | PageCreated | PageUpdated | PageDeleted | PageMoved
  | PublishRequested | PublishCompleted | PublishFailed | PublishRolledBack
  | RevisionCreated | RevisionRestored
  | AssetUploaded | AssetReplaced | AssetDeleted | AssetVariantsGenerated
  | SeoUpdated | RedirectCreated | BrokenLinkDetected
  | ThemeActivated | ThemeTokensUpdated
  | WorkflowSubmitted | WorkflowApproved | WorkflowRejected
  | SnapshotInvalidated | DomainStatusChanged;

/** Literal type of every event `type`, for switch exhaustiveness + subscription. */
export type WebsiteEventType = WebsiteEvent['type'];

/** Narrow the union to a single event by its `type`. */
export type EventOfType<T extends WebsiteEventType> = Extract<WebsiteEvent, { type: T }>;

/** All known event type strings (runtime catalog, e.g. for docs/validation). */
export const WEBSITE_EVENT_TYPES: ReadonlyArray<WebsiteEventType> = [
  'website.page.created', 'website.page.updated', 'website.page.deleted', 'website.page.moved',
  'website.publish.requested', 'website.publish.completed', 'website.publish.failed', 'website.publish.rolled_back',
  'website.revision.created', 'website.revision.restored',
  'website.asset.uploaded', 'website.asset.replaced', 'website.asset.deleted', 'website.asset.variants_generated',
  'website.seo.updated', 'website.redirect.created', 'website.seo.broken_link',
  'website.theme.activated', 'website.theme.tokens_updated',
  'website.workflow.submitted', 'website.workflow.approved', 'website.workflow.rejected',
  'website.realtime.snapshot_invalidated', 'website.domain.status_changed',
];
