// Audit trail tests — who/when/before/after/correlation/tenant/environment.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createAuditRecorder } from '../audit/audit';
import { testUuid } from '../testing/factories';
import { isOk } from '../shared/types';

test('records a full audit entry and can query by entity', async () => {
  const audit = createAuditRecorder('memory');
  const ctx = { tenantId: testUuid(1), actorId: testUuid(2), correlationId: 'req-9', environment: 'production' as const };
  const r = await audit.record(ctx, { action: 'website.page.update', entityType: 'website.page', entityId: testUuid(3), before: { title: 'A' }, after: { title: 'B' } });
  assert.ok(isOk(r));
  assert.equal(r.value.tenantId, ctx.tenantId);
  assert.equal(r.value.actorId, ctx.actorId);
  assert.equal(r.value.correlationId, 'req-9');
  assert.equal(r.value.environment, 'production');
  assert.deepEqual(r.value.before, { title: 'A' });
  assert.deepEqual(r.value.after, { title: 'B' });

  const q = await audit.query({ entityType: 'website.page' });
  assert.ok(isOk(q));
  assert.equal(q.value.length, 1);
});

test('correlation id threads related mutations', async () => {
  const audit = createAuditRecorder('memory');
  const ctx = { tenantId: testUuid(1), actorId: null, correlationId: 'batch-1', environment: 'sandbox' as const };
  await audit.record(ctx, { action: 'a', entityType: 'website.page', entityId: testUuid(3), before: null, after: {} });
  await audit.record(ctx, { action: 'b', entityType: 'website.block', entityId: testUuid(4), before: null, after: {} });
  const q = await audit.query({ correlationId: 'batch-1' });
  assert.ok(isOk(q));
  assert.equal(q.value.length, 2);
});
