import React, { useState } from 'react';
import { Rocket, Check, X, SkipForward, Circle, RotateCcw, Undo2, ShieldCheck, Loader } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { provisioningService, type ProvisionRun, type ProvisionSpec } from '../../services/provisioning.service';
import { PLAN_CATALOG } from '../../services/subscription.service';
import { themePresetsService } from '../../services/themePresets.service';
import { Can, useRbac } from '../../hooks/useRbac';

const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const inp: React.CSSProperties = { width: '100%', height: 36, padding: '0 12px', borderRadius: 10, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 4, display: 'block' };
const StepIcon: React.FC<{ s: string }> = ({ s }) => s === 'ok' ? <Check size={14} color="#4ade80" /> : s === 'skipped' ? <SkipForward size={14} color="#60a5fa" /> : s === 'failed' ? <X size={14} color="#f87171" /> : <Circle size={12} color="var(--color-on-surface-variant)" />;

/** Provisioning Console — drives provisioning.service (orchestrator). Timeline · progress · log · retry ·
 *  rollback · completion verification. Audit lives in operation_events (reused), not here. */
export const ProvisioningConsole: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const { can } = useRbac();
  const presets = themePresetsService.list();
  const [form, setForm] = useState<ProvisionSpec>({ brand_name: '', plan: 'starter', theme_preset_id: presets[0]?.id, vertical: 'food', country_code: 'SA' });
  const [run, setRun] = useState<ProvisionRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [verify, setVerify] = useState<{ ok: boolean; checks: { key: string; ok: boolean }[] } | null>(null);
  const set = (k: keyof ProvisionSpec, v: any) => setForm(f => ({ ...f, [k]: v }));

  const provision = async () => {
    if (!form.brand_name.trim()) return toast.error(L('أدخل اسم العلامة', 'Enter a brand name'));
    setBusy(true); setVerify(null);
    const r = await provisioningService.provision({ ...form }); setRun(r); setBusy(false);
    r.status === 'completed' ? toast.success(L('اكتمل التزويد', 'Provisioning completed')) : toast.error(L('توقف التزويد — راجع السجل', 'Provisioning stopped — see log'));
  };
  const retry = async () => { if (!run) return; setBusy(true); const r = await provisioningService.retry(run.id); setRun(r); setBusy(false); r.status === 'completed' ? toast.success(L('اكتمل بعد الإعادة', 'Completed on retry')) : toast.error(L('ما زال متوقفًا', 'Still stopped')); };
  const rollback = async () => { if (!run) return; setBusy(true); const r = await provisioningService.rollback(run.id); setRun(r || null); setBusy(false); setVerify(null); toast.success(L('تم التراجع — لا مستأجر جزئي', 'Rolled back — no partial tenant')); };
  const doVerify = () => { if (!run) return; setVerify(provisioningService.verify(run.id)); };

  const okCount = run ? run.steps.filter(s => s.status === 'ok' || s.status === 'skipped').length : 0;

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="provisioning_console">
      <WorkspaceHeader Icon={Rocket} title={L('محرّك تزويد المستأجرين', 'Tenant Provisioning Engine')} subtitle={L('منسّق فقط — يعيد استخدام الخدمات القائمة · معاملاتي · قابل للاستئناف · قابل للتراجع', 'Orchestrator only — reuses existing services · transactional · resumable · rollbackable')} />

      <Can perm="platform.tenants.manage" fallback={<div className="p-4 rounded-2xl text-sm" style={surface}>{L('لا تملك صلاحية التزويد.', 'You lack the provisioning permission.')}</div>}>
        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-4">
          {/* Spec form */}
          <div className="rounded-2xl p-4 space-y-3" style={surface}>
            <label className="block"><span style={lbl}>{L('اسم العلامة', 'Brand name')}</span><input id="prov_brand" style={inp} value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="Acme Delivery" /></label>
            <label className="block"><span style={lbl}>{L('الخطة', 'Plan')}</span><select id="prov_plan" style={inp} value={form.plan} onChange={e => set('plan', e.target.value)}>{PLAN_CATALOG.map(p => <option key={p.key} value={p.key}>{L(p.ar, p.en)}</option>)}</select></label>
            <label className="block"><span style={lbl}>{L('قالب السمة', 'Theme preset')}</span><select id="prov_preset" style={inp} value={form.theme_preset_id} onChange={e => set('theme_preset_id', e.target.value)}>{presets.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
            <label className="block"><span style={lbl}>{L('القطاع', 'Vertical')}</span><select id="prov_vertical" style={inp} value={form.vertical} onChange={e => set('vertical', e.target.value)}>{['food', 'market', 'pharmacy', 'flowers', 'express', 'logistics'].map(v => <option key={v} value={v}>{v}</option>)}</select></label>
            <button onClick={provision} disabled={busy} id="prov_start" className="w-full h-11 rounded-xl text-sm font-bold cursor-pointer flex items-center justify-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{busy ? <Loader size={15} /> : <Rocket size={15} />}{busy ? L('جارٍ التزويد…', 'Provisioning…') : L('تزويد مستأجر', 'Provision tenant')}</button>
          </div>

          {/* Timeline + progress + log */}
          <div className="space-y-3">
            {!run ? <div className="p-6 rounded-2xl text-sm text-center" style={{ ...surface, color: 'var(--color-on-surface-variant)' }}>{L('املأ النموذج وابدأ التزويد لعرض المخطط الزمني والتقدّم والسجل.', 'Fill the form and provision to see the timeline, progress and log.')}</div> : (
              <>
                <div className="flex items-center justify-between p-3 rounded-2xl flex-wrap gap-2" style={surface}>
                  <div>
                    <p className="font-bold text-sm">{run.spec.brand_name} · <span style={{ color: run.status === 'completed' ? '#4ade80' : run.status === 'failed' ? '#f87171' : run.status === 'rolled_back' ? '#fbbf24' : 'var(--color-on-surface-variant)' }}>{run.status}</span></p>
                    <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التقدّم', 'Progress')}: {okCount}/{run.steps.length} · {run.slug}{run.tenantId ? ` · ${run.tenantId}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {run.status === 'failed' && <button onClick={retry} id="prov_retry" className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><RotateCcw size={12} />{L('إعادة/استئناف', 'Retry')}</button>}
                    {(run.status === 'completed' || run.status === 'failed') && <button onClick={rollback} id="prov_rollback" className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1" style={{ ...surface, color: '#f87171' }}><Undo2 size={12} />{L('تراجع', 'Rollback')}</button>}
                    {run.status === 'completed' && <button onClick={doVerify} id="prov_verify" className="text-xs font-bold px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center gap-1" style={surface}><ShieldCheck size={12} />{L('تحقّق', 'Verify')}</button>}
                  </div>
                </div>

                {/* Timeline */}
                <div className="rounded-2xl p-3" style={surface} id="prov_timeline">
                  {run.steps.map((s, i) => (
                    <div key={s.key} className="flex items-center gap-3 py-1.5" id={`prov_step_${s.key}`}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}><StepIcon s={s.status} /></span>
                      <span className="text-sm flex-1">{L(s.ar, s.en)}</span>
                      <span className="text-[11px]" style={{ color: s.status === 'failed' ? '#f87171' : 'var(--color-on-surface-variant)' }}>{s.status}{s.error ? ` · ${s.error}` : ''}</span>
                      {i < run.steps.length - 1 && <span className="hidden" />}
                    </div>
                  ))}
                </div>

                {verify && (
                  <div className="rounded-2xl p-3" style={surface} id="prov_verify_result">
                    <p className="font-bold text-sm mb-2 flex items-center gap-1.5"><ShieldCheck size={14} style={{ color: verify.ok ? '#4ade80' : '#f87171' }} />{L('تحقّق الاكتمال', 'Completion verification')}: {verify.ok ? L('مكتمل ✓', 'Complete ✓') : L('ناقص', 'Incomplete')}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {verify.checks.map(c => <span key={c.key} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: c.ok ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)', color: c.ok ? '#4ade80' : '#f87171' }}>{c.ok ? '✓' : '✕'} {c.key}</span>)}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Can>
    </div>
  );
};
