// ─────────────────────────────────────────────────────────────────────────────
// Go-Live Command Center — the single screen you run a launch from.
//
// Everything here is aggregated by goLiveService from services that already own the
// data (commandService, incidentService, supplyHealthService, providers/registry,
// monitoring). This component renders; it does not compute. That matters because the
// Go/No-Go verdict must mean the same thing here as anywhere else it is asked.
//
// Deliberately NOT a replacement for OperationsCommandCenter (the live dispatch map)
// or LaunchGuardian (build/architecture health). It sits above both and answers one
// question: can we launch, and if not, what exactly is stopping us.
// Responsive · RTL/LTR · dark-mode via tokens.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useState } from 'react';
import {
  Rocket, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Activity, Package, Bike,
  Store, ShieldAlert, Plug, Layers, FileWarning, Undo2, CircleDot,
} from 'lucide-react';
import { MetricCard, SectionHeader, EmptyStateBox } from '../../components/admin/EnterpriseUI';
import { useAppConfig } from '../../contexts/AppConfigContext';
import {
  goLiveService, LAUNCH_CHECKLIST, ROLLBACK_CHECKLIST,
  type GoLiveSnapshot, type ChecklistState, type ChecklistItem, type OpsAlert,
} from '../../services/ops/golive.service';
import { SEVERITY, STATUS_LABEL } from '../../services/ops/incident.service';
import { BAND_LABEL, healthBand } from '../../services/ops/supply-health.service';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)' };

const ALERT_COLOR: Record<OpsAlert['level'], string> = { critical: '#ef4444', warning: '#f59e0b', info: '#60a5fa' };

const PROVIDER_COLOR: Record<string, string> = {
  active: '#4ade80', demo: '#eab308', 'not-configured': '#f87171', unavailable: '#f87171',
};

export const GoLiveCenter: React.FC = () => {
  const { lang } = useAppConfig();
  const ar = lang === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);

  const [snap, setSnap] = useState<GoLiveSnapshot | null>(null);
  const [launch, setLaunch] = useState<ChecklistState>({});
  const [rollback, setRollback] = useState<ChecklistState>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'launch' | 'rollback'>('launch');

  const load = useCallback(async () => {
    const [s, l, r] = await Promise.all([
      goLiveService.snapshot(),
      goLiveService.checklistState('launch'),
      goLiveService.checklistState('rollback'),
    ]);
    setSnap(s); setLaunch(l); setRollback(r); setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const toggle = async (list: 'launch' | 'rollback', item: ChecklistItem, next: boolean) => {
    // Optimistic: a checklist must feel instant under pressure. The next poll reconciles.
    const setter = list === 'launch' ? setLaunch : setRollback;
    setter(prev => ({ ...prev, [item.key]: { ...prev[item.key], checked: next } }));
    await goLiveService.setChecklistItem(list, item.key, next);
  };

  if (loading || !snap) {
    return <div className="py-10 text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>{L('جارٍ تجميع حالة المنصّة…', 'Assembling platform state…')}</div>;
  }

  const verdict = goLiveService.verdict(snap, launch);
  const state = tab === 'launch' ? launch : rollback;
  const items = tab === 'launch' ? LAUNCH_CHECKLIST : ROLLBACK_CHECKLIST;

  return (
    <div className="space-y-4" id="golive_center" dir={ar ? 'rtl' : 'ltr'}>
      <SectionHeader
        title={L('غرفة الإطلاق', 'Go-Live Command Center')}
        action={
          <button onClick={load} id="golive_refresh" className="h-9 px-3 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer" style={card}>
            <RefreshCw size={14} />{L('تحديث', 'Refresh')}
          </button>
        }
      />

      {/* ── VERDICT ── the one thing this screen exists to answer ── */}
      <div className="rounded-2xl p-5" id="golive_verdict"
        style={{ ...card, borderInlineStart: `4px solid ${verdict.go ? '#4ade80' : '#ef4444'}` }}>
        <div className="flex items-center gap-3 flex-wrap">
          {verdict.go ? <CheckCircle2 size={26} color="#4ade80" /> : <XCircle size={26} color="#ef4444" />}
          <div className="flex-1 min-w-[200px]">
            <p className="font-extrabold text-xl" style={{ color: verdict.go ? '#4ade80' : '#ef4444' }}>
              {verdict.go ? L('جاهز للإطلاق', 'GO') : L('غير جاهز للإطلاق', 'NO-GO')}
            </p>
            <p className="text-[12.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
              {L(
                `${verdict.completed} من ${verdict.totalBlocking} بنداً إلزامياً مكتمل · ${snap.alerts.filter(a => a.level === 'critical').length} تنبيه حرج`,
                `${verdict.completed} of ${verdict.totalBlocking} blocking items complete · ${snap.alerts.filter(a => a.level === 'critical').length} critical alert(s)`,
              )}
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
            {snap.mode === 'sandbox' ? L('وضع تجريبي', 'SANDBOX BUILD') : L('خلفية حيّة', 'LIVE BACKEND')}
            {snap.build?.short ? ` · ${snap.build.short}` : ''}
          </span>
        </div>
        {!verdict.go && verdict.blockers.length > 0 && (
          <ul className="mt-3 space-y-1" id="golive_blockers">
            {(ar ? verdict.blockersAr : verdict.blockers).slice(0, 8).map((b, i) => (
              <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: 'var(--color-on-surface)' }}>
                <CircleDot size={12} className="mt-1 shrink-0" color="#ef4444" />{b}
              </li>
            ))}
            {verdict.blockers.length > 8 && (
              <li className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                {L(`و${verdict.blockers.length - 8} بنداً آخر`, `and ${verdict.blockers.length - 8} more`)}
              </li>
            )}
          </ul>
        )}
      </div>

      {/* ── ALERTS ── */}
      {snap.alerts.length > 0 && (
        <div className="rounded-2xl p-4" style={card} id="golive_alerts">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <AlertTriangle size={15} color="#f59e0b" />{L('التنبيهات', 'Alerts')}
          </p>
          <div className="space-y-1.5">
            {snap.alerts.map(a => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-wrap"
                style={{ background: 'var(--color-surface-container-high)', borderInlineStart: `3px solid ${ALERT_COLOR[a.level]}` }}>
                <span className="text-[13px] font-semibold flex-1 min-w-[180px]" style={{ color: 'var(--color-on-surface)' }}>{ar ? a.ar : a.en}</span>
                {(a.action_ar || a.action_en) && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${ALERT_COLOR[a.level]}22`, color: ALERT_COLOR[a.level] }}>
                    {ar ? a.action_ar : a.action_en}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── PLATFORM HEALTH + LIVE STATE ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={L('حالة المنصّة', 'Platform health')}
          value={snap.apiOk === null ? '…' : snap.apiOk ? L('تعمل', 'Up') : L('متوقفة', 'Down')}
          Icon={Activity} accent={snap.apiOk ? '#4ade80' : '#ef4444'}
          hint={snap.apiMs !== null ? `${snap.apiMs}ms` : undefined} />
        <MetricCard label={L('طلبات نشطة', 'Active orders')} value={snap.marketplace.activeOrders} Icon={Package}
          accent="#60a5fa" hint={L(`${snap.marketplace.inTransit} في الطريق`, `${snap.marketplace.inTransit} in transit`)} />
        <MetricCard label={L('مندوبون متاحون', 'Available drivers')} value={snap.marketplace.availableDrivers} Icon={Bike}
          accent={snap.marketplace.availableDrivers === 0 && snap.marketplace.activeOrders > 0 ? '#ef4444' : '#9ed442'}
          hint={L(`${snap.marketplace.onlineDrivers} متصل`, `${snap.marketplace.onlineDrivers} online`)} />
        <MetricCard label={L('تجار سليمون', 'Healthy merchants')} value={snap.merchants.healthy} Icon={Store}
          accent={snap.merchants.atRisk > 0 ? '#f59e0b' : '#9ed442'}
          hint={snap.merchants.atRisk > 0 ? L(`${snap.merchants.atRisk} في خطر`, `${snap.merchants.atRisk} at risk`) : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── INCIDENTS ── */}
        <div className="rounded-2xl p-4" style={card} id="golive_incidents">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <ShieldAlert size={15} color={snap.incidents.sev1 ? '#ef4444' : 'var(--color-on-surface-variant)'} />
            {L('الحوادث المفتوحة', 'Open incidents')}
            <span className="text-[11px] font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
              {snap.incidents.open} · {L(`${snap.incidents.unassigned} بدون مسؤول`, `${snap.incidents.unassigned} unassigned`)}
            </span>
          </p>
          {snap.incidents.list.length === 0 ? (
            <EmptyStateBox Icon={CheckCircle2} title={L('لا حوادث مفتوحة', 'No open incidents')} />
          ) : (
            <div className="space-y-1.5">
              {snap.incidents.list.map(i => (
                <div key={i.id} className="flex items-center gap-2 rounded-xl px-3 py-2 flex-wrap" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                    style={{ background: `${SEVERITY[i.severity].color}22`, color: SEVERITY[i.severity].color }}>
                    {ar ? SEVERITY[i.severity].ar : SEVERITY[i.severity].en.split(' · ')[0]}
                  </span>
                  <span className="text-[12.5px] font-semibold flex-1 min-w-[140px]" style={{ color: 'var(--color-on-surface)' }}>{i.title}</span>
                  <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {ar ? STATUS_LABEL[i.status].ar : STATUS_LABEL[i.status].en}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── QUEUES ── */}
        <div className="rounded-2xl p-4" style={card} id="golive_queues">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <Layers size={15} />{L('حالة الطوابير', 'Queue status')}
          </p>
          <div className="space-y-1.5">
            {snap.queues.map(q => {
              const over = q.depth >= q.threshold;
              return (
                <div key={q.key} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-[12.5px] flex-1" style={{ color: 'var(--color-on-surface)' }}>{ar ? q.ar : q.en}</span>
                  <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {L(`حد ${q.threshold}`, `limit ${q.threshold}`)}
                  </span>
                  <span className="text-[15px] font-extrabold tabular-nums" style={{ color: over ? '#ef4444' : 'var(--color-on-surface)' }}>{q.depth}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PROVIDERS ── */}
        <div className="rounded-2xl p-4" style={card} id="golive_providers">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <Plug size={15} />{L('حالة المزوّدين', 'Provider status')}
          </p>
          <div className="space-y-1.5">
            {snap.providers.map(p => (
              <div key={p.capability} className="flex items-center gap-2.5 rounded-xl px-3 py-2 flex-wrap" style={{ background: 'var(--color-surface-container-high)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PROVIDER_COLOR[p.status] ?? '#64748b' }} />
                <span className="text-[12.5px] font-semibold capitalize" style={{ color: 'var(--color-on-surface)' }}>{p.capability}</span>
                <span className="text-[11px] font-mono" style={{ color: 'var(--color-on-surface-variant)' }}>{p.provider}</span>
                <span className="text-[10.5px] ms-auto text-end" style={{ color: 'var(--color-on-surface-variant)' }}>{p.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── DOCUMENT EXPIRY ── */}
        <div className="rounded-2xl p-4" style={card} id="golive_documents">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <FileWarning size={15} color={snap.documents.expired ? '#ef4444' : 'var(--color-on-surface-variant)'} />
            {L('الوثائق', 'Documents')}
            <span className="text-[11px] font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>
              {L(`${snap.documents.expired} منتهية · ${snap.documents.expiring} تنتهي قريباً`, `${snap.documents.expired} expired · ${snap.documents.expiring} expiring`)}
            </span>
          </p>
          {snap.documents.list.length === 0 ? (
            <EmptyStateBox Icon={CheckCircle2} title={L('كل الوثائق سارية', 'All documents valid')}
              description={L('لا شيء ينتهي خلال ٣٠ يوماً.', 'Nothing lapses within 30 days.')} />
          ) : (
            <div className="space-y-1.5">
              {snap.documents.list.map(d => (
                <div key={d.document_id} className="flex items-center gap-2 rounded-xl px-3 py-2 flex-wrap" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                    style={{ background: d.status === 'expired' ? '#ef444422' : '#f59e0b22', color: d.status === 'expired' ? '#ef4444' : '#f59e0b' }}>
                    {d.status === 'expired' ? L('منتهية', 'Expired') : L(`${d.days_remaining} يوم`, `${d.days_remaining}d`)}
                  </span>
                  <span className="text-[12.5px] font-semibold flex-1 min-w-[120px]" style={{ color: 'var(--color-on-surface)' }}>{d.entity_name ?? d.entity_id}</span>
                  <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>{d.doc_type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── MERCHANTS AT RISK ── */}
      {snap.merchants.worst.length > 0 && (
        <div className="rounded-2xl p-4" style={card} id="golive_merchants_at_risk">
          <p className="font-bold text-sm mb-2.5 flex items-center gap-2" style={{ color: 'var(--color-on-surface)' }}>
            <Store size={15} color="#f87171" />{L('تجار في خطر تشغيلي', 'Merchants at operational risk')}
          </p>
          <div className="space-y-1.5">
            {snap.merchants.worst.map(m => {
              const band = healthBand(m.health_score);
              return (
                <div key={`${m.merchant_id}-${m.branch_id ?? 'all'}`} className="flex items-center gap-3 rounded-xl px-3 py-2 flex-wrap" style={{ background: 'var(--color-surface-container-high)' }}>
                  <span className="text-[12.5px] font-semibold flex-1 min-w-[130px]" style={{ color: 'var(--color-on-surface)' }}>{m.business_name ?? m.merchant_id}</span>
                  <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {L(`قبول ${m.acceptance_rate ?? '—'}%`, `accept ${m.acceptance_rate ?? '—'}%`)}
                  </span>
                  <span className="text-[10.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>
                    {m.avg_prep_minutes !== null && m.declared_prep_minutes !== null
                      ? L(`تحضير ${m.avg_prep_minutes}د مقابل ${m.declared_prep_minutes}د معلنة`, `prep ${m.avg_prep_minutes}m vs ${m.declared_prep_minutes}m declared`)
                      : L('لا بيانات تحضير', 'no prep data')}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full"
                    style={{ background: `${BAND_LABEL[band].color}22`, color: BAND_LABEL[band].color }}>
                    {m.health_score !== null ? Math.round(m.health_score) : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CHECKLISTS ── */}
      <div className="rounded-2xl p-4" style={card} id="golive_checklists">
        <div className="flex gap-2 mb-3">
          <button onClick={() => setTab('launch')} aria-pressed={tab === 'launch'} id="golive_tab_launch"
            className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer"
            style={{ background: tab === 'launch' ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-surface-container-high)', color: tab === 'launch' ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant)' }}>
            <Rocket size={14} />{L('قائمة الإطلاق', 'Launch checklist')}
          </button>
          <button onClick={() => setTab('rollback')} aria-pressed={tab === 'rollback'} id="golive_tab_rollback"
            className="h-9 px-3.5 rounded-xl flex items-center gap-1.5 text-sm font-bold cursor-pointer"
            style={{ background: tab === 'rollback' ? '#ef4444' : 'var(--color-surface-container-high)', color: tab === 'rollback' ? '#fff' : 'var(--color-on-surface-variant)' }}>
            <Undo2 size={14} />{L('قائمة التراجع', 'Rollback checklist')}
          </button>
        </div>

        {tab === 'rollback' && (
          <p className="text-[12px] mb-3 rounded-xl px-3 py-2" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
            {L(
              'نفّذ هذه الخطوات بالترتيب. لا تلغِ طلباً مدفوعاً أبداً — اترك الطلبات الجارية تكتمل.',
              'Work these in order. Never cancel a paid order — let in-flight orders finish.',
            )}
          </p>
        )}

        <div className="space-y-1">
          {items.map(item => {
            const on = !!state[item.key]?.checked;
            return (
              <label key={item.key} htmlFor={`chk_${tab}_${item.key}`}
                className="flex items-start gap-3 rounded-xl px-3 py-2 cursor-pointer"
                style={{ background: on ? 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 8%, transparent)' : 'transparent' }}>
                <input
                  id={`chk_${tab}_${item.key}`}
                  type="checkbox"
                  checked={on}
                  onChange={e => toggle(tab, item, e.target.checked)}
                  className="mt-0.5 shrink-0"
                  style={{ width: 16, height: 16, accentColor: 'var(--color-primary-fixed, #a3f95b)', cursor: 'pointer' }}
                />
                <span className="text-[13px] flex-1" style={{ color: on ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)', textDecoration: on ? 'line-through' : 'none' }}>
                  {ar ? item.ar : item.en}
                </span>
                {item.blocking && (
                  <span className="text-[9.5px] font-extrabold px-1.5 py-0.5 rounded shrink-0"
                    style={{ background: '#ef444422', color: '#ef4444' }}>
                    {L('إلزامي', 'BLOCKING')}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GoLiveCenter;
