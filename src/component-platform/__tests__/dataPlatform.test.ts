// Phase 9D — unit tests: SQL generator, seed generator, field validation, HAAT schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTableSQL, schemaSQL, migrationSQL, insertsSQL } from '../data/sqlGenerator';
import { generateSeed } from '../data/seedGenerator';
import { validateRecord } from '../data/fieldValidation';
import { buildHaatModels } from '../data/haatSchema';
import type { Entity, DataRecord } from '../data/dataModel';

const entity: Entity = {
  id: 'e1', name: 'Products', icon: 'x', color: '#fff', tags: [], system: false, version: 1,
  mapping: { provider: 'local', target: 'products' }, permissions: [],
  fields: [
    { id: 'f1', name: 'id', type: 'uuid', settings: { required: true, unique: true, indexed: true } },
    { id: 'f2', name: 'name', type: 'text', settings: { required: true, indexed: true }, validations: [{ id: 'v1', rule: 'required' }, { id: 'v2', rule: 'minLength', value: '3' }] },
    { id: 'f3', name: 'price', type: 'currency', settings: { min: 0 } },
    { id: 'f4', name: 'rating', type: 'rating', settings: {} },
  ],
};

test('SQL — CREATE TABLE emits columns, PK, constraints, index', () => {
  const sql = createTableSQL(entity);
  assert.match(sql, /create table if not exists products/);
  assert.match(sql, /id uuid primary key/);
  assert.match(sql, /name varchar\(255\) not null/);
  assert.match(sql, /chk_products_rating check \(rating between 1 and 5\)/);
  assert.match(sql, /create index idx_products_name/);
});

test('SQL — schema + migration up/down', () => {
  const s = schemaSQL([entity], []);
  assert.match(s, /HAAT NOW schema/);
  const m = migrationSQL([entity], []);
  assert.match(m.up, /create table/);
  assert.match(m.down, /drop table if exists products cascade/);
});

test('SQL — inserts escape quotes', () => {
  const recs: DataRecord[] = [{ id: 'r1', tenantId: 't', _createdAt: 0, _updatedAt: 0, name: "O'Brien", price: 9 }];
  assert.match(insertsSQL(entity, recs), /insert into products/);
  assert.match(insertsSQL(entity, recs), /O''Brien/);
});

test('Seed — deterministic + scales', () => {
  const a = generateSeed(entity, 't', 100, 42);
  const b = generateSeed(entity, 't', 100, 42);
  assert.equal(a.length, 100);
  assert.equal(a[10].name, b[10].name); // deterministic with same seed
  const big = generateSeed(entity, 't', 10000, 1);
  assert.equal(big.length, 10000);
  assert.ok(typeof big[0].rating === 'number' && (big[0].rating as number) >= 1 && (big[0].rating as number) <= 5);
});

test('Validation — required + minLength', () => {
  const bad = validateRecord(entity, { id: 'r', tenantId: 't', _createdAt: 0, _updatedAt: 0, name: 'ab' });
  assert.ok(bad.some(e => e.rule === 'minLength'));
  const missing = validateRecord(entity, { id: 'r', tenantId: 't', _createdAt: 0, _updatedAt: 0, name: '' });
  assert.ok(missing.some(e => e.rule === 'required'));
  const ok = validateRecord(entity, { id: 'r', tenantId: 't', _createdAt: 0, _updatedAt: 0, name: 'Pizza' });
  assert.equal(ok.length, 0);
});

test('HAAT schema — 23 entities, HAAT-only, relations wired', () => {
  const { entities, relations } = buildHaatModels();
  assert.equal(entities.length, 23);
  const names = entities.map(e => e.name);
  for (const req of ['Restaurants', 'Branches', 'Orders', 'OrderItems', 'Payments', 'Wallets', 'Drivers', 'DeliveryZones']) assert.ok(names.includes(req), `missing ${req}`);
  assert.ok(!names.some(n => /beauty|logistics/i.test(n)), 'no external projects');
  assert.ok(relations.length > 0);
});
