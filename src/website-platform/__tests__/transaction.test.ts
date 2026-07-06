// Unit-of-Work (saga) tests — commit, rollback with compensation, savepoints, reorder.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SagaUnitOfWork } from '../persistence/unit-of-work';
import { createPlatformContext } from '../services/context';
import { PageService } from '../services/services';
import { makeCreatePageDto, testUuid } from '../testing/factories';
import { ok, err, isOk } from '../shared/types';
import { errors } from '../shared/errors';

test('transaction commits and returns the value on success', async () => {
  const uow = new SagaUnitOfWork();
  const applied: number[] = [];
  const r = await uow.transaction(async tx => {
    await tx.step({ do: async () => { applied.push(1); return ok(1); } });
    await tx.step({ do: async () => { applied.push(2); return ok(2); } });
    return ok('done');
  });
  assert.ok(isOk(r));
  assert.deepEqual(applied, [1, 2]);
});

test('a failing step rolls back completed steps (compensation, LIFO)', async () => {
  const uow = new SagaUnitOfWork();
  const undone: number[] = [];
  const r = await uow.transaction(async tx => {
    const a = await tx.step({ do: async () => ok(1), undo: async () => { undone.push(1); } });
    if (!isOk(a)) return err(a.error);
    const b = await tx.step({ do: async () => ok(2), undo: async () => { undone.push(2); } });
    if (!isOk(b)) return err(b.error);
    const c = await tx.step<number>({ do: async () => err(errors.conflict('boom')), undo: async () => { undone.push(3); } });
    if (!isOk(c)) return err(c.error);
    return ok('unreachable');
  });
  assert.equal(r.ok, false);
  assert.deepEqual(undone, [2, 1]); // reverse order; failing step's own undo not run
});

test('savepoint allows partial rollback', async () => {
  const uow = new SagaUnitOfWork();
  const undone: string[] = [];
  await uow.transaction(async tx => {
    await tx.step({ do: async () => ok('a'), undo: async () => { undone.push('a'); } });
    const mark = tx.savepoint();
    await tx.step({ do: async () => ok('b'), undo: async () => { undone.push('b'); } });
    await tx.rollbackTo(mark);
    return ok('kept-a');
  });
  assert.deepEqual(undone, ['b']);
});

test('PageService.reorder is transactional and updates positions', async () => {
  const ctx = createPlatformContext({ backend: 'memory' });
  const pages = new PageService(ctx);
  const op = { tenantId: testUuid(1), actorId: null, correlationId: 'c' };
  const siteId = testUuid(5);
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await pages.create(op, makeCreatePageDto(siteId, { slug: `p-${i}`, position: i }));
    if (isOk(r)) ids.push(r.value.id);
  }
  const reordered = await pages.reorder(op, [ids[2], ids[1], ids[0]]);
  assert.ok(isOk(reordered));
  assert.equal(reordered.value, 3);
  const first = await pages.get(op, ids[2]);
  assert.ok(isOk(first));
  assert.equal(first.value.position, 0);
});
