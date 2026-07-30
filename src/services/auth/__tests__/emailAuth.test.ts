// STEP 3B — Email OTP auth refactor. Runs under tsx with no VITE_AUTH_MODE, so
// config/runtime resolves to sandbox and authService exercises the demo path (no network).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authService } from '../../auth.service';
import { emailOtpProvider } from '../emailOtpProvider';
import { phoneOtpProvider } from '../phoneOtpProvider';
import { getAuthProvider, ACTIVE_AUTH_CHANNEL } from '../registry';
import { demoByEmail, DEMO_OTP } from '../demoAccounts';

const CUSTOMER = 'customer.eg@haatnow.test';
const SUPER    = 'super@haatnow.test';
const ADMIN_EG = 'admin.eg@haatnow.test';
const DRIVER   = 'driver.eg@haatnow.test';

test('active channel is email; registry resolves both providers', () => {
  assert.equal(ACTIVE_AUTH_CHANNEL, 'email');
  assert.equal(getAuthProvider().channel, 'email');
  assert.equal(getAuthProvider('phone').channel, 'phone');
});

test('email provider normalizes, validates and masks safely', () => {
  assert.equal(emailOtpProvider.normalize('  Customer.EG@Haatnow.TEST '), CUSTOMER);
  assert.ok(emailOtpProvider.isValid(CUSTOMER));
  assert.ok(!emailOtpProvider.isValid('not-an-email'));
  assert.ok(!emailOtpProvider.isValid('missing@tld'));
  const masked = emailOtpProvider.mask(CUSTOMER);
  assert.match(masked, /@haatnow\.test$/);
  assert.ok(!masked.includes('customer.eg'), 'local part is redacted');
});

test('phone provider is preserved for future CEQUENS (E.164)', () => {
  assert.equal(phoneOtpProvider.channel, 'phone');
  assert.ok(phoneOtpProvider.isValid('+201000000001'));
  assert.ok(!phoneOtpProvider.isValid('01000000001'));
});

test('login: send + verify a demo email OTP → user carries email + role', async () => {
  const send = await authService.sendOtp(CUSTOMER);
  assert.equal(send.error, null);
  const { data, error } = await authService.verifyOtp(CUSTOMER, DEMO_OTP);
  assert.equal(error, null);
  assert.ok(data.user);
  assert.equal(data.user?.email, CUSTOMER);
  assert.equal(data.user?.role, 'customer');
  assert.equal(data.user?.id, demoByEmail(CUSTOMER)?.id);
});

test('invalid email is rejected before any send', async () => {
  const { error } = await authService.sendOtp('nope');
  assert.ok(error);
  assert.equal(error.code, 'invalid_identity');
});

test('unknown (non-demo) email is rejected in sandbox', async () => {
  const { error } = await authService.sendOtp('stranger@example.com');
  assert.ok(error);
  assert.equal(error.code, 'unknown_demo');
});

test('invalid OTP fails; a correct OTP still works afterwards', async () => {
  await authService.sendOtp(ADMIN_EG);
  const bad = await authService.verifyOtp(ADMIN_EG, '000000');
  assert.ok(bad.error);
  assert.equal(bad.data.user, null);
  const good = await authService.verifyOtp(ADMIN_EG, DEMO_OTP);
  assert.equal(good.error, null);
  assert.ok(good.data.user);
});

test('rate limiting: an immediate resend is denied with a cooldown', async () => {
  const first = await authService.sendOtp(DRIVER);
  assert.equal(first.error, null);
  const second = await authService.sendOtp(DRIVER);
  assert.ok(second.error);
  assert.equal(second.error.code, 'otp_cooldown');
  assert.ok((second.error.retryAfterSec ?? 0) > 0);
});

test('RBAC admin scope: super vs country vs none — unchanged', async () => {
  assert.equal(await authService.getAdminScope(demoByEmail(SUPER)!.id), 'super');
  assert.equal(await authService.getAdminScope(demoByEmail(ADMIN_EG)!.id), 'country');
  assert.equal(await authService.getAdminScope(demoByEmail(CUSTOMER)!.id), null);
});

test('logout resolves cleanly (sandbox)', async () => {
  const { error } = await authService.signOut();
  assert.equal(error, null);
});
