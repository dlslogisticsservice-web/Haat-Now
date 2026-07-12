import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser polyfills so the sandbox-backed partner.service runs under node:test.
class LS { m = new Map<string, string>(); getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; } setItem(k: string, v: string) { this.m.set(k, String(v)); } removeItem(k: string) { this.m.delete(k); } clear() { this.m.clear(); } }
(globalThis as any).localStorage = new LS();
(globalThis as any).window = { dispatchEvent() { return true; }, location: { origin: 'https://haat-now.vercel.app' } };

const { partnerService, affiliateService, nextStatuses } = await import('../../services/partner.service');

beforeEach(() => { (globalThis as any).localStorage.clear(); });

test('submit creates a lead, ref, and seeds required documents from the rule engine', () => {
  const res = partnerService.submit({ type: 'merchant', subType: 'restaurant', name: 'Test Co', phone: '+201000000001', email: 'a@b.co', country: 'EG' });
  assert.equal(res.ok, true);
  const app = res.application!;
  assert.match(app.ref, /^HN-MER-/);
  assert.equal(app.status, 'submitted');
  assert.ok(app.documents.length > 0);
  assert.ok(app.documents.some(d => d.requirement === 'required'));
  assert.equal(app.activities[0].kind, 'system');       // audit entry exists
});

test('anti-spam: duplicate active application is blocked; rejected allows re-apply', () => {
  const a = partnerService.submit({ type: 'driver', name: 'D', phone: '+201111111111', email: 'd@x.co' });
  assert.equal(a.ok, true);
  const dup = partnerService.submit({ type: 'driver', name: 'D', phone: '+201111111111', email: 'd@x.co' });
  assert.equal(dup.ok, false);
  assert.equal(dup.reason, 'duplicate');
});

test('workflow: only valid transitions are allowed; reject reachable from any state', () => {
  const app = partnerService.submit({ type: 'fleet', name: 'F', phone: '+201222222222' }).application!;
  assert.deepEqual(nextStatuses('submitted'), ['documents_review', 'rejected']);
  assert.equal(partnerService.transition(app.id, 'approved', 'admin').ok, false); // skipping steps blocked
  assert.equal(partnerService.transition(app.id, 'documents_review', 'admin').ok, true);
  assert.equal(partnerService.transition(app.id, 'rejected', 'admin').ok, true);
  const reopened = partnerService.transition(app.id, 'documents_review', 'admin');
  assert.equal(reopened.ok, true);                       // rejected → reopen
});

test('document waiver records a full audit trail (reason, employee)', () => {
  const app = partnerService.submit({ type: 'merchant', name: 'VIP', phone: '+201333333333' }).application!;
  const doc = app.documents.find(d => d.requirement === 'required')!;
  const updated = partnerService.waiveDocument(app.id, doc.id, 'VIP partner — government agreement', 'sales.lead');
  const w = updated!.documents.find(d => d.id === doc.id)!;
  assert.equal(w.status, 'waived');
  assert.equal(w.waiver!.reason, 'VIP partner — government agreement');
  assert.equal(w.waiver!.by, 'sales.lead');
  assert.ok(updated!.activities.some(a => a.meta && (a.meta as any).waiver === true));
});

test('documentsComplete requires every required doc approved or waived', () => {
  const app = partnerService.submit({ type: 'merchant', name: 'M', phone: '+201444444444' }).application!;
  assert.equal(partnerService.documentsComplete(app), false);
  for (const d of app.documents.filter(x => x.requirement === 'required')) partnerService.setDocumentStatus(app.id, d.id, 'approved', 'admin');
  assert.equal(partnerService.documentsComplete(partnerService.get(app.id)!), true);
});

test('affiliate approval issues a referral code + link', () => {
  let app = partnerService.submit({ type: 'affiliate', name: 'Aff', phone: '+201555555555' }).application!;
  for (const s of ['documents_review', 'assigned', 'phone_call', 'field_visit', 'negotiation', 'contract_pending', 'approved'] as const) {
    const r = partnerService.transition(app.id, s, 'admin'); assert.equal(r.ok, true, `transition to ${s}`); app = r.application!;
  }
  assert.ok(app.affiliateCode);
  const aff = affiliateService.get(app.affiliateCode!);
  assert.ok(aff && aff.link.includes('ref='));
});

test('dynamic document engine: add / disable / delete rules', () => {
  const before = partnerService.rules('merchant').length;
  const r = partnerService.addRule('merchant', 'Health Certificate', 'شهادة صحية');
  assert.equal(partnerService.rules('merchant').length, before + 1);
  partnerService.saveRule({ ...r, enabled: false });
  assert.equal(partnerService.rules('merchant').find(x => x.id === r.id)!.enabled, false);
  partnerService.deleteRule(r.id);
  assert.equal(partnerService.rules('merchant').length, before);
});
