// Outbox tests — persistence, idempotency, delivery, failure, replay.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createOutboxBus } from '../outbox/outbox';
import { makePageCreatedEvent, testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

function evt(idem: string | null) {
  const e = makePageCreatedEvent(testUuid(1), testUuid(2), testUuid(3));
  return { ...e, meta: { ...e.meta, id: crypto.randomUUID(), idempotencyKey: idem } };
}

test('publish persists the event and delivers to subscribers', async () => {
  const bus = createOutboxBus('memory');
  let received = 0;
  bus.on('website.page.created', () => { received++; });
  await bus.publish(evt(null));
  assert.equal(received, 1);
  const pending = await bus.pending();
  assert.ok(isOk(pending));
  assert.equal(pending.value.length, 0); // delivered → processed, not pending
});

test('idempotency: duplicate idempotencyKey is not published twice', async () => {
  const bus = createOutboxBus('memory');
  let received = 0;
  bus.on('website.page.created', () => { received++; });
  await bus.publish(evt('dup-1'));
  await bus.publish(evt('dup-1'));
  assert.equal(received, 1);
});

test('a throwing subscriber marks the record failed; replay re-delivers', async () => {
  const bus = createOutboxBus('memory');
  let fail = true;
  bus.on('website.page.created', () => { if (fail) throw new Error('boom'); });
  await bus.publish(evt('r-1'));
  const dl = await bus.deadLetters();
  assert.ok(isOk(dl));
  // one attempt → 'failed', not yet dead
  fail = false;
  const replayed = await bus.replay();
  assert.ok(isOk(replayed));
  assert.ok(replayed.value >= 1);
});
