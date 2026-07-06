// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Test factories (Wave 0).
// Deterministic-with-overrides builders for DTOs and events. Keeps tests concise
// and consistent. Not shipped in the app bundle (imported only by tests).
// ─────────────────────────────────────────────────────────────────────────────

import type { UUID } from '../shared/types';
import type { CreateSiteDto, CreatePageDto } from '../domain/dto';
import type { WebsiteEvent } from '../events/events';

let counter = 0;
/** Stable pseudo-UUID for tests (valid v4 shape, deterministic per call index). */
export function testUuid(seed?: number): UUID {
  const n = (seed ?? ++counter).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${n}`;
}

export function makeCreateSiteDto(overrides: Partial<CreateSiteDto> = {}): CreateSiteDto {
  return {
    tenantId: testUuid(1),
    slug: 'acme-foods',
    name: 'Acme Foods',
    defaultLocale: 'ar',
    locales: ['ar', 'en'],
    ...overrides,
  };
}

export function makeCreatePageDto(siteId: UUID, overrides: Partial<CreatePageDto> = {}): CreatePageDto {
  return {
    tenantId: testUuid(1),
    siteId,
    slug: 'pricing',
    title: 'Pricing',
    routeType: 'static',
    locale: 'ar',
    inNav: true,
    position: 0,
    ...overrides,
  };
}

export function makePageCreatedEvent(tenantId: UUID, siteId: UUID, pageId: UUID): WebsiteEvent {
  return {
    type: 'website.page.created',
    meta: { id: testUuid(), tenantId, occurredAt: '2026-07-05T00:00:00.000Z', actorId: null, idempotencyKey: null },
    payload: { siteId, pageId, slug: 'pricing', locale: 'ar' },
  };
}
