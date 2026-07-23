// Provider contracts — the rule this sprint exists to protect:
// a capability with no vendor must FAIL LOUDLY, never return a synthetic success.
//
// Imports contracts.ts only (pure types + the null-adapter factory). registry.ts is not
// imported here because it pulls in browser/Supabase modules; its adapters are covered
// by the ops-workspace browser check.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notConfigured, ProviderNotConfiguredError, type Capability } from '../../providers/contracts';

test('an unconfigured capability throws instead of pretending', () => {
  const send = notConfigured('sms', ['VITE_SMS_PROVIDER_KEY']);
  assert.throws(() => send(), ProviderNotConfiguredError);
});

test('the error names the capability and the env keys the operator must set', () => {
  try {
    notConfigured('push', ['VITE_PUSH_PROVIDER_KEY'])();
    assert.fail('must throw');
  } catch (e) {
    const err = e as ProviderNotConfiguredError;
    assert.equal(err.capability, 'push');
    assert.deepEqual(err.requires, ['VITE_PUSH_PROVIDER_KEY']);
    assert.match(err.message, /VITE_PUSH_PROVIDER_KEY/);
    assert.match(err.message, /registry\.ts/, 'the error must say where to plug the adapter in');
  }
});

test('the error never returns a falsy-but-usable value (no silent no-op)', () => {
  const fn = notConfigured('email', []);
  // A no-op returning undefined is the failure mode this replaces: the caller would
  // read it as "sent". Assert it genuinely throws rather than yielding a value.
  let returned: unknown = 'sentinel';
  try { returned = fn(); } catch { returned = 'threw'; }
  assert.equal(returned, 'threw');
});

test('every capability in the union can produce a not-configured error', () => {
  const caps: Capability[] = ['auth', 'location', 'payment', 'push', 'sms', 'email', 'storage', 'analytics', 'crash'];
  for (const c of caps) {
    assert.throws(() => notConfigured(c, [])(), ProviderNotConfiguredError, `${c} must be able to fail loudly`);
  }
});

test('ProviderNotConfiguredError is identifiable by name for error handling', () => {
  try { notConfigured('sms', [])(); } catch (e) {
    assert.equal((e as Error).name, 'ProviderNotConfiguredError');
    assert.ok(e instanceof Error);
  }
});
