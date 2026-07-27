// Phase 9C — unit tests for the Visual Query Engine (filters / operators / sort / aggregate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runQuery, matchCond } from '../data/queryEngine';
import { emptyQuery, type DataRecord, type QuerySpec } from '../data/dataModel';

const recs: DataRecord[] = [
  { id: 'a', tenantId: 't', _createdAt: 1, _updatedAt: 1, title: 'Shawarma', price: 22, active: true },
  { id: 'b', tenantId: 't', _createdAt: 2, _updatedAt: 2, title: 'Pizza', price: 49, active: true },
  { id: 'c', tenantId: 't', _createdAt: 3, _updatedAt: 3, title: 'Burger', price: 35, active: false },
  { id: 'd', tenantId: 't', _createdAt: 4, _updatedAt: 4, title: 'Salad', price: 18, active: true, _deleted: true },
];
const q = (over: Partial<QuerySpec>): QuerySpec => ({ ...emptyQuery('e'), ...over });

test('soft-deleted rows excluded by default', () => {
  assert.equal(runQuery(recs, q({})).total, 3);
  assert.equal(runQuery(recs, q({}), { includeDeleted: true }).total, 4);
});

test('filter operators', () => {
  assert.equal(matchCond(recs[0], { field: 'price', op: 'gt', value: '20' }), true);
  assert.equal(matchCond(recs[0], { field: 'title', op: 'contains', value: 'war' }), true);
  assert.equal(matchCond(recs[0], { field: 'active', op: 'eq', value: 'true' }), true);
  assert.equal(matchCond(recs[2], { field: 'price', op: 'between', value: '30,40' }), true);
  assert.equal(matchCond(recs[1], { field: 'title', op: 'in', value: 'Pizza,Burger' }), true);
});

test('where filter narrows the result', () => {
  const r = runQuery(recs, q({ where: { combinator: 'AND', conditions: [{ field: 'price', op: 'gte', value: '30' }] } }));
  assert.deepEqual(r.rows.map(x => x.title).sort(), ['Burger', 'Pizza']);
});

test('AND vs OR groups', () => {
  const or = runQuery(recs, q({ where: { combinator: 'OR', conditions: [{ field: 'title', op: 'eq', value: 'Pizza' }, { field: 'title', op: 'eq', value: 'Shawarma' }] } }));
  assert.equal(or.total, 2);
  const nested = runQuery(recs, q({ where: { combinator: 'AND', conditions: [{ field: 'active', op: 'eq', value: 'true' }, { combinator: 'OR', conditions: [{ field: 'price', op: 'lt', value: '25' }, { field: 'price', op: 'gt', value: '45' }] }] } }));
  assert.deepEqual(nested.rows.map(x => x.title).sort(), ['Pizza', 'Shawarma']);
});

test('sort + limit + offset + select', () => {
  const r = runQuery(recs, q({ sort: [{ field: 'price', dir: 'desc' }], limit: 2, select: ['title'] }));
  assert.equal(r.rows[0].title, 'Pizza');
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].price, undefined); // projected out
});

test('aggregates + group + distinct', () => {
  assert.equal(runQuery(recs, q({ aggregate: { fn: 'sum', field: 'price' } })).aggregate, 22 + 49 + 35);
  assert.equal(runQuery(recs, q({ aggregate: { fn: 'count', field: 'id' } })).aggregate, 3);
  assert.equal(runQuery(recs, q({ aggregate: { fn: 'max', field: 'price' } })).aggregate, 49);
  const grouped = runQuery(recs, q({ groupBy: 'active', aggregate: { fn: 'count', field: 'id' } }));
  assert.equal(grouped.groups?.find(g => g.key === 'true')?.value, 2);
});
