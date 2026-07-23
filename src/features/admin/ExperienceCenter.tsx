// ─────────────────────────────────────────────────────────────────────────────
// Experience Center — the control room for the Experience Platform (Waves 1–18).
//
// Reuse-only. Every number, list and toggle on this screen is read from the LIVE engine via
// `experience-platform.service` — audiences, flags, experiments, rollout gate, render-plan
// metrics and the decision context. No second registry, no duplicated logic, no JSON editors.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useMemo, useState } from 'react';
import {
  Sparkles, Users, ToggleLeft, FlaskConical, Rocket, Radar, Gauge, RefreshCw,
  ShieldCheck, Globe, Smartphone, Monitor, Languages, CheckCircle2, XCircle, Play, Pause, Power, Activity, UserRound,
} from 'lucide-react';
import {
  WorkspaceHeader, AdminCard, MetricCard, StatusBadge, SectionHeader, ActionButton,
  DashboardGrid, EmptyStateBox, StatTile, type StatusKind,
} from '../../components/admin/EnterpriseUI';
import {
  experiencePlatform, experimentReports, previewContext, decideFor, notifyExperienceChange,
  PLATFORM_AUDIENCES, PLATFORM_EXPERIMENTS,
} from '../../services/experience-platform.service';
import type { ExperimentReport } from '../../experience-engine';
import { saveFlagState, saveExperimentStatus, saveRolloutState } from '../../services/experience-state.service';
import { ExperienceEventsPanel } from './ExperienceEventsPanel';
import { PersonalizationPanel } from './PersonalizationPanel';

type Tab = 'overview' | 'audiences' | 'flags' | 'experiments' | 'rollout' | 'context' | 'analytics' | 'events' | 'personalization';
const TABS: Array<{ key: Tab; ar: string; en: string; Icon: typeof Users }> = [
  { key: 'overview', ar: 'نظرة عامة', en: 'Overview', Icon: Radar },
  { key: 'audiences', ar: 'الجماهير', en: 'Audiences', Icon: Users },
  { key: 'flags', ar: 'المزايا', en: 'Feature Flags', Icon: ToggleLeft },
  { key: 'experiments', ar: 'التجارب', en: 'Experiments', Icon: FlaskConical },
  { key: 'rollout', ar: 'الإطلاق', en: 'Rollout & Canary', Icon: Rocket },
  { key: 'context', ar: 'سياق القرار', en: 'Decision Context', Icon: Sparkles },
  { key: 'analytics', ar: 'التحليلات', en: 'Analytics', Icon: Gauge },
  { key: 'events', ar: 'الأحداث', en: 'Events', Icon: Activity },
  { key: 'personalization', ar: 'التخصيص', en: 'Personalization', Icon: UserRound },
];

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

/** A calm, accessible horizontal bar used across the analytics tiles. */
const Bar: React.FC<{ value: number; max: number; accent?: string; label?: string }> = ({ value, max, accent = 'var(--color-primary-fixed, #a3f95b)', label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div role="img" aria-label={label ?? `${value} of ${max}`} style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-surface-container-high)', overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, height: '100%', background: accent, borderRadius: 999, transition: 'width .45s cubic-bezier(.4,0,.2,1)' }} />
    </div>
    <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', minWidth: 44, textAlign: 'end' }}>{value}</span>
  </div>
);

const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderBottom: '1px solid var(--color-outline-variant)', flexWrap: 'wrap' }}>{children}</div>
);

export const ExperienceCenter: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const ar = lang === 'ar';
  const L = (a: string, e: string) => (ar ? a : e);
  const [tab, setTab] = useState<Tab>('overview');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick(t => t + 1), []);

  // Preview identity (Decision Context tab) — lets an operator see the platform as any visitor.
  const [pvLocale, setPvLocale] = useState<'ar' | 'en'>('en');
  const [pvCountry, setPvCountry] = useState('SA');
  const [pvSurface, setPvSurface] = useState<'website' | 'customer' | 'merchant' | 'driver'>('customer');

  const platform = useMemo(() => experiencePlatform(), []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const flags = useMemo(() => platform.engine.flags.list(), [platform, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const audiences = useMemo(() => platform.engine.audiences.all(), [platform, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const experiments = useMemo(() => platform.experiments.all(), [platform, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reports = useMemo<ExperimentReport[]>(() => experimentReports(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const rollout = useMemo(() => platform.engine.rollout.status(), [platform, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const planMetrics = useMemo(() => platform.engine.renderPlanMetrics.snapshot(), [platform, tick]);

  // A live decision for the previewed visitor — the exact same call product screens make.
  const preview = useMemo(
    // eslint-disable-next-line react-hooks/exhaustive-deps
    () => decideFor({ surface: pvSurface, locale: pvLocale, country: pvCountry, experienceId: '/' }),
    [pvSurface, pvLocale, pvCountry, tick],
  );
  const previewBase = useMemo(
    () => previewContext({ surface: pvSurface, locale: pvLocale, country: pvCountry, experienceId: '/' }),
    [pvSurface, pvLocale, pvCountry],
  );

  const flagsOn = flags.filter(f => f.enabled && f.default?.enabled !== false).length;
  const running = experiments.filter(e => e.status === 'running').length;
  const gateKind: StatusKind = rollout.tripped ? 'error' : rollout.enabled ? 'success' : 'inactive';

  // Operator actions persist through the project's existing repository engine (adminCrud),
  // so a toggle survives a reload instead of living only in this session.
  const toggleFlag = (id: string, on: boolean) => {
    const f = platform.engine.flags.get(id);
    if (!f) return;
    platform.engine.flags.register({ ...f, default: { ...f.default, enabled: on } });
    void saveFlagState(id, on);
    notifyExperienceChange();
    refresh();
  };
  const setExperimentStatus = (id: string, status: 'running' | 'paused') => {
    platform.experiments.setStatus(id, status);
    void saveExperimentStatus(id, status);
    notifyExperienceChange();
    refresh();
  };
  const persistRollout = () => {
    const cfg = platform.engine.rollout.config();
    void saveRolloutState({ enabled: !!cfg.enabled, experiences: cfg.experiences ?? [], percentage: cfg.percentage ?? 0 });
  };

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <WorkspaceHeader
        Icon={Sparkles}
        title={L('مركز التجربة', 'Experience Center')}
        subtitle={L('الجماهير · المزايا · التجارب · الإطلاق التدريجي — محرّك التجربة الحيّ', 'Audiences · Flags · Experiments · Rollout — the live Experience Runtime')}
        actions={<ActionButton Icon={RefreshCw} variant="secondary" onClick={refresh}>{L('تحديث', 'Refresh')}</ActionButton>}
      />

      {/* Tabs */}
      <div role="tablist" aria-label={L('أقسام مركز التجربة', 'Experience Center sections')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = tab === t.key;
          return (
            <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 700,
                border: `1px solid ${on ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-outline-variant)'}`,
                background: on ? 'color-mix(in srgb, var(--color-primary-fixed, #a3f95b) 14%, transparent)' : 'var(--color-surface-container)',
                color: on ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-on-surface-variant)', transition: 'all .2s ease' }}>
              <t.Icon size={15} /> {L(t.ar, t.en)}
            </button>
          );
        })}
      </div>

      {/* ── Overview ── */}
      {tab === 'overview' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <DashboardGrid cols={4}>
            <MetricCard label={L('جماهير نشطة', 'Active audiences')} value={audiences.length} Icon={Users} hint={L('قواعد الاستهداف', 'Targeting rules')} />
            <MetricCard label={L('مزايا مفعّلة', 'Flags on')} value={`${flagsOn}/${flags.length}`} Icon={ToggleLeft} hint={L('من إجمالي المزايا', 'of all feature flags')} />
            <MetricCard label={L('تجارب جارية', 'Running experiments')} value={running} Icon={FlaskConical} hint={L('تخصيص لكل زائر', 'Per-visitor allocation')} />
            <MetricCard label={L('حالة البوابة', 'Rollout gate')} value={rollout.tripped ? L('متوقفة', 'Tripped') : rollout.enabled ? L('نشطة', 'Live') : L('مغلقة', 'Off')} Icon={Rocket} accent={rollout.tripped ? '#f87171' : undefined} />
          </DashboardGrid>

          <AdminCard>
            <SectionHeader title={L('حالة وقت التشغيل', 'Runtime status')} action={<StatusBadge kind={gateKind} label={rollout.tripped ? L('قاطع الدائرة مفعّل', 'Circuit breaker tripped') : rollout.enabled ? L('يعمل', 'Operational') : L('غير مفعّل', 'Disabled')} />} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, padding: 14 }}>
              <StatTile label={L('تنفيذ خطط العرض', 'Plan executions')} value={planMetrics.executions} />
              <StatTile label={L('عُقد معدّلة', 'Nodes modified')} value={planMetrics.nodesModified} />
              <StatTile label={L('إخفاقات', 'Failures')} value={planMetrics.failures} accent={planMetrics.failures ? '#f87171' : undefined} />
              <StatTile label={L('متوسط الزمن', 'Avg latency')} value={`${planMetrics.latencyMs.avg.toFixed(2)} ms`} />
            </div>
            <div style={{ padding: '0 14px 14px', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              {L('كل الأرقام تُقرأ مباشرة من المحرّك الحيّ — لا مصدر ثانٍ.', 'Every number is read from the live engine — there is no second source of truth.')}
            </div>
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('التجارب النشطة', 'Active experiences')} />
            {flags.length === 0 ? (
              <EmptyStateBox Icon={ToggleLeft} title={L('لا توجد مزايا', 'No feature flags')} description={L('أضف ميزة لبدء التحكم في المنتج.', 'Register a flag to start controlling the product.')} />
            ) : (
              <div>
                {flags.slice(0, 5).map(f => (
                  <Row key={f.metadata.id}>
                    <StatusBadge kind={f.default?.enabled ? 'success' : 'inactive'} label={f.default?.enabled ? L('مفعّلة', 'On') : L('مغلقة', 'Off')} />
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{f.metadata.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{f.metadata.description}</div>
                    </div>
                    <code style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{f.metadata.id}</code>
                  </Row>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* ── Audiences ── */}
      {tab === 'audiences' && (
        <AdminCard>
          <SectionHeader title={L('الجماهير', 'Audiences')} action={<span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{audiences.length} {L('قاعدة', 'rules')}</span>} />
          {audiences.length === 0 ? <EmptyStateBox Icon={Users} title={L('لا توجد جماهير', 'No audiences')} /> : audiences.map(a => {
            const matched = preview.audiences.includes(a.metadata.id);
            const criteria = a.segments.flatMap(s => s.rules.map(r => r.criteria));
            const dims = criteria.flatMap(c => [
              ...(c.countries ?? []).map(v => `🌍 ${v}`), ...(c.locales ?? []).map(v => `🗣 ${v}`),
              ...(c.devices ?? []).map(v => `📱 ${v}`), ...(c.roles ?? []).map(v => `👤 ${v}`),
              ...(c.channels ?? []).map(v => `📡 ${v}`), ...(c.segments ?? []).map(v => `🏷 ${v}`),
            ]);
            return (
              <Row key={a.metadata.id}>
                <StatusBadge kind={matched ? 'success' : 'inactive'} label={matched ? L('مطابق', 'Matches') : L('غير مطابق', 'No match')} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{a.metadata.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{a.metadata.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {dims.map(d => <span key={d} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{d}</span>)}
                </div>
              </Row>
            );
          })}
          <div style={{ padding: 14, fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
            {L('«مطابق» محسوب للزائر المعروض في تبويب سياق القرار.', 'Match state is evaluated against the visitor previewed in the Decision Context tab.')}
          </div>
        </AdminCard>
      )}

      {/* ── Feature Flags ── */}
      {tab === 'flags' && (
        <AdminCard>
          <SectionHeader title={L('المزايا', 'Feature flags')} action={<span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{flagsOn}/{flags.length} {L('مفعّلة', 'on')}</span>} />
          {flags.map(f => {
            const live = preview.isOn(f.metadata.id);
            const on = !!f.default?.enabled;
            return (
              <Row key={f.metadata.id}>
                <button role="switch" aria-checked={on} aria-label={f.metadata.name} onClick={() => toggleFlag(f.metadata.id, !on)}
                  style={{ width: 46, height: 26, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'background .25s ease',
                    background: on ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-surface-container-high)' }}>
                  <span style={{ position: 'absolute', top: 3, insetInlineStart: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: on ? '#0c2000' : 'var(--color-on-surface-variant)', transition: 'inset-inline-start .25s cubic-bezier(.4,0,.2,1)' }} />
                </button>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{f.metadata.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{f.metadata.description}</div>
                </div>
                {f.rules?.length ? <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{f.rules.length} {L('قاعدة استهداف', 'targeting rule(s)')}</span> : null}
                <StatusBadge kind={live ? 'success' : 'inactive'} label={live ? L('يظهر للزائر', 'On for preview') : L('لا يظهر', 'Off for preview')} />
              </Row>
            );
          })}
        </AdminCard>
      )}

      {/* ── Experiments ── */}
      {tab === 'experiments' && (
        <div style={{ display: 'grid', gap: 16 }}>
          {experiments.length === 0 && <EmptyStateBox Icon={FlaskConical} title={L('لا توجد تجارب', 'No experiments')} />}
          {experiments.map(e => {
            const report = reports.find(r => r.experimentId === e.metadata.id);
            const assigned = preview.variantOf(e.metadata.id);
            const maxExp = Math.max(1, ...(report?.variants ?? []).map(v => v.exposures));
            return (
              <AdminCard key={e.metadata.id}>
                <SectionHeader
                  title={e.metadata.name}
                  action={
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <StatusBadge kind={e.status === 'running' ? 'success' : 'inactive'} label={e.status === 'running' ? L('جارية', 'Running') : L('متوقفة', 'Paused')} />
                      <ActionButton variant="secondary" Icon={e.status === 'running' ? Pause : Play}
                        onClick={() => setExperimentStatus(e.metadata.id, e.status === 'running' ? 'paused' : 'running')}>
                        {e.status === 'running' ? L('إيقاف', 'Pause') : L('تشغيل', 'Resume')}
                      </ActionButton>
                    </div>
                  }
                />
                <div style={{ padding: '0 14px 8px', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                  {e.metadata.hypothesis ?? e.metadata.description}
                  {typeof e.allocation.traffic === 'number' && <> · {L('نسبة المرور', 'Traffic')}: {e.allocation.traffic}%</>}
                </div>
                <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10 }}>
                  {e.variants.map(v => {
                    const s = report?.variants.find(x => x.variant === v.key);
                    const isYou = assigned === v.key;
                    return (
                      <div key={v.key} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, border: `1px solid ${isYou ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-outline-variant)'}`, background: 'var(--color-surface-container-high)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: 13 }}>{v.key}</strong>
                          {v.control && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-container)', color: 'var(--color-on-surface-variant)' }}>{L('ضابطة', 'control')}</span>}
                          {isYou && <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 20%, transparent)', color: 'var(--color-primary-fixed,#a3f95b)' }}>{L('نصيب الزائر المعروض', 'preview visitor')}</span>}
                          <span style={{ marginInlineStart: 'auto', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                            {L('تحويل', 'conv')} {s ? pct(s.conversionRate) : '—'} · CTR {s ? pct(s.ctr) : '—'}
                          </span>
                        </div>
                        <Bar value={s?.exposures ?? 0} max={maxExp} label={`${v.key} exposures`} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: '0 14px 14px' }}>
                  <div style={{ padding: 12, borderRadius: 12, background: 'var(--color-surface-container-high)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    {report?.winner.confident ? <CheckCircle2 size={16} color="#4ade80" style={{ marginTop: 2 }} /> : <ShieldCheck size={16} color="var(--color-on-surface-variant)" style={{ marginTop: 2 }} />}
                    <div style={{ fontSize: 12 }}>
                      <strong style={{ display: 'block', marginBottom: 2 }}>
                        {report?.winner.confident ? L(`الفائز: ${report.winner.variant}`, `Winner: ${report.winner.variant}`) : L('لا يوجد فائز بعد', 'No winner yet')}
                      </strong>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{report?.winner.reason ?? L('لا توجد بيانات', 'no data')}</span>
                      <div style={{ marginTop: 6, color: 'var(--color-on-surface-variant)' }}>
                        {L('هذا مؤشر وقائي وليس اختبار دلالة إحصائية — أكّد النتيجة قبل الإطلاق.', 'This is a guard-rail, not a statistical significance test — confirm before shipping a variant.')}
                      </div>
                    </div>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      {/* ── Rollout & Canary ── */}
      {tab === 'rollout' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <AdminCard>
            <SectionHeader title={L('بوابة الإطلاق', 'Rollout gate')} action={<StatusBadge kind={gateKind} label={rollout.tripped ? L('متوقفة تلقائياً', 'Tripped') : rollout.enabled ? L('نشطة', 'Enabled') : L('مغلقة', 'Disabled')} />} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, padding: 14 }}>
              <StatTile label={L('التجربة الكناريّة', 'Canary experience')} value={(platform.engine.rollout.config().experiences ?? []).join(', ') || '—'} />
              <StatTile label={L('نسبة الطرح', 'Percentage')} value={`${platform.engine.rollout.config().percentage ?? 0}%`} />
              <StatTile label={L('إخفاقات متتالية', 'Consecutive failures')} value={rollout.consecutiveFailures} accent={rollout.consecutiveFailures ? '#fbbf24' : undefined} />
              <StatTile label={L('إجمالي الإخفاقات', 'Total failures')} value={rollout.totalFailures} accent={rollout.totalFailures ? '#f87171' : undefined} />
            </div>
            <div style={{ display: 'flex', gap: 8, padding: '0 14px 14px', flexWrap: 'wrap' }}>
              <ActionButton Icon={Power} variant={rollout.enabled ? 'secondary' : 'primary'}
                onClick={() => { if (rollout.enabled) platform.engine.rollout.disable('admin'); else platform.engine.rollout.enable(); persistRollout(); notifyExperienceChange(); refresh(); }}>
                {rollout.enabled ? L('إيقاف فوري', 'Disable instantly') : L('تفعيل', 'Enable')}
              </ActionButton>
              {rollout.tripped && <ActionButton Icon={RefreshCw} onClick={() => { platform.engine.rollout.reset(); refresh(); }}>{L('إعادة ضبط القاطع', 'Reset breaker')}</ActionButton>}
            </div>
            {rollout.lastDisableReason && (
              <div style={{ margin: '0 14px 14px', padding: 12, borderRadius: 12, background: 'var(--color-surface-container-high)', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
                {L('آخر سبب إيقاف:', 'Last disable reason:')} <strong>{rollout.lastDisableReason}</strong>
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('صحة الكناري', 'Canary health')} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, padding: 14 }}>
              <StatTile label={L('عمليات نُفّذت', 'Operations executed')} value={planMetrics.operationsExecuted} />
              <StatTile label={L('عمليات مُتخطّاة', 'Operations skipped')} value={planMetrics.operationsSkipped} accent={planMetrics.operationsSkipped ? '#fbbf24' : undefined} />
              <StatTile label={L('أقصى زمن', 'Max latency')} value={`${planMetrics.latencyMs.max.toFixed(2)} ms`} />
              <StatTile label={L('حجم الخطة', 'Max plan size')} value={planMetrics.planSize.max} />
            </div>
            {planMetrics.operationsSkipped > 0 && (
              <div style={{ margin: '0 14px 14px', padding: 12, borderRadius: 12, background: 'color-mix(in srgb, #fbbf24 12%, transparent)', fontSize: 12 }}>
                {L('عمليات متخطّاة تعني غالباً أن معرّفات الكتل لا تطابق الخطة.', 'Skipped operations usually mean the plan targets block ids that do not exist — the most common misconfiguration.')}
              </div>
            )}
          </AdminCard>
        </div>
      )}

      {/* ── Decision Context ── */}
      {tab === 'context' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <AdminCard>
            <SectionHeader title={L('معاينة كزائر', 'Preview as a visitor')} />
            <div style={{ display: 'flex', gap: 10, padding: 14, flexWrap: 'wrap' }}>
              {(['customer', 'website', 'merchant', 'driver'] as const).map(s => (
                <button key={s} onClick={() => setPvSurface(s)} aria-pressed={pvSurface === s}
                  style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${pvSurface === s ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)'}`, background: 'var(--color-surface-container-high)', color: pvSurface === s ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)' }}>{s}</button>
              ))}
              <span style={{ width: 1, background: 'var(--color-outline-variant)' }} />
              <button onClick={() => setPvLocale(pvLocale === 'ar' ? 'en' : 'ar')} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                <Languages size={14} /> {pvLocale.toUpperCase()}
              </button>
              {['SA', 'AE', 'EG', 'KW'].map(c => (
                <button key={c} onClick={() => setPvCountry(c)} aria-pressed={pvCountry === c}
                  style={{ padding: '7px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: `1px solid ${pvCountry === c ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)'}`, background: 'var(--color-surface-container-high)', color: pvCountry === c ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)' }}>
                  <Globe size={12} style={{ verticalAlign: -2, marginInlineEnd: 4 }} />{c}
                </button>
              ))}
            </div>
          </AdminCard>

          <DashboardGrid cols={4}>
            <MetricCard label={L('الزائر', 'Visitor')} value={preview.context.identity.kind === 'authenticated' ? L('مسجّل', 'Signed in') : L('مجهول', 'Anonymous')} Icon={Users} hint={preview.context.identity.visitorId} />
            <MetricCard label={L('الجهاز', 'Device')} value={previewBase.device.kind} Icon={previewBase.device.kind === 'desktop' ? Monitor : Smartphone} />
            <MetricCard label={L('اللغة', 'Language')} value={`${previewBase.language.locale} · ${previewBase.language.direction}`} Icon={Languages} />
            <MetricCard label={L('الدولة', 'Country')} value={previewBase.location.country ?? '—'} Icon={Globe} />
          </DashboardGrid>

          <AdminCard>
            <SectionHeader title={L('القرار الفعّال لهذا الزائر', 'Effective decision for this visitor')} />
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{L('الجماهير المطابقة', 'Matched audiences')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {preview.audiences.length === 0 ? <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{L('لا شيء', 'None')}</span> :
                    preview.audiences.map(a => <span key={a} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 16%, transparent)', color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 700 }}>{a}</span>)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{L('المزايا الفعّالة', 'Effective flags')}</div>
                <div style={{ display: 'grid', gap: 4 }}>
                  {Object.keys(preview.flags).map(id => (
                    <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      {preview.flags[id].enabled ? <CheckCircle2 size={14} color="#4ade80" /> : <XCircle size={14} color="var(--color-on-surface-variant)" />}
                      <code style={{ color: 'var(--color-on-surface-variant)' }}>{id}</code>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{L('تخصيص التجارب', 'Experiment allocation')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.keys(preview.experiments).length === 0 ? <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{L('لا شيء', 'None')}</span> :
                    Object.entries(preview.experiments).map(([k, v]) => <span key={k} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, background: 'var(--color-surface-container-high)' }}><strong>{k}</strong> → {v}</span>)}
                </div>
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* ── Personalization (Wave 20) ── */}
      {tab === 'personalization' && <PersonalizationPanel lang={lang} />}

      {/* ── Events (Wave 19) ── */}
      {tab === 'events' && <ExperienceEventsPanel lang={lang} />}

      {/* ── Analytics ── */}
      {tab === 'analytics' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <AdminCard>
            <SectionHeader title={L('حجم الجماهير (على الزائر المعروض)', 'Audience reach (evaluated for the previewed visitor)')} />
            <div style={{ padding: 14, display: 'grid', gap: 10 }}>
              {PLATFORM_AUDIENCES.map(a => {
                const on = preview.audiences.includes(a.metadata.id);
                return (
                  <div key={a.metadata.id} style={{ display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{a.metadata.name}</span>
                      <span style={{ color: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)' }}>{on ? L('مطابق', 'match') : L('غير مطابق', 'no match')}</span>
                    </div>
                    <Bar value={on ? 1 : 0} max={1} accent={on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)'} label={a.metadata.name} />
                  </div>
                );
              })}
            </div>
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('استخدام التجارب', 'Experiment usage')} />
            <div style={{ padding: 14, display: 'grid', gap: 14 }}>
              {reports.every(r => r.totals.exposures === 0) ? (
                <EmptyStateBox Icon={FlaskConical} title={L('لا توجد بيانات تعرّض بعد', 'No exposure data yet')}
                  description={L('تُسجَّل البيانات عند زيارة الشاشات التي تستخدم التجارب.', 'Data appears as visitors reach the screens that use experiments.')} />
              ) : reports.map(r => {
                const max = Math.max(1, ...r.variants.map(v => v.exposures));
                return (
                  <div key={r.experimentId} style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 700 }}>
                      <span>{PLATFORM_EXPERIMENTS.find(e => e.metadata.id === r.experimentId)?.metadata.name ?? r.experimentId}</span>
                      <span style={{ color: 'var(--color-on-surface-variant)' }}>{r.totals.exposures} {L('تعرّض', 'exposures')}</span>
                    </div>
                    {r.variants.map(v => (
                      <div key={v.variant} style={{ display: 'grid', gap: 3 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                          <span>{v.variant}</span><span>{L('تحويل', 'conv')} {pct(v.conversionRate)}</span>
                        </div>
                        <Bar value={v.exposures} max={max} label={`${r.experimentId} ${v.variant}`} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('إحصاءات القرار', 'Decision statistics')} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 12, padding: 14 }}>
              <StatTile label={L('قواعد الجمهور', 'Audience rules')} value={audiences.length} />
              <StatTile label={L('المزايا', 'Feature flags')} value={flags.length} />
              <StatTile label={L('التجارب', 'Experiments')} value={experiments.length} />
              <StatTile label={L('تنفيذ الخطط', 'Plan executions')} value={planMetrics.executions} />
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
};

export default ExperienceCenter;
