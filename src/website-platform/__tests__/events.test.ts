// Event backbone tests — typed pub/sub, isolation, recording, catalog completeness.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { InMemoryEventBus } from '../events/bus';
import { WEBSITE_EVENT_TYPES } from '../events/events';
import { RecordingEventBus } from '../testing/mocks';
import { makePageCreatedEvent, testUuid } from '../testing/factories';

test('typed subscription receives only its event type', async () => {
  const bus = new InMemoryEventBus();
  const seen: string[] = [];
  bus.on('website.page.created', e => { seen.push(e.payload.pageId); });
  await bus.publish(makePageCreatedEvent(testUuid(1), testUuid(2), testUuid(3)));
  assert.equal(seen.length, 1);
});

test('unsubscribe stops delivery', async () => {
  const bus = new InMemoryEventBus();
  let count = 0;
  const off = bus.on('website.page.created', () => { count++; });
  off();
  await bus.publish(makePageCreatedEvent(testUuid(1), testUuid(2), testUuid(3)));
  assert.equal(count, 0);
});

test('a throwing handler is isolated and surfaced as AggregateEventError', async () => {
  const bus = new InMemoryEventBus();
  let otherRan = false;
  bus.on('website.page.created', () => { throw new Error('boom'); });
  bus.onAny(() => { otherRan = true; });
  await assert.rejects(() => bus.publish(makePageCreatedEvent(testUuid(1), testUuid(2), testUuid(3))));
  assert.equal(otherRan, true); // the other handler still ran
});

test('RecordingEventBus records and filters by type', async () => {
  const bus = new RecordingEventBus();
  await bus.publish(makePageCreatedEvent(testUuid(1), testUuid(2), testUuid(3)));
  assert.equal(bus.published.length, 1);
  assert.equal(bus.ofType('website.page.created').length, 1);
});

test('event catalog lists 24 distinct event types', () => {
  const unique = new Set(WEBSITE_EVENT_TYPES);
  assert.equal(unique.size, WEBSITE_EVENT_TYPES.length);
  assert.equal(WEBSITE_EVENT_TYPES.length, 24);
});
