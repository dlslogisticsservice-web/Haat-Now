import React, { useEffect, useMemo, useState } from 'react';
import {
  Store, Truck, Bike, Megaphone, Building2, Landmark, Briefcase, Search as SearchIcon,
  ChevronRight, Check, X, Download, ShieldOff, RefreshCw, Clock, MessageSquare, Phone,
  UserPlus, CalendarClock, Tag as TagIcon, Flag, FileText, Plus, ChevronUp, ChevronDown, Trash2, Copy, Settings2,
} from 'lucide-react';
import { partnerService, affiliateService, type PartnerApplication, type PartnerType, type AppStatus, type DocStatus, type DocumentRule } from '../../services/partner.service';

const TYPE_META: { type: PartnerType; icon: any; ar: string; en: string }[] = [
  { type: 'merchant', icon: Store, ar: 'التجّار', en: 'Merchants' },
  { type: 'fleet', icon: Truck, ar: 'الأساطيل', en: 'Fleet Companies' },
  { type: 'driver', icon: Bike, ar: 'الكباتن', en: 'Drivers' },
  { type: 'affiliate', icon: Megaphone, ar: 'المسوّقون', en: 'Affiliates' },
  { type: 'franchise', icon: Building2, ar: 'الامتياز', en: 'Franchise' },
  { type: 'enterprise', icon: Landmark, ar: 'المؤسسات', en: 'Enterprise' },
  { type: 'career', icon: Briefcase, ar: 'الوظائف', en: 'Careers' },
];
const STATUS_LABEL: Record<AppStatus, { ar: string; en: string }> = {
  submitted: { ar: 'مُقدَّم', en: 'Submitted' }, documents_review: { ar: 'مراجعة المستندات', en: 'Documents Review' },
  assigned: { ar: 'مُعيَّن', en: 'Assigned' }, phone_call: { ar: 'مكالمة', en: 'Phone Call' },
  field_visit: { ar: 'زيارة ميدانية', en: 'Field Visit' }, negotiation: { ar: 'تفاوض', en: 'Negotiation' },
  contract_pending: { ar: 'بانتظار العقد', en: 'Contract Pending' }, approved: { ar: 'معتمد', en: 'Approved' },
  onboarding: { ar: 'انضمام', en: 'Onboarding' }, live: { ar: 'مُفعَّل', en: 'Live' }, rejected: { ar: 'مرفوض', en: 'Rejected' },
};
const DOC_COLOR: Record<DocStatus, string> = { pending: '#a7b0a6', approved: '#4ade80', rejected: '#f87171', waived: '#f5a623' };

const card: React.CSSProperties = { background: 'var(--color-surface-container, #10160f)', border: '1px solid var(--color-outline-variant, #2a3330)', borderRadius: 12 };
const inp: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 9, padding: '7px 10px', color: 'var(--color-on-surface)', fontSize: 13, outline: 'none' };
const ME = 'admin';

export const PartnerManagement: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [view, setView] = useState<'leads' | 'rules'>('leads');
  const [type, setType] = useState<PartnerType>('merchant');
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<AppStatus | 'all'>('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => { const h = () => setTick(t => t + 1); window.addEventListener('haat:partners', h); return () => window.removeEventListener('haat:partners', h); }, []);
  const counts = useMemo(() => partnerService.counts(), [tick]);
  const list = useMemo(() => partnerService.list({ type, q: q || undefined, status: statusFilter === 'all' ? undefined : statusFilter }), [type, q, statusFilter, tick]);
  const open = useMemo(() => (openId ? partnerService.get(openId) : null), [openId, tick]);

  return (
    <div dir={dir} id="partner_management" style={{ color: 'var(--color-on-surface)' }}>
      <div className="flex items-center justify-between flex-wrap gap-2" style={{ marginBottom: 14 }}>
        <h2 style={{ fontSize: 18, fontWeight: 900, display: 'inline-flex', alignItems: 'center', gap: 8 }}><UserPlus size={18} style={{ color: 'var(--color-primary-fixed)' }} />{L('إدارة الشركاء', 'Partner Management')}</h2>
        <div className="inline-flex gap-1" style={{ ...card, padding: 3, borderRadius: 999 }}>
          {(['leads', 'rules'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} id={`pm_view_${v}`} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, background: view === v ? 'var(--color-primary-fixed)' : 'transparent', color: view === v ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>
              {v === 'leads' ? L('الطلبات', 'Applications') : L('محرّك المستندات', 'Document Engine')}
            </button>
          ))}
        </div>
      </div>

      {/* Type tabs with counts */}
      <div className="flex gap-1.5 flex-wrap" style={{ marginBottom: 12 }}>
        {TYPE_META.map(t => (
          <button key={t.type} onClick={() => { setType(t.type); setOpenId(null); }} id={`pm_type_${t.type}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 10, cursor: 'pointer', fontSize: 12.5, fontWeight: 700,
              background: type === t.type ? 'var(--color-primary-fixed)' : 'var(--color-surface-container)', color: type === t.type ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>
            <t.icon size={14} />{L(t.ar, t.en)}<span style={{ opacity: 0.8 }}>· {counts[t.type]}</span>
          </button>
        ))}
      </div>

      {view === 'rules' ? (
        <DocRuleEditor type={type} lang={lang} />
      ) : open ? (
        <ApplicationDetail app={open} lang={lang} onClose={() => setOpenId(null)} />
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-2 flex-wrap" style={{ marginBottom: 10 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, ...inp, padding: '6px 10px' }}>
              <SearchIcon size={14} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={L('بحث…', 'Search…')} id="pm_search" style={{ background: 'none', border: 'none', outline: 'none', color: 'inherit', fontSize: 13, width: 140 }} />
            </span>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)} style={inp} id="pm_status_filter">
              <option value="all">{L('كل الحالات', 'All statuses')}</option>
              {(Object.keys(STATUS_LABEL) as AppStatus[]).map(s => <option key={s} value={s}>{L(STATUS_LABEL[s].ar, STATUS_LABEL[s].en)}</option>)}
            </select>
          </div>
          {/* List */}
          {list.length === 0 ? (
            <div style={{ ...card, padding: 40, textAlign: 'center', color: 'var(--color-on-surface-variant)' }}>
              <FileText size={30} style={{ opacity: 0.5, marginBottom: 8 }} /><p style={{ margin: 0, fontSize: 14 }}>{L('لا توجد طلبات بعد لهذا النوع.', 'No applications yet for this type.')}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {list.map(a => (
                <button key={a.id} onClick={() => setOpenId(a.id)} id={`pm_app_${a.ref}`} style={{ ...card, padding: 14, cursor: 'pointer', textAlign: 'start', display: 'flex', alignItems: 'center', gap: 12, color: 'inherit' }}>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 14.5 }}>{a.name}</b>
                      <code style={{ fontSize: 11, color: 'var(--color-primary-fixed)' }}>{a.ref}</code>
                      {a.priority !== 'normal' && <span style={{ fontSize: 10.5, fontWeight: 800, padding: '1px 7px', borderRadius: 999, background: a.priority === 'vip' ? 'rgba(245,158,11,0.16)' : 'rgba(163,249,91,0.12)', color: a.priority === 'vip' ? '#f5a623' : 'var(--color-primary-fixed)' }}>{a.priority.toUpperCase()}</span>}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-on-surface-variant)', marginTop: 3 }}>{a.subType || '—'} · {a.city || a.country} · {a.phone}{a.assignedTo ? ` · 👤 ${a.assignedTo}` : ''}</span>
                  </span>
                  <span style={{ fontSize: 11.5, fontWeight: 800, padding: '4px 10px', borderRadius: 999, background: a.status === 'live' ? 'rgba(74,222,128,0.16)' : a.status === 'rejected' ? 'rgba(248,113,113,0.14)' : 'var(--color-surface-container-high)', color: a.status === 'live' ? '#4ade80' : a.status === 'rejected' ? '#f87171' : 'var(--color-on-surface-variant)' }}>{L(STATUS_LABEL[a.status].ar, STATUS_LABEL[a.status].en)}</span>
                  <ChevronRight size={16} style={{ color: 'var(--color-on-surface-variant)', transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ── Application detail: workflow · documents+waivers · CRM · activity log ───────
const ApplicationDetail: React.FC<{ app: PartnerApplication; lang: 'ar' | 'en'; onClose: () => void }> = ({ app, lang, onClose }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [note, setNote] = useState('');
  const [comm, setComm] = useState('');
  const [assignee, setAssignee] = useState(app.assignedTo || '');
  const [tag, setTag] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const next = partnerService.nextStatuses(app.status);
  const aff = app.affiliateCode ? affiliateService.get(app.affiliateCode) : null;

  const waive = (docId: string) => { const reason = window.prompt(L('سبب الإعفاء (شريك مميّز / جهة حكومية / اتفاق خاص / اعتماد يدوي):', 'Waiver reason (VIP / government / special agreement / manual approval):')); if (reason) partnerService.waiveDocument(app.id, docId, reason, ME); };
  const reupload = (docId: string) => { const reason = window.prompt(L('سبب طلب إعادة الرفع:', 'Reason for re-upload request:')); if (reason) partnerService.requestReupload(app.id, docId, ME, reason); };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gap: 14 }} className="pm-detail">
      {/* LEFT */}
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ ...card, padding: 16 }}>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-on-surface-variant)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, marginBottom: 8 }}>← {L('عودة للقائمة', 'Back to list')}</button>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 style={{ fontSize: 19, fontWeight: 900, margin: 0 }}>{app.name}</h3>
            <code style={{ fontSize: 12, color: 'var(--color-primary-fixed)' }}>{app.ref}</code>
          </div>
          <p style={{ color: 'var(--color-on-surface-variant)', fontSize: 13, margin: '6px 0 0' }}>{app.subType} · {app.city || app.country} · {app.phone}{app.email ? ` · ${app.email}` : ''}</p>
          {Object.keys(app.fields).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {Object.entries(app.fields).filter(([, v]) => v).map(([k, v]) => <span key={k} style={{ fontSize: 11.5, padding: '3px 9px', borderRadius: 8, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{k}: <b style={{ color: 'var(--color-on-surface)' }}>{v}</b></span>)}
            </div>
          )}
          {aff && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: 'rgba(163,249,91,0.08)', border: '1px solid rgba(163,249,91,0.25)' }}>
              <p style={{ margin: 0, fontSize: 12.5 }}>{L('رمز الإحالة', 'Referral code')}: <b style={{ color: 'var(--color-primary-fixed)' }}>{aff.code}</b> · {L('نقرات', 'Clicks')} {aff.clicks} · {L('طلبات', 'Orders')} {aff.orders} · {L('عمولة', 'Commission')} {aff.commission}</p>
              <code style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', wordBreak: 'break-all' }}>{aff.link}</code>
            </div>
          )}
        </div>

        {/* Workflow */}
        <div style={{ ...card, padding: 16 }}>
          <h4 style={hd}>{L('سير العمل', 'Workflow')}</h4>
          <div className="flex flex-wrap gap-1.5" style={{ marginBottom: 12 }}>
            {partnerService.APP_FLOW.map((s, i) => {
              const done = partnerService.APP_FLOW.indexOf(app.status as any) >= i && app.status !== 'rejected';
              const cur = app.status === s;
              return <span key={s} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, fontWeight: cur ? 800 : 600, background: cur ? 'var(--color-primary-fixed)' : done ? 'rgba(74,222,128,0.14)' : 'var(--color-surface-container-high)', color: cur ? 'var(--color-on-primary-fixed)' : done ? '#4ade80' : 'var(--color-on-surface-variant)' }}>{L(STATUS_LABEL[s].ar, STATUS_LABEL[s].en)}</span>;
            })}
            {app.status === 'rejected' && <span style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, fontWeight: 800, background: 'rgba(248,113,113,0.16)', color: '#f87171' }}>{L('مرفوض', 'Rejected')}</span>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {next.map(s => (
              <button key={s} id={`pm_to_${s}`} onClick={() => partnerService.transition(app.id, s, ME)} style={{ padding: '8px 14px', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 13, border: 'none', background: s === 'rejected' ? 'rgba(248,113,113,0.14)' : 'var(--color-primary-fixed)', color: s === 'rejected' ? '#f87171' : 'var(--color-on-primary-fixed)' }}>
                {s === 'rejected' ? L('رفض', 'Reject') : `→ ${L(STATUS_LABEL[s].ar, STATUS_LABEL[s].en)}`}
              </button>
            ))}
            {next.length === 0 && <span style={{ fontSize: 13, color: '#4ade80', fontWeight: 700 }}>{L('مكتمل — مُفعَّل', 'Complete — Live')}</span>}
          </div>
          {!partnerService.documentsComplete(app) && (app.status === 'contract_pending' || app.status === 'negotiation') &&
            <p style={{ fontSize: 12, color: '#f5a623', margin: '10px 0 0' }}><Flag size={12} style={{ verticalAlign: -1 }} /> {L('مستندات مطلوبة غير مكتملة (اعتمدها أو أعفِها قبل التفعيل).', 'Required documents incomplete (approve or waive before going live).')}</p>}
        </div>

        {/* Documents + waivers */}
        <div style={{ ...card, padding: 16 }}>
          <h4 style={hd}>{L('المستندات', 'Documents')}</h4>
          <div style={{ display: 'grid', gap: 8 }}>
            {app.documents.map(d => (
              <div key={d.id} style={{ border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: 10 }}>
                <div className="flex items-center gap-2 flex-wrap">
                  <FileText size={16} style={{ color: DOC_COLOR[d.status] }} />
                  <b style={{ fontSize: 13.5 }}>{lang === 'ar' ? d.nameAr : d.nameEn}</b>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: d.requirement === 'required' ? '#f5a623' : 'var(--color-on-surface-variant)' }}>{d.requirement === 'required' ? L('مطلوب', 'Required') : L('اختياري', 'Optional')}</span>
                  <span style={{ marginInlineStart: 'auto', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `color-mix(in srgb, ${DOC_COLOR[d.status]} 16%, transparent)`, color: DOC_COLOR[d.status] }}>{d.status}</span>
                </div>
                {d.fileName && <p style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', margin: '6px 0 0' }}>{d.fileName}</p>}
                {d.waiver && <p style={{ fontSize: 11.5, color: '#f5a623', margin: '4px 0 0' }}>{L('إعفاء', 'Waived')}: {d.waiver.reason} — {d.waiver.by}</p>}
                {d.verifyNotes && <p style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', margin: '4px 0 0' }}>{d.verifyNotes}</p>}
                <div className="flex gap-1.5 flex-wrap" style={{ marginTop: 8 }}>
                  {d.fileDataUrl && <a href={d.fileDataUrl} download={d.fileName} style={docBtn}><Download size={12} />{L('تنزيل', 'Download')}</a>}
                  <button onClick={() => partnerService.setDocumentStatus(app.id, d.id, 'approved', ME)} style={{ ...docBtn, color: '#4ade80' }}><Check size={12} />{L('اعتماد', 'Approve')}</button>
                  <button onClick={() => partnerService.setDocumentStatus(app.id, d.id, 'rejected', ME, 'rejected')} style={{ ...docBtn, color: '#f87171' }}><X size={12} />{L('رفض', 'Reject')}</button>
                  <button onClick={() => reupload(d.id)} style={docBtn}><RefreshCw size={12} />{L('إعادة رفع', 'Re-upload')}</button>
                  <button onClick={() => waive(d.id)} style={{ ...docBtn, color: '#f5a623' }}><ShieldOff size={12} />{L('إعفاء', 'Waive')}</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — CRM */}
      <div style={{ display: 'grid', gap: 12, alignContent: 'start' }}>
        <div style={{ ...card, padding: 14 }}>
          <h4 style={hd}>{L('التعيين والأولوية', 'Assignment & priority')}</h4>
          <div className="flex gap-1.5" style={{ marginBottom: 8 }}>
            <input value={assignee} onChange={e => setAssignee(e.target.value)} placeholder={L('موظف', 'Employee')} style={{ ...inp, flex: 1 }} id="pm_assignee" />
            <button onClick={() => assignee && partnerService.assign(app.id, assignee, ME)} style={docBtn}><UserPlus size={12} />{L('تعيين', 'Assign')}</button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {(['low', 'normal', 'high', 'vip'] as const).map(p => <button key={p} onClick={() => partnerService.setPriority(app.id, p, ME)} style={{ ...docBtn, background: app.priority === p ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: app.priority === p ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{p}</button>)}
          </div>
        </div>
        <div style={{ ...card, padding: 14 }}>
          <h4 style={hd}>{L('الوسوم', 'Tags')}</h4>
          <div className="flex gap-1 flex-wrap" style={{ marginBottom: 8 }}>
            {app.tags.map(t => <span key={t} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--color-surface-container-high)', display: 'inline-flex', gap: 4, alignItems: 'center' }}>{t}<X size={10} style={{ cursor: 'pointer' }} onClick={() => partnerService.removeTag(app.id, t)} /></span>)}
          </div>
          <div className="flex gap-1.5">
            <input value={tag} onChange={e => setTag(e.target.value)} placeholder={L('وسم جديد', 'New tag')} style={{ ...inp, flex: 1 }} />
            <button onClick={() => { if (tag.trim()) { partnerService.addTag(app.id, tag, ME); setTag(''); } }} style={docBtn}><TagIcon size={12} />{L('إضافة', 'Add')}</button>
          </div>
        </div>
        <div style={{ ...card, padding: 14 }}>
          <h4 style={hd}>{L('زيارة ميدانية', 'Field visit')}</h4>
          <div className="flex gap-1.5">
            <input value={visitDate} onChange={e => setVisitDate(e.target.value)} placeholder={L('التاريخ/الوقت', 'Date/time')} style={{ ...inp, flex: 1 }} id="pm_visit" />
            <button onClick={() => { if (visitDate) { partnerService.scheduleVisit(app.id, visitDate, ME); setVisitDate(''); } }} style={docBtn}><CalendarClock size={12} />{L('جدولة', 'Schedule')}</button>
          </div>
        </div>
        <div style={{ ...card, padding: 14 }}>
          <h4 style={hd}>{L('تواصل وملاحظات', 'Communication & notes')}</h4>
          <div className="flex gap-1.5" style={{ marginBottom: 6 }}>
            <input value={comm} onChange={e => setComm(e.target.value)} placeholder={L('سجل مكالمة/رسالة', 'Log call/message')} style={{ ...inp, flex: 1 }} id="pm_comm" />
            <button onClick={() => { if (comm.trim()) { partnerService.logCommunication(app.id, 'call', comm, ME); setComm(''); } }} style={docBtn}><Phone size={12} /></button>
          </div>
          <div className="flex gap-1.5">
            <input value={note} onChange={e => setNote(e.target.value)} placeholder={L('ملاحظة داخلية', 'Internal note')} style={{ ...inp, flex: 1 }} id="pm_note" />
            <button onClick={() => { if (note.trim()) { partnerService.addNote(app.id, note, ME); setNote(''); } }} style={docBtn}><MessageSquare size={12} />{L('حفظ', 'Save')}</button>
          </div>
        </div>
        {/* Activity log */}
        <div style={{ ...card, padding: 14 }}>
          <h4 style={hd}><Clock size={13} style={{ verticalAlign: -2 }} /> {L('سجل النشاط', 'Activity log')}</h4>
          <div style={{ display: 'grid', gap: 8, maxHeight: 320, overflowY: 'auto' }}>
            {app.activities.map(act => (
              <div key={act.id} style={{ borderInlineStart: `2px solid var(--color-outline-variant)`, paddingInlineStart: 8 }}>
                <p style={{ margin: 0, fontSize: 12.5 }}>{act.text}</p>
                <p style={{ margin: '2px 0 0', fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{act.by} · {new Date(act.at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .pm-detail { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

// ── Dynamic Document Rule editor (Super Admin) ─────────────────────────────────
const DocRuleEditor: React.FC<{ type: PartnerType; lang: 'ar' | 'en' }> = ({ type, lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [tick, setTick] = useState(0);
  const rules = useMemo(() => partnerService.rules(type), [type, tick]);
  const bump = () => setTick(t => t + 1);
  const patch = (r: DocumentRule, p: Partial<DocumentRule>) => { partnerService.saveRule({ ...r, ...p }); bump(); };
  const addRule = () => { const en = window.prompt(L('اسم المستند (إنجليزي):', 'Document name (English):')); if (!en) return; const ar = window.prompt(L('الاسم بالعربية:', 'Name in Arabic:')) || en; partnerService.addRule(type, en, ar); bump(); };

  return (
    <div style={{ ...card, padding: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h4 style={{ ...hd, margin: 0 }}><Settings2 size={14} style={{ verticalAlign: -2 }} /> {L('متطلبات مستندات', 'Document requirements')} · {type}</h4>
        <button onClick={addRule} id="pm_add_rule" style={{ ...docBtn, background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Plus size={13} />{L('إضافة مستند', 'Add document')}</button>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {rules.map(r => (
          <div key={r.id} style={{ border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: 10 }}>
            <div className="flex items-center gap-2 flex-wrap">
              <input value={r.nameEn} onChange={e => patch(r, { nameEn: e.target.value })} style={{ ...inp, width: 180 }} />
              <input value={r.nameAr} onChange={e => patch(r, { nameAr: e.target.value })} dir="rtl" style={{ ...inp, width: 160 }} />
              <select value={r.requirement} onChange={e => patch(r, { requirement: e.target.value as any })} style={inp}>
                <option value="required">{L('مطلوب', 'Required')}</option>
                <option value="optional">{L('اختياري', 'Optional')}</option>
                <option value="hidden">{L('مخفي', 'Hidden')}</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={r.enabled} onChange={e => patch(r, { enabled: e.target.checked })} />{L('مُفعَّل', 'Enabled')}
              </label>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                <input type="checkbox" checked={!!r.expires} onChange={e => patch(r, { expires: e.target.checked })} />{L('انتهاء', 'Expiry')}
              </label>
              <span style={{ display: 'inline-flex', gap: 4, marginInlineStart: 'auto' }}>
                <button onClick={() => { partnerService.reorderRule(r.id, -1); bump(); }} style={docBtn}><ChevronUp size={12} /></button>
                <button onClick={() => { partnerService.reorderRule(r.id, 1); bump(); }} style={docBtn}><ChevronDown size={12} /></button>
                <button onClick={() => { partnerService.duplicateRule(r.id); bump(); }} style={docBtn}><Copy size={12} /></button>
                <button onClick={() => { partnerService.deleteRule(r.id); bump(); }} style={{ ...docBtn, color: '#f87171' }}><Trash2 size={12} /></button>
              </span>
            </div>
            <div className="flex gap-2 flex-wrap" style={{ marginTop: 6 }}>
              <label style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('الأنواع المقبولة', 'Accept')} <input value={r.accept} onChange={e => patch(r, { accept: e.target.value })} style={{ ...inp, width: 170, padding: '4px 7px' }} /></label>
              <label style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('الحد MB', 'Max MB')} <input type="number" value={r.maxSizeMb} onChange={e => patch(r, { maxSizeMb: Number(e.target.value) })} style={{ ...inp, width: 60, padding: '4px 7px' }} /></label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const hd: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: 'var(--color-on-surface)', margin: '0 0 10px' };
const docBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', textDecoration: 'none' };
