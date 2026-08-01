// STEP 3B hardening — configurable channel, feature flags, audit log, metrics.
// node's test runner isolates each file in its own process, so the global config/
// metrics mutations here do not leak into other suites.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authConfig, isFeatureEnabled, channelFeature, configureAuth } from '../config';
import { authMetrics } from '../authMetrics';
import { authAudit } from '../authAudit';
import { authService } from '../../auth.service';
import { DEMO_OTP } from '../demoAccounts';

test('config: active channel + flags default to current behavior', () => {
  assert.equal(authConfig.activeChannel, 'email');
  assert.ok(isFeatureEnabled('email_otp'));
  assert.ok(!isFeatureEnabled('phone_otp'));
  assert.ok(isFeatureEnabled('google_oauth')); // visible placeholder preserved
  assert.ok(!isFeatureEnabled('guest'));
  assert.equal(channelFeature('email'), 'email_otp');
  assert.equal(channelFeature('phone'), 'phone_otp');
});

test('config: channel + flags switch at runtime with no code change', () => {
  configureAuth({ activeChannel: 'phone', features: { phone_otp: true, email_otp: false } });
  assert.equal(authConfig.activeChannel, 'phone');
  assert.ok(isFeatureEnabled('phone_otp'));
  assert.ok(!isFeatureEnabled('email_otp'));
  configureAuth({ activeChannel: 'email', features: { email_otp: true, phone_otp: false } }); // restore
  assert.equal(authConfig.activeChannel, 'email');
});

test('feature gate: a disabled channel is refused by the service', async () => {
  configureAuth({ features: { email_otp: false } });
  const { error } = await authService.sendOtp('customer.eg@haatnow.test');
  assert.ok(error);
  assert.equal(error.code, 'channel_disabled');
  configureAuth({ features: { email_otp: true } }); // restore
});

test('metrics: a full login updates counters, rates and avg verify time', async () => {
  authMetrics.reset();
  const email = 'customer.eg@haatnow.test';
  await authService.sendOtp(email);
  await authService.verifyOtp(email, DEMO_OTP);
  const m = authService.getMetrics();
  assert.equal(m.counters.otp_requested, 1);
  assert.equal(m.counters.otp_delivered, 1);
  assert.equal(m.counters.otp_verified, 1);
  assert.equal(m.counters.login_success, 1);
  assert.equal(m.counters.login_failure, 0);
  assert.equal(m.rates.loginSuccessRate, 1);
  assert.equal(m.rates.otpVerificationRate, 1);
  assert.ok(m.averageVerificationMs >= 0);
});

test('metrics: invalid codes count failures + lockout, then rate-limit', async () => {
  authMetrics.reset();
  const email = 'merchant.eg@haatnow.test';
  await authService.sendOtp(email);
  for (let i = 0; i < 5; i++) await authService.verifyOtp(email, '000000');
  const m = authService.getMetrics();
  assert.equal(m.counters.login_failure, 5);
  assert.equal(m.counters.account_locked, 1);
  assert.equal(m.lockedAccounts, 1);
  assert.equal(m.rates.loginFailureRate, 1);
  const locked = await authService.verifyOtp(email, DEMO_OTP); // now locked out
  assert.ok(locked.error);
  assert.ok(authService.getMetrics().counters.rate_limit_triggered >= 1);
});

test('audit: every event folds into metrics (Guardian/monitoring integration)', () => {
  authMetrics.reset();
  for (const e of ['otp_requested', 'otp_delivered', 'login_success', 'resend_requested', 'account_created', 'account_locked'] as const) {
    authAudit.record(e, { channel: 'email', identity: 'cu***@haatnow.test' });
  }
  authAudit.record('otp_verified', { channel: 'email', ms: 42 });
  const m = authMetrics.snapshot();
  assert.equal(m.counters.otp_requested, 1);
  assert.equal(m.counters.login_success, 1);
  assert.equal(m.counters.account_created, 1);
  assert.equal(m.resendRequests, 1);
  assert.equal(m.lockedAccounts, 1);
  assert.equal(m.averageVerificationMs, 42);
});
