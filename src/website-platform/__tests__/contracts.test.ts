// API contract tests — the Wave-0 route catalog is well-formed and stable.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { API_VERSION, WEBSITE_ROUTES, GRAPHQL_TYPES } from '../api/contracts';

const VALID_SCOPES = new Set(['content.read', 'content.write', 'publish', 'forms.write', 'realtime', 'personalize']);
const VALID_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

test('API is versioned v1', () => {
  assert.equal(API_VERSION, 'v1');
});

test('every route has a valid method, scope and versioned path', () => {
  assert.ok(WEBSITE_ROUTES.length >= 10);
  for (const r of WEBSITE_ROUTES) {
    assert.ok(VALID_METHODS.has(r.method), `bad method ${r.method}`);
    assert.ok(VALID_SCOPES.has(r.scope), `bad scope ${r.scope}`);
    assert.ok(r.path.startsWith('/v1/'), `unversioned path ${r.path}`);
    assert.ok(r.summary.length > 0);
  }
});

test('core resources have create + read + update + delete', () => {
  const paths = WEBSITE_ROUTES.map(r => `${r.method} ${r.path}`);
  assert.ok(paths.includes('POST /v1/sites'));
  assert.ok(paths.includes('GET /v1/sites/:siteId'));
  assert.ok(paths.includes('PATCH /v1/sites/:siteId'));
  assert.ok(paths.includes('DELETE /v1/sites/:siteId'));
  assert.ok(paths.includes('POST /v1/sites/:siteId/publish'));
});

test('GraphQL type list aligns with the domain model', () => {
  assert.ok(GRAPHQL_TYPES.includes('Site'));
  assert.ok(GRAPHQL_TYPES.includes('Page'));
  assert.ok(GRAPHQL_TYPES.includes('Block'));
});
