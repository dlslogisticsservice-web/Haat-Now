import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Polyfill the browser bits lazyRetry touches, capturing reload() calls.
let reloads = 0;
class SS { m = new Map<string, string>(); getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; } setItem(k: string, v: string) { this.m.set(k, String(v)); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }
(globalThis as any).sessionStorage = new SS();
(globalThis as any).window = { location: { reload() { reloads++; } } };

const { lazyRetry } = await import('../../lib/lazyRetry');

beforeEach(() => { reloads = 0; (globalThis as any).sessionStorage.clear(); });

test('successful import passes through and clears the reload flag', async () => {
  (globalThis as any).sessionStorage.setItem('haat_chunk_reload', '1');
  const mod = await lazyRetry(async () => ({ default: 42 }));
  assert.deepEqual(mod, { default: 42 });
  assert.equal((globalThis as any).sessionStorage.getItem('haat_chunk_reload'), null);
  assert.equal(reloads, 0);
});

test('a chunk-load error triggers exactly one reload (never resolves before it)', async () => {
  const err = new Error('Failed to fetch dynamically imported module: /assets/index-abc.js');
  const p = lazyRetry(() => Promise.reject(err));
  const race = await Promise.race([p, new Promise(r => setTimeout(() => r('pending'), 50))]);
  assert.equal(race, 'pending');                 // stays pending until navigation
  assert.equal(reloads, 1);                       // reloaded once
  assert.equal((globalThis as any).sessionStorage.getItem('haat_chunk_reload'), '1');
});

test('a second chunk error (post-reload) does NOT loop — it rethrows to the boundary', async () => {
  (globalThis as any).sessionStorage.setItem('haat_chunk_reload', '1');
  const err = Object.assign(new Error('Loading chunk 5 failed'), { name: 'ChunkLoadError' });
  await assert.rejects(() => lazyRetry(() => Promise.reject(err)));
  assert.equal(reloads, 0);                       // no reload loop
  assert.equal((globalThis as any).sessionStorage.getItem('haat_chunk_reload'), null);
});

test('a non-chunk error is re-thrown untouched (real bugs still surface)', async () => {
  const err = new TypeError('cannot read properties of undefined');
  await assert.rejects(() => lazyRetry(() => Promise.reject(err)), /cannot read properties/);
  assert.equal(reloads, 0);
});
