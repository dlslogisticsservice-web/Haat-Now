// ─────────────────────────────────────────────────────────────────────────────
// Incident Center — create, triage, own and close out operational incidents.
//
// This is the UI for the capability the platform genuinely lacked. It is deliberately
// separate from OpsIncidentLog (a read-only view of cancelled ORDERS, which is a
// different thing wearing a similar name) and from CustomerCareCenter (one customer's
// ticket). Reuses EnterpriseUI primitives and incidentService — no new patterns.
// Responsive · RTL/LTR · dark-mode via tokens.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertOctagon, Plus, RefreshCw, Clock, CheckCircle2, ShieldAlert, X, Send, User,
} from 'lucide-react';
import { MetricCard, EmptyStateBox, SectionHeader, ActionButton } from '../../components/admin/EnterpriseUI';
import { useAppConfig } from '../../contexts/AppConfigContext';
import { toast } from '../../components/ui/feedback';
import {
  incidentService, SEVERITY, STATUS_FLOW, STATUS_LABEL,
  type Incident, type IncidentEvent, type IncidentSeverity, type IncidentCategory, type IncidentStatus,
} from '../../services/ops/incident.service';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };
const field: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 10, fontSize: 13,
  background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)',
  border: '1px solid var(--color-outline-variant)', outline: 'none',
};

const CATEGORIES: IncidentCategory[] = ['dispatch', 'payments', 'merchant', 'driver', 'customer', 'platform', 'data', 'third_party', 'other'];

const CATEGORY_LABEL: Record<IncidentCategory, { ar: string; en: string }> = {
  dispatch: { ar: 'الإرسال', en: 'Dispatch' }, payments: { ar: 'المدفوعات', en: 'Payments' },
  merchant: { ar: 'التجار', en: 'Merchant' }, driver: { ar: 'المندوبون', en: 'Driver' },
  customer: { ar: 'العملاء', en: 'Customer' }, platform: { ar: 'المنصة', en: 'Platform' },
  data: { ar: 'البيانات', en: 'Data' }, third_party: { ar: 'طرف ثالث', en: 'Third party' },
  other: { ar: 'أخرى', en: 'Other' },
};

const KIND_LABEL: Record<string, { ar: string; en: string }> = {
  created: { ar: 'أُنشئ', en: 'Created' }, note: { ar: 'ملاحظة', en: 'Note' },
  status_change: { ar: 'تغيّرت الحالة', en: 'Status changed' },
  severity_change: { ar: 'تغيّرت الخطورة', en: 'Severity changed' },
  assignment: { ar: 'إسناد', en: 'Assigned' }, escalation: { ar: 'تصعيد', en: 'Escalated' },
  mitigation: { ar: 'إجراء', en: 'Mitigation' }, root_cause: { ar: 'السبب الجذري', en: 'Root cause' },
  resolution: { ar: 'الحل', en: 'Resolution' },
};

const fmtMins = (m: number | null, ar: boolean): string => {
  if (m === null) return '—';
  if (m < 60) return ar ? `${m} د` : `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return ar ? `${h} س ${r} د` : `${h}h ${r}m`;
};

export const OpsIncidentCenter: React.FC = () => {
  const { lang } = useAppConfig();
  const ar = lang === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);

  const [rows, setRows] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Incident | null>(null);
  const [events, setEvents] = useState<IncidentEvent[]>([]);
  const [composing, setComposing] = useState(false);
  const [note, setNote] = useState('');
  const [rootCause, setRootCause] = useState('');
  const [resolution, setResolution] = useState('');
  const [busy, setBusy] = useState(false);

  // New-incident form
  const [nTitle, setNTitle] = useState('');
  const [nDesc, setNDesc] = useState('');
  const [nSev, setNSev] = useState<IncidentSeverity>('sev3');
  const [nCat, setNCat] = useState<IncidentCategory>('dispatch');

  const load = useCallback(async () => {
    const { data } = await incidentService.list();
    setRows(data); setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const openTimeline = useCallback(async (i: Incident) => {
    setSelected(i);
    setRootCause(i.root_cause ?? ''); setResolution(i.resolution ?? '');
    setEvents(await incidentService.timelineFor(i.id));
  }, []);

  // Keep the open drawer pointed at the freshest row after any reload.
  useEffect(() => {
    if (!selected) return;
    const fresh = rows.find(r => r.id === selected.id);
    if (fresh && fresh.updated_at !== selected.updated_at) setSelected(fresh);
  }, [rows, selected]);

  const counts = useMemo(() => ({
    open: rows.filter(r => r.status !== 'closed' && r.status !== 'resolved').length,
    sev1: rows.filter(r => r.severity === 'sev1' && r.status !== 'closed' && r.status !== 'resolved').length,
    unassigned: rows.filter(r => !r.assigned_to && r.status !== 'closed' && r.status !== 'resolved').length,
    resolved: rows.filter(r => r.status === 'resolved' || r.status === 'closed').length,
  }), [rows]);

  const create = async () => {
    if (!nTitle.trim()) { toast.error(L('العنوان مطلوب', 'Title is required')); return; }
    setBusy(true);
    const { error } = await incidentService.create({ title: nTitle, description: nDesc, severity: nSev, category: nCat });
    setBusy(false);
    if (error) { toast.error(L('تعذّر إنشاء الحادث', 'Could not create the incident')); return; }
    toast.success(L('تم إنشاء الحادث', 'Incident created'));
    setNTitle(''); setNDesc(''); setNSev('sev3'); setNCat('dispatch'); setComposing(false);
    load();
  };

  const changeStatus = async (next: IncidentStatus) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await incidentService.setStatus(selected, next);
    setBusy(false);
    if (error) { toast.error(L('تعذّر تحديث الحالة', 'Could not update status')); return; }
    await load(); setEvents(await incidentService.timelineFor(selected.id));
  };

  const changeSeverity = async (next: IncidentSeverity) => {
    if (!selected) return;
    setBusy(true);
    const { error } = await incidentService.setSeverity(selected, next);
    setBusy(false);
    if (error) { toast.error(L('تعذّر تحديث الخطورة', 'Could not update severity')); return; }
    await load(); setEvents(await incidentService.timelineFor(selected.id));
  };

  const postNote = async () => {
    if (!selected || !note.trim()) return;
    setBusy(true);
    await incidentService.addNote(selected.id, note);
    setBusy(false);
    setNote(''); setEvents(await incidentService.timelineFor(selected.id));
  };

  const closeOut = async () => {
    if (!selected) return;
    if (!rootCause.trim() || !resolution.trim()) {
      toast.error(L('السبب الجذري والحل مطلوبان للإغلاق', 'Root cause and resolution are both required to resolve'));
      return;
    }
    setBusy(true);
    const { error } = await incidentService.resolve(selected, rootCause, resolution);
    setBusy(false);
    if (error) { toast.error(L('تعذّر إغلاق الحادث', 'Could not resolve the incident')); return; }
    toast.success(L('تم حل الحادث', 'Incident resolved'));
    await load(); setEvents(await incidentService.timelineFor(selected.id));
  };

  return (
    <div className="space-y-4" id="ops_incident_center" dir={ar ? 'rtl' : 'ltr'}>
      <SectionHeader
        title={L('مركز الحوادث', 'Incident Center')}
        action={
          <div className="flex gap-2">
            <button onClick={load} id="incidents_refresh" className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}>
              <RefreshCw size={14} />{L('تحديث', 'Refresh')}
            </button>
            <ActionButton Icon={Plus} onClick={() => setComposing(v => !v)}>{L('حادث جديد', 'New incident')}</ActionButton>
          </div>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={L('حوادث مفتوحة', 'Open incidents')} value={counts.open} Icon={AlertOctagon} accent={counts.open ? '#f87171' : undefined} />
        <MetricCard label={L('حرجة (SEV1)', 'Critical (SEV1)')} value={counts.sev1} Icon={ShieldAlert} accent={counts.sev1 ? '#ef4444' : undefined} hint={counts.sev1 ? L('تحتاج تدخلاً فورياً', 'Needs someone now') : undefined} />
        <MetricCard label={L('بدون مسؤول', 'Unassigned')} value={counts.unassigned} Icon={User} accent={counts.unassigned ? '#fb923c' : undefined} />
        <MetricCard label={L('تم حلها', 'Resolved')} value={counts.resolved} Icon={CheckCircle2} accent="#9ed442" />
      </div>

      {/* ── New incident ── */}
      {composing && (
        <div className="rounded-2xl p-4 space-y-3" style={card} id="incident_create_form">
          <p className="font-bold text-sm" style={{ color: 'var(--color-on-surface)' }}>{L('تسجيل حادث جديد', 'Log a new incident')}</p>
          <input id="incident_title" value={nTitle} onChange={e => setNTitle(e.target.value)} style={field}
            placeholder={L('ماذا يحدث؟ مثال: تعذّر إسناد الطلبات في منطقة المعادي', 'What is happening? e.g. Orders not assigning in Maadi zone')} />
          <textarea id="incident_desc" value={nDesc} onChange={e => setNDesc(e.target.value)} rows={3} style={{ ...field, resize: 'vertical' }}
            placeholder={L('تفاصيل: ما تمت ملاحظته، منذ متى، ما مدى التأثير', 'Detail: what was observed, since when, how wide is the impact')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="incident_sev" className="text-[11px] font-bold block mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الخطورة', 'Severity')}</label>
              <select id="incident_sev" value={nSev} onChange={e => setNSev(e.target.value as IncidentSeverity)} style={field}>
                {(Object.keys(SEVERITY) as IncidentSeverity[]).map(k => (
                  <option key={k} value={k}>{ar ? `${SEVERITY[k].ar} — ${SEVERITY[k].hint_ar}` : `${SEVERITY[k].en} — ${SEVERITY[k].hint_en}`}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="incident_cat" className="text-[11px] font-bold block mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التصنيف', 'Category')}</label>
              <select id="incident_cat" value={nCat} onChange={e => setNCat(e.target.value as IncidentCategory)} style={field}>
                {CATEGORIES.map(c => <option key={c} value={c}>{ar ? CATEGORY_LABEL[c].ar : CATEGORY_LABEL[c].en}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <ActionButton onClick={create} loading={busy} Icon={Plus}>{L('إنشاء', 'Create incident')}</ActionButton>
            <button onClick={() => setComposing(false)} className="h-9 px-3 rounded-xl text-sm font-bold cursor-pointer" style={card}>{L('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      <div className="rounded-2xl p-4" style={card}>
        {loading ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--color-on-surface-variant)' }}>…</p>
        ) : rows.length === 0 ? (
          <EmptyStateBox Icon={CheckCircle2} title={L('لا توجد حوادث', 'No incidents')}
            description={L('لم يُسجَّل أي حادث تشغيلي بعد.', 'No operational incident has been logged yet.')} />
        ) : (
          <div className="space-y-2" id="incident_list">
            {rows.map(i => {
              const sev = SEVERITY[i.severity];
              const m = incidentService.metrics(i);
              const done = i.status === 'resolved' || i.status === 'closed';
              return (
                <button key={i.id} onClick={() => openTimeline(i)}
                  className="w-full text-start rounded-xl p-3 cursor-pointer transition"
                  style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', opacity: done ? 0.62 : 1 }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full" style={{ background: `${sev.color}22`, color: sev.color }}>
                      {ar ? sev.ar : sev.en.split(' · ')[0]}
                    </span>
                    <span className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>{i.reference ?? '—'}</span>
                    <span className="font-bold text-sm flex-1 min-w-[160px]" style={{ color: 'var(--color-on-surface)' }}>{i.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>
                      {ar ? STATUS_LABEL[i.status].ar : STATUS_LABEL[i.status].en}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span>{ar ? CATEGORY_LABEL[i.category].ar : CATEGORY_LABEL[i.category].en}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {done ? L(`الحل: ${fmtMins(m.toResolve, ar)}`, `Resolved in ${fmtMins(m.toResolve, ar)}`)
                            : L(`مفتوح منذ ${fmtMins(m.openFor, ar)}`, `Open ${fmtMins(m.openFor, ar)}`)}
                    </span>
                    {!i.assigned_to && !done && <span style={{ color: '#fb923c' }}>{L('بدون مسؤول', 'Unassigned')}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Timeline drawer ── */}
      {selected && (
        <div className="fixed inset-0 z-50 flex" style={{ background: 'rgba(0,0,0,0.55)' }} onClick={() => setSelected(null)}>
          <div
            className="ms-auto h-full w-full max-w-[560px] overflow-y-auto p-5 space-y-4"
            style={{ background: 'var(--color-surface)', borderInlineStart: '1px solid var(--color-outline-variant)' }}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label={selected.title}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>{selected.reference ?? '—'}</p>
                <h3 className="font-extrabold text-lg" style={{ color: 'var(--color-on-surface)' }}>{selected.title}</h3>
                {selected.description && <p className="text-[13px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{selected.description}</p>}
              </div>
              <button onClick={() => setSelected(null)} aria-label={L('إغلاق', 'Close')}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={card}><X size={15} /></button>
            </div>

            {/* Severity */}
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الخطورة', 'Severity')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {(Object.keys(SEVERITY) as IncidentSeverity[]).map(k => {
                  const on = selected.severity === k;
                  return (
                    <button key={k} onClick={() => changeSeverity(k)} disabled={busy} aria-pressed={on}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                      style={{ background: on ? `${SEVERITY[k].color}22` : 'var(--color-surface-container-high)', color: on ? SEVERITY[k].color : 'var(--color-on-surface-variant)', border: `1px solid ${on ? SEVERITY[k].color : 'var(--color-outline-variant)'}` }}>
                      {ar ? SEVERITY[k].ar : SEVERITY[k].en.split(' · ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Status lifecycle */}
            <div>
              <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الحالة', 'Status')}</p>
              <div className="flex gap-1.5 flex-wrap">
                {STATUS_FLOW.map(s => {
                  const on = selected.status === s;
                  return (
                    <button key={s} onClick={() => changeStatus(s)} disabled={busy} aria-pressed={on}
                      className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer"
                      style={{ background: on ? 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 18%, transparent)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)', border: '1px solid var(--color-outline-variant)' }}>
                      {ar ? STATUS_LABEL[s].ar : STATUS_LABEL[s].en}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Close-out */}
            <div className="rounded-xl p-3 space-y-2" style={card}>
              <p className="text-[12px] font-bold" style={{ color: 'var(--color-on-surface)' }}>{L('إغلاق الحادث', 'Close-out')}</p>
              <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                {L('السبب الجذري والحل مطلوبان — حادث يُغلق بدونهما لا يفيد أحداً.', 'Root cause and resolution are both required — an incident closed without them teaches nobody anything.')}
              </p>
              <textarea id="incident_root_cause" value={rootCause} onChange={e => setRootCause(e.target.value)} rows={2} style={{ ...field, resize: 'vertical' }}
                placeholder={L('السبب الجذري', 'Root cause')} />
              <textarea id="incident_resolution" value={resolution} onChange={e => setResolution(e.target.value)} rows={2} style={{ ...field, resize: 'vertical' }}
                placeholder={L('ما الذي تم عمله للحل', 'What was done to resolve it')} />
              <ActionButton onClick={closeOut} loading={busy} Icon={CheckCircle2}>{L('تسجيل الحل', 'Mark resolved')}</ActionButton>
            </div>

            {/* Timeline */}
            <div>
              <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>{L('المسار الزمني', 'Timeline')}</p>
              <div className="space-y-2" id="incident_timeline">
                {events.length === 0 && <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا توجد أحداث بعد.', 'No events yet.')}</p>}
                {events.map(e => (
                  <div key={e.id} className="rounded-lg p-2.5" style={{ background: 'var(--color-surface-container-high)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-extrabold" style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>
                        {ar ? (KIND_LABEL[e.kind]?.ar ?? e.kind) : (KIND_LABEL[e.kind]?.en ?? e.kind)}
                      </span>
                      {e.from_value && e.to_value && (
                        <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>{e.from_value} → {e.to_value}</span>
                      )}
                      <span className="text-[10px] ms-auto" style={{ color: 'var(--color-on-surface-variant)' }}>
                        {e.created_at ? new Date(e.created_at).toLocaleString(ar ? 'ar-EG' : 'en-GB') : ''}
                      </span>
                    </div>
                    {e.body && <p className="text-[12.5px] mt-1" style={{ color: 'var(--color-on-surface)' }}>{e.body}</p>}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input id="incident_note" value={note} onChange={e => setNote(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') postNote(); }}
                  style={field} placeholder={L('أضف تحديثاً…', 'Add an update…')} />
                <button onClick={postNote} disabled={busy || !note.trim()} aria-label={L('إرسال', 'Send')}
                  className="w-10 h-[38px] rounded-xl flex items-center justify-center cursor-pointer shrink-0"
                  style={{ background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)', opacity: note.trim() ? 1 : 0.5 }}>
                  <Send size={15} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpsIncidentCenter;
