// Production email infrastructure — templates, retry/backoff, queue (retry→DLQ),
// metrics, deliverability checklist, and health aggregation. Deterministic (injected
// time + sender); no network. node isolates this file in its own process.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderEmail, ALL_TEMPLATE_IDS } from '../templates';
import { EmailQueue } from '../emailQueue';
import { emailMetrics } from '../emailMetrics';
import { backoffMs, DEFAULT_RETRY } from '../retry';
import { checkDeliverability, DELIVERABILITY_CHECKLIST } from '../deliverability';
import { emailHealth } from '../emailHealth';
import { fallbackProvider } from '../resendProvider';
import type { EmailMessage, EmailSendResult } from '../types';

const okResult = (): EmailSendResult => ({ ok: true, id: 'm_1', ms: 5 });
const failResult = (retryable: boolean): EmailSendResult =>
  ({ ok: false, ms: 5, error: { kind: retryable ? 'provider_error' : 'invalid_input', message: 'x', retryable } });
const msg = (key?: string): EmailMessage =>
  ({ to: 'a@b.com', subject: 's', html: '<p>h</p>', text: 'h', templateId: 'welcome', locale: 'en', idempotencyKey: key });

test('all 12 templates render in ar (RTL) + en (LTR), responsive + dark-mode', () => {
  assert.equal(ALL_TEMPLATE_IDS.length, 12);
  const data = { name: 'A', otp: '123456', orderId: '123', total: '50', currency: 'EGP', ticketId: '9', merchantName: 'M', title: 't', body: 'b', method: 'COD', severity: 'high', summary: 'sum', url: 'https://x.test' };
  for (const id of ALL_TEMPLATE_IDS) {
    const ar = renderEmail(id, 'ar', data);
    const en = renderEmail(id, 'en', data);
    assert.ok(ar.subject.length > 0 && en.subject.length > 0, `${id} subject`);
    assert.match(ar.html, /dir="rtl"/, `${id} rtl`);
    assert.match(en.html, /dir="ltr"/, `${id} ltr`);
    assert.match(ar.html, /prefers-color-scheme: dark/, `${id} dark`);
    assert.match(en.html, /max-width:600px/, `${id} responsive`);
    assert.ok(ar.text.length > 0 && en.text.length > 0, `${id} text`);
  }
});

test('login_otp renders the code; template data is HTML-escaped', () => {
  assert.match(renderEmail('login_otp', 'en', { otp: '246810' }).html, /246810/);
  const injected = renderEmail('welcome', 'en', { name: '<script>x</script>', url: 'https://x.test' });
  assert.ok(!injected.html.includes('<script>'), 'escaped');
});

test('backoff is exponential and capped', () => {
  assert.equal(backoffMs(1), 500);
  assert.equal(backoffMs(2), 1000);
  assert.equal(backoffMs(3), 2000);
  assert.ok(backoffMs(30) <= DEFAULT_RETRY.maxDelayMs);
});

test('queue: success → sent; enqueue is idempotent by key', async () => {
  emailMetrics.reset();
  const q = new EmailQueue(async () => okResult());
  const a = q.enqueue(msg('k1'), 0);
  const b = q.enqueue(msg('k1'), 0);
  assert.equal(a, b);
  await q.processDue(0);
  assert.equal(q.statusOf('k1'), 'sent');
  assert.equal(emailMetrics.snapshot().counters.sent, 1);
});

test('queue: retryable failure defers with backoff, then dead-letters', async () => {
  emailMetrics.reset();
  const q = new EmailQueue(async () => failResult(true));
  q.enqueue(msg('k2'), 0);
  await q.processDue(0);
  assert.equal(q.statusOf('k2'), 'deferred');
  await q.processDue(backoffMs(1));
  await q.processDue(backoffMs(1) + backoffMs(2));
  assert.equal(q.statusOf('k2'), 'dead');
  const m = emailMetrics.snapshot();
  assert.equal(m.counters.dead_lettered, 1);
  assert.ok(m.counters.retries >= 1);
  assert.equal(q.deadLetter().length, 1);
});

test('queue: non-retryable failure dead-letters immediately', async () => {
  emailMetrics.reset();
  const q = new EmailQueue(async () => failResult(false));
  q.enqueue(msg('k3'), 0);
  await q.processDue(0);
  assert.equal(q.statusOf('k3'), 'dead');
  assert.equal(emailMetrics.snapshot().counters.failed, 1);
});

test('deliverability checklist covers all required controls', () => {
  const ids = DELIVERABILITY_CHECKLIST.map(i => i.id);
  for (const req of ['spf', 'dkim', 'dmarc', 'return_path', 'domain_verification', 'dns_records', 'bounce_handling', 'complaint_handling', 'suppression_list']) {
    assert.ok(ids.includes(req), req);
  }
  assert.equal(checkDeliverability({ providerConfigured: false, sendingDomainConfigured: false }).length, 9);
});

test('health aggregates provider + dns + queue + metrics', async () => {
  emailMetrics.reset();
  const h = await emailHealth({ provider: fallbackProvider, env: { providerConfigured: false, sendingDomainConfigured: false }, now: 1000 });
  assert.equal(h.status, 'down'); // fallback provider = not configured
  assert.equal(h.checkedAt, 1000);
  assert.equal(typeof h.failureRate, 'number');
  assert.ok(h.dns.summary.total === 9);
});
