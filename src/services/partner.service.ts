// ─────────────────────────────────────────────────────────────────────────────
// HAAT NOW — Partner Ecosystem service (Lead / CRM / Dynamic Document Engine).
//
// Every website partner application becomes a LEAD stored in the shared sandbox
// backend (localStorage today; the same shape maps 1:1 to the future Supabase
// tables listed in DATABASE below). Nothing is email-only. Super Admin manages the
// whole lifecycle. Documents are NOT hardcoded — a configurable Document Rule
// engine drives per-partner-type requirements, with per-application overrides
// (Required / Optional / Hidden / Waived / Pending / Approved / Rejected) and a
// full audit trail on every waiver and status change.
//
// DATABASE (future Supabase tables, mirrored by the localStorage stores here):
//   partners, partner_applications, application_status_history, application_notes,
//   partner_documents, document_templates(rules), document_waivers, partner_visits,
//   partner_assignments, crm_activities, affiliates.
// ─────────────────────────────────────────────────────────────────────────────

export type PartnerType = 'merchant' | 'fleet' | 'driver' | 'affiliate' | 'franchise' | 'enterprise' | 'career';

// Application lifecycle — a strict, auditable state machine.
export type AppStatus =
  | 'submitted' | 'documents_review' | 'assigned' | 'phone_call' | 'field_visit'
  | 'negotiation' | 'contract_pending' | 'approved' | 'onboarding' | 'live' | 'rejected';

export const APP_FLOW: AppStatus[] = [
  'submitted', 'documents_review', 'assigned', 'phone_call', 'field_visit',
  'negotiation', 'contract_pending', 'approved', 'onboarding', 'live',
];
// Allowed transitions: forward one step, jump to reject from any non-terminal state,
// or reopen a rejected lead back into review. Enforced by transition().
export function nextStatuses(s: AppStatus): AppStatus[] {
  if (s === 'live') return [];
  if (s === 'rejected') return ['documents_review'];
  const i = APP_FLOW.indexOf(s);
  const out: AppStatus[] = [];
  if (i >= 0 && i < APP_FLOW.length - 1) out.push(APP_FLOW[i + 1]);
  out.push('rejected');
  return out;
}

export type DocStatus = 'pending' | 'approved' | 'rejected' | 'waived';
export type DocRequirement = 'required' | 'optional' | 'hidden';

// A configurable document requirement (template) — Super Admin editable, per type.
export interface DocumentRule {
  id: string;
  partnerType: PartnerType;
  nameEn: string; nameAr: string;
  descEn?: string; descAr?: string;
  requirement: DocRequirement;          // required | optional | hidden
  accept: string;                       // e.g. 'application/pdf,image/*'
  maxSizeMb: number;
  order: number;
  enabled: boolean;
  countryRestriction?: string | null;   // ISO code or null = all
  businessRestriction?: string | null;  // sub-type slug or null = all
  expires?: boolean;                     // does this document carry an expiry date?
}

// A document instance attached to one application.
export interface PartnerDocument {
  id: string;
  ruleId: string;
  nameEn: string; nameAr: string;
  requirement: DocRequirement;
  status: DocStatus;
  fileName?: string;
  fileDataUrl?: string;                  // sandbox storage (future: Supabase Storage path)
  fileSize?: number;
  uploadedAt?: string;
  expiresAt?: string;
  verifyNotes?: string;
  waiver?: { reason: string; by: string; at: string; approved: boolean };
}

export interface CrmActivity {
  id: string;
  kind: 'note' | 'status' | 'assignment' | 'visit' | 'communication' | 'document' | 'system';
  by: string;
  at: string;
  text: string;
  meta?: Record<string, unknown>;
}

export interface PartnerVisit { id: string; at: string; scheduledFor: string; by: string; outcome?: string; }

export interface PartnerApplication {
  id: string;
  ref: string;                          // human reference e.g. HN-MER-4X7A
  type: PartnerType;
  subType?: string;                     // e.g. 'restaurant', 'motorcycle', 'influencer'
  status: AppStatus;
  priority: 'low' | 'normal' | 'high' | 'vip';
  // Applicant identity
  name: string; phone: string; email?: string;
  city?: string; country: string;
  // Free-form structured payload captured from the type's form (fleet size, capital…)
  fields: Record<string, string>;
  // CRM
  assignedTo?: string;
  tags: string[];
  documents: PartnerDocument[];
  activities: CrmActivity[];
  visits: PartnerVisit[];
  affiliateCode?: string;               // set when type === 'affiliate' and approved
  createdAt: string;
  updatedAt: string;
}

export interface Affiliate {
  code: string;
  applicationId: string;
  name: string;
  link: string;
  clicks: number; downloads: number; orders: number; commission: number;
  createdAt: string;
}

// ── Persistence (sandbox localStorage; mirrors future Supabase tables) ──────────
const APPS_KEY = 'haat_sb_partner_apps';
const RULES_KEY = 'haat_sb_partner_docrules';
const AFF_KEY = 'haat_sb_affiliates';
const REF_KEY = 'haat_ref';                 // active referral code remembered per browser
const AFF_COMMISSION_RATE = 0.05;           // launch affiliate commission: 5% of order total
const RL_KEY = 'haat_sb_partner_ratelimit';

const read = <T,>(k: string, fb: T): T => { try { return JSON.parse(localStorage.getItem(k) || '') as T; } catch { return fb; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };
const now = () => new Date().toISOString();
// Deterministic-ish id without Math.random dependency on crypto availability.
let _seq = 0;
const uid = (p = 'id') => { _seq = (_seq + 1) % 1e6; const t = Date.now().toString(36); const r = ((Date.now() * 131 + _seq * 977) % 1e8).toString(36); return `${p}_${t}${r}`; };
const refCode = (type: PartnerType) => `HN-${type.slice(0, 3).toUpperCase()}-${uid().slice(-4).toUpperCase()}`;

function emit() { try { window.dispatchEvent(new CustomEvent('haat:partners')); } catch { /* ssr */ } }

// ── Default document rules per partner type (the seed for the dynamic engine) ───
function seedRule(partnerType: PartnerType, nameEn: string, nameAr: string, requirement: DocRequirement, order: number, extra: Partial<DocumentRule> = {}): DocumentRule {
  return { id: uid('rule'), partnerType, nameEn, nameAr, requirement, accept: 'application/pdf,image/*', maxSizeMb: 10, order, enabled: true, countryRestriction: null, businessRestriction: null, expires: false, ...extra };
}
function defaultRules(): DocumentRule[] {
  return [
    // Merchant
    seedRule('merchant', 'Commercial Registration', 'السجل التجاري', 'required', 1, { expires: true }),
    seedRule('merchant', 'Tax Card', 'البطاقة الضريبية', 'required', 2),
    seedRule('merchant', 'Owner ID', 'هوية المالك', 'required', 3),
    seedRule('merchant', 'Food Safety / Operating Licence', 'رخصة سلامة الغذاء / التشغيل', 'optional', 4, { expires: true }),
    seedRule('merchant', 'Menu / Product List', 'قائمة المنتجات', 'required', 5),
    seedRule('merchant', 'Bank / IBAN Letter', 'خطاب الحساب البنكي', 'required', 6),
    // Fleet
    seedRule('fleet', 'Company Commercial Registration', 'السجل التجاري للشركة', 'required', 1, { expires: true }),
    seedRule('fleet', 'Tax Card', 'البطاقة الضريبية', 'required', 2),
    seedRule('fleet', 'Transport / Courier Licence', 'رخصة النقل / التوصيل', 'required', 3, { expires: true }),
    seedRule('fleet', 'Fleet List & Vehicle Docs', 'قائمة الأسطول ومستندات المركبات', 'required', 4),
    seedRule('fleet', 'Bank / IBAN Letter', 'خطاب الحساب البنكي', 'required', 5),
    // Driver
    seedRule('driver', 'National ID', 'بطاقة الرقم القومي', 'required', 1, { expires: true }),
    seedRule('driver', 'Driving Licence', 'رخصة القيادة', 'required', 2, { expires: true, businessRestriction: null }),
    seedRule('driver', 'Vehicle Licence', 'رخصة المركبة', 'optional', 3, { expires: true }),
    seedRule('driver', 'Personal Photo', 'صورة شخصية', 'required', 4, { accept: 'image/*' }),
    seedRule('driver', 'Criminal Record (if required)', 'الفيش الجنائي (عند اللزوم)', 'optional', 5),
    // Affiliate
    seedRule('affiliate', 'National ID', 'بطاقة الرقم القومي', 'required', 1),
    seedRule('affiliate', 'Payout / Wallet Details', 'بيانات الاستلام / المحفظة', 'required', 2),
    seedRule('affiliate', 'Portfolio / Channel Link', 'رابط الأعمال / القناة', 'optional', 3),
    // Franchise
    seedRule('franchise', 'National ID / Passport', 'الهوية / جواز السفر', 'required', 1),
    seedRule('franchise', 'Proof of Capital', 'إثبات رأس المال', 'required', 2),
    seedRule('franchise', 'Business Plan', 'خطة العمل', 'required', 3),
    seedRule('franchise', 'Company Registration (if any)', 'السجل التجاري (إن وُجد)', 'optional', 4),
    // Enterprise
    seedRule('enterprise', 'Company Registration', 'السجل التجاري', 'required', 1),
    seedRule('enterprise', 'Authorized Signatory ID', 'هوية المفوّض بالتوقيع', 'required', 2),
    seedRule('enterprise', 'Purchase Order / LOI', 'أمر الشراء / خطاب النوايا', 'optional', 3),
    // Career
    seedRule('career', 'CV / Resume', 'السيرة الذاتية', 'required', 1),
    seedRule('career', 'Certificates', 'الشهادات', 'optional', 2),
    seedRule('career', 'Portfolio', 'معرض الأعمال', 'optional', 3),
  ];
}

function allRules(): DocumentRule[] {
  const stored = read<DocumentRule[] | null>(RULES_KEY, null);
  if (stored && stored.length) return stored;
  const seed = defaultRules();
  write(RULES_KEY, seed);
  return seed;
}

function docsForType(type: PartnerType, subType?: string, country?: string): PartnerDocument[] {
  return allRules()
    .filter(r => r.partnerType === type && r.enabled && r.requirement !== 'hidden')
    .filter(r => !r.countryRestriction || r.countryRestriction === country)
    .filter(r => !r.businessRestriction || r.businessRestriction === subType)
    .sort((a, b) => a.order - b.order)
    .map(r => ({ id: uid('doc'), ruleId: r.id, nameEn: r.nameEn, nameAr: r.nameAr, requirement: r.requirement, status: 'pending' as DocStatus }));
}

function readApps(): PartnerApplication[] { return read<PartnerApplication[]>(APPS_KEY, []); }
function writeApps(a: PartnerApplication[]) { write(APPS_KEY, a); emit(); }
function log(app: PartnerApplication, kind: CrmActivity['kind'], by: string, text: string, meta?: Record<string, unknown>) {
  app.activities.unshift({ id: uid('act'), kind, by, at: now(), text, meta });
  app.updatedAt = now();
}

export const partnerService = {
  APP_FLOW, nextStatuses,

  // ── Anti-spam: rate-limit + duplicate detection ──────────────────────────────
  canSubmit(email: string, phone: string, type: PartnerType): { ok: boolean; reason?: string } {
    const key = (email || phone || '').toLowerCase().trim();
    if (!key) return { ok: true };
    // Duplicate detection first (most specific/actionable), then generic rate-limit.
    const dup = readApps().find(a => a.type === type && ((email && a.email?.toLowerCase() === email.toLowerCase()) || (phone && a.phone === phone)) && a.status !== 'rejected');
    if (dup) return { ok: false, reason: 'duplicate' };
    const rl = read<Record<string, number>>(RL_KEY, {});
    const last = rl[`${key}:${type}`] || 0;
    if (last && Date.now() - last < 60_000) return { ok: false, reason: 'rate_limited' };
    return { ok: true };
  },

  // ── Submit an application → creates a Lead + seeds required documents ─────────
  submit(input: { type: PartnerType; subType?: string; name: string; phone: string; email?: string; city?: string; country?: string; fields?: Record<string, string> }): { ok: boolean; application?: PartnerApplication; reason?: string } {
    const gate = this.canSubmit(input.email || '', input.phone, input.type);
    if (!gate.ok) return { ok: false, reason: gate.reason };
    const country = input.country || 'EG';
    const app: PartnerApplication = {
      id: uid('app'), ref: refCode(input.type), type: input.type, subType: input.subType,
      status: 'submitted', priority: 'normal',
      name: input.name.trim(), phone: input.phone.trim(), email: input.email?.trim(),
      city: input.city?.trim(), country,
      fields: input.fields || {},
      tags: [], documents: docsForType(input.type, input.subType, country),
      activities: [], visits: [],
      createdAt: now(), updatedAt: now(),
    };
    log(app, 'system', 'system', `Application submitted (${input.type}${input.subType ? ` · ${input.subType}` : ''}).`);
    const apps = readApps(); apps.unshift(app); writeApps(apps);
    const rl = read<Record<string, number>>(RL_KEY, {}); rl[`${(input.email || input.phone).toLowerCase()}:${input.type}`] = Date.now(); write(RL_KEY, rl);
    return { ok: true, application: app };
  },

  attachDocument(appId: string, docId: string, file: { name: string; dataUrl: string; size: number }, by = 'applicant'): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const d = app.documents.find(x => x.id === docId); if (!d) return null;
    d.fileName = file.name; d.fileDataUrl = file.dataUrl; d.fileSize = file.size; d.uploadedAt = now(); d.status = 'pending'; d.verifyNotes = undefined;
    log(app, 'document', by, `Uploaded document: ${d.nameEn}.`, { docId });
    writeApps(apps); return app;
  },

  list(filter?: { type?: PartnerType; status?: AppStatus; assignedTo?: string; q?: string }): PartnerApplication[] {
    let a = readApps();
    if (filter?.type) a = a.filter(x => x.type === filter.type);
    if (filter?.status) a = a.filter(x => x.status === filter.status);
    if (filter?.assignedTo) a = a.filter(x => x.assignedTo === filter.assignedTo);
    if (filter?.q) { const q = filter.q.toLowerCase(); a = a.filter(x => [x.name, x.ref, x.phone, x.email, x.city].some(v => (v || '').toLowerCase().includes(q))); }
    return a;
  },
  get(id: string): PartnerApplication | null { return readApps().find(a => a.id === id) || null; },
  counts(): Record<PartnerType, number> {
    const c = { merchant: 0, fleet: 0, driver: 0, affiliate: 0, franchise: 0, enterprise: 0, career: 0 } as Record<PartnerType, number>;
    readApps().forEach(a => { c[a.type]++; }); return c;
  },

  // ── CRM operations ───────────────────────────────────────────────────────────
  transition(appId: string, to: AppStatus, by: string): { ok: boolean; reason?: string; application?: PartnerApplication } {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return { ok: false, reason: 'not_found' };
    if (!nextStatuses(app.status).includes(to)) return { ok: false, reason: 'invalid_transition' };
    if (to === 'approved' && app.type === 'affiliate' && !app.affiliateCode) {
      const code = app.ref.replace(/^HN-/, '').replace(/-/g, ''); app.affiliateCode = code;
      affiliateService.create(app, code);
      log(app, 'system', 'system', `Affiliate code issued: ${code}.`);
    }
    const from = app.status; app.status = to;
    log(app, 'status', by, `Status: ${from} → ${to}.`, { from, to });
    writeApps(apps); return { ok: true, application: app };
  },
  addNote(appId: string, text: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    log(app, 'note', by, text); writeApps(apps); return app;
  },
  logCommunication(appId: string, channel: 'call' | 'sms' | 'email' | 'whatsapp', text: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    log(app, 'communication', by, `[${channel}] ${text}`, { channel }); writeApps(apps); return app;
  },
  assign(appId: string, employee: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    app.assignedTo = employee; log(app, 'assignment', by, `Assigned to ${employee}.`);
    if (app.status === 'documents_review') app.status = 'assigned';
    writeApps(apps); return app;
  },
  scheduleVisit(appId: string, scheduledFor: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    app.visits.unshift({ id: uid('visit'), at: now(), scheduledFor, by });
    log(app, 'visit', by, `Field visit scheduled for ${scheduledFor}.`); writeApps(apps); return app;
  },
  setPriority(appId: string, priority: PartnerApplication['priority'], by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    app.priority = priority; log(app, 'system', by, `Priority set to ${priority}.`); writeApps(apps); return app;
  },
  addTag(appId: string, tag: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const t = tag.trim(); if (t && !app.tags.includes(t)) { app.tags.push(t); log(app, 'system', by, `Tag added: ${t}.`); }
    writeApps(apps); return app;
  },
  removeTag(appId: string, tag: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    app.tags = app.tags.filter(x => x !== tag); app.updatedAt = now(); writeApps(apps); return app;
  },

  // ── Document engine: verify / reject / request re-upload / WAIVE (exception) ──
  setDocumentStatus(appId: string, docId: string, status: DocStatus, by: string, notes?: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const d = app.documents.find(x => x.id === docId); if (!d) return null;
    d.status = status; if (notes !== undefined) d.verifyNotes = notes;
    log(app, 'document', by, `Document "${d.nameEn}" → ${status}${notes ? ` (${notes})` : ''}.`, { docId, status });
    writeApps(apps); return app;
  },
  requestReupload(appId: string, docId: string, by: string, reason: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const d = app.documents.find(x => x.id === docId); if (!d) return null;
    d.status = 'rejected'; d.verifyNotes = reason; d.fileDataUrl = undefined; d.fileName = undefined;
    log(app, 'document', by, `Re-upload requested for "${d.nameEn}": ${reason}.`, { docId }); writeApps(apps); return app;
  },
  /** WAIVER — the special exception (VIP / government / special agreement / manual approval). */
  waiveDocument(appId: string, docId: string, reason: string, by: string, approved = true): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const d = app.documents.find(x => x.id === docId); if (!d) return null;
    d.status = 'waived'; d.waiver = { reason, by, at: now(), approved };
    log(app, 'document', by, `Document "${d.nameEn}" WAIVED — ${reason}.`, { docId, waiver: true });
    writeApps(apps); return app;
  },
  setDocumentExpiry(appId: string, docId: string, expiresAt: string, by: string): PartnerApplication | null {
    const apps = readApps(); const app = apps.find(a => a.id === appId); if (!app) return null;
    const d = app.documents.find(x => x.id === docId); if (!d) return null;
    d.expiresAt = expiresAt; log(app, 'document', by, `Expiry set for "${d.nameEn}": ${expiresAt}.`); writeApps(apps); return app;
  },
  /** Documents are complete when every required doc is approved or waived. */
  documentsComplete(app: PartnerApplication): boolean {
    return app.documents.filter(d => d.requirement === 'required').every(d => d.status === 'approved' || d.status === 'waived');
  },

  // ── Dynamic Document Rule admin (Super Admin) ────────────────────────────────
  rules(type?: PartnerType): DocumentRule[] { const r = allRules(); return type ? r.filter(x => x.partnerType === type).sort((a, b) => a.order - b.order) : r; },
  saveRule(rule: DocumentRule): DocumentRule { const r = allRules(); const i = r.findIndex(x => x.id === rule.id); if (i >= 0) r[i] = rule; else r.push({ ...rule, id: rule.id || uid('rule') }); write(RULES_KEY, r); emit(); return rule; },
  addRule(partnerType: PartnerType, nameEn: string, nameAr: string): DocumentRule { const r = allRules(); const order = Math.max(0, ...r.filter(x => x.partnerType === partnerType).map(x => x.order)) + 1; const rule = seedRule(partnerType, nameEn, nameAr, 'optional', order); r.push(rule); write(RULES_KEY, r); emit(); return rule; },
  deleteRule(id: string): void { write(RULES_KEY, allRules().filter(r => r.id !== id)); emit(); },
  reorderRule(id: string, dir: -1 | 1): void {
    const r = allRules(); const rule = r.find(x => x.id === id); if (!rule) return;
    const peers = r.filter(x => x.partnerType === rule.partnerType).sort((a, b) => a.order - b.order);
    const idx = peers.findIndex(x => x.id === id); const swap = peers[idx + dir]; if (!swap) return;
    const o = rule.order; rule.order = swap.order; swap.order = o; write(RULES_KEY, r); emit();
  },
  duplicateRule(id: string): DocumentRule | null { const r = allRules(); const src = r.find(x => x.id === id); if (!src) return null; const copy = { ...src, id: uid('rule'), nameEn: `${src.nameEn} (copy)`, order: src.order + 1 }; r.push(copy); write(RULES_KEY, r); emit(); return copy; },
};

// ── Affiliate sub-platform ──────────────────────────────────────────────────────
export const affiliateService = {
  origin(): string { try { return window.location.origin; } catch { return 'https://haat-now.vercel.app'; } },
  create(app: PartnerApplication, code: string): Affiliate {
    const list = read<Affiliate[]>(AFF_KEY, []);
    if (list.find(a => a.code === code)) return list.find(a => a.code === code)!;
    const aff: Affiliate = { code, applicationId: app.id, name: app.name, link: `${this.origin()}/app?ref=${code}`, clicks: 0, downloads: 0, orders: 0, commission: 0, createdAt: now() };
    list.unshift(aff); write(AFF_KEY, list); return aff;
  },
  get(code: string): Affiliate | null { return read<Affiliate[]>(AFF_KEY, []).find(a => a.code === code) || null; },
  list(): Affiliate[] { return read<Affiliate[]>(AFF_KEY, []); },
  qrPayload(code: string): string { return `${this.origin()}/app?ref=${code}`; },

  // ── Referral attribution (the missing connection) ────────────────────────────
  // captureRef: on entry, read ?ref=<code>; if it maps to a real affiliate, remember it
  // for this browser and count one click (once). recordConversion: attribute a placed
  // order to the remembered affiliate — increments orders + commission (5% of total).
  captureRef(): void {
    try {
      const code = new URLSearchParams(window.location.search).get('ref');
      if (!code) return;
      if (!this.get(code)) return;                       // ignore unknown/invalid codes
      const already = localStorage.getItem(REF_KEY) === code;
      localStorage.setItem(REF_KEY, code);
      if (!already) { const list = read<Affiliate[]>(AFF_KEY, []); const a = list.find(x => x.code === code); if (a) { a.clicks += 1; write(AFF_KEY, list); emit(); } }
    } catch { /* ignore */ }
  },
  activeRef(): string | null { try { return localStorage.getItem(REF_KEY); } catch { return null; } },
  recordConversion(orderTotal: number): Affiliate | null {
    try {
      const code = localStorage.getItem(REF_KEY); if (!code) return null;
      const list = read<Affiliate[]>(AFF_KEY, []); const a = list.find(x => x.code === code); if (!a) return null;
      a.orders += 1;
      a.commission = +(a.commission + Math.max(0, orderTotal) * AFF_COMMISSION_RATE).toFixed(2);
      write(AFF_KEY, list); emit(); return a;
    } catch { return null; }
  },
};
