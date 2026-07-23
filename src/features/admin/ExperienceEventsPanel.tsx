// ─────────────────────────────────────────────────────────────────────────────
// Experience Center · Events panel (Wave 19).
//
// Timeline · Live Feed · Filtering · Replay · Analytics — all read from the ONE event store in
// `experience-platform.service`. No second collector, no duplicated aggregation: every number on
// this screen is `store.aggregate(query)` over the same events shown in the timeline.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Radio, Filter, RotateCcw, Download, Trash2, Eye, MousePointerClick, XCircle, Target,
} from 'lucide-react';
import { AdminCard, SectionHeader, ActionButton, StatTile, EmptyStateBox, StatusBadge } from '../../components/admin/EnterpriseUI';
import { experienceEvents } from '../../services/experience-platform.service';
import { TELEMETRY_TYPES, type EventQuery, type ExperienceTelemetryEvent, type ExperienceTelemetryType } from '../../experience-engine';

const pct = (n: number): string => `${(n * 100).toFixed(1)}%`;

const TYPE_TONE: Record<string, string> = {
  'decision.evaluated': '#a3f95b',
  'audience.matched': '#38bdf8',
  'flag.evaluated': '#fbbf24',
  'experiment.assigned': '#c084fc',
  'rollout.decision': '#f472b6',
  'experience.rendered': '#4ade80',
  'experience.clicked': '#60a5fa',
  'experience.dismissed': '#f87171',
  'experience.converted': '#34d399',
};

const Bar: React.FC<{ value: number; max: number; accent?: string; label: string }> = ({ value, max, accent = 'var(--color-primary-fixed,#a3f95b)', label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div role="img" aria-label={`${label}: ${value}`} style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-surface-container-high)', overflow: 'hidden' }}>
      <div style={{ width: `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`, height: '100%', background: accent, borderRadius: 999, transition: 'width .45s cubic-bezier(.4,0,.2,1)' }} />
    </div>
    <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)', minWidth: 40, textAlign: 'end' }}>{value}</span>
  </div>
);

export const ExperienceEventsPanel: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const store = useMemo(() => experienceEvents(), []);

  const [tick, setTick] = useState(0);
  const [live, setLive] = useState(true);
  const [types, setTypes] = useState<ExperienceTelemetryType[]>([]);
  const [surface, setSurface] = useState('');
  const [search, setSearch] = useState('');
  const [replayed, setReplayed] = useState<number | null>(null);

  // PART 6 · live feed — subscribe to the store, not a poll loop.
  useEffect(() => {
    if (!live) return;
    const off = store.subscribe(() => setTick(t => t + 1));
    return off;
  }, [store, live]);

  const query: EventQuery = useMemo(() => ({
    types: types.length ? types : undefined,
    surface: surface || undefined,
    search: search || undefined,
  }), [types, surface, search]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => store.query(query).slice(-120).reverse(), [store, query, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const agg = useMemo(() => store.aggregate(query), [store, query, tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const retention = useMemo(() => store.retention(), [store, tick]);

  const toggleType = (t: ExperienceTelemetryType) =>
    setTypes(cur => (cur.includes(t) ? cur.filter(x => x !== t) : [...cur, t]));

  const doReplay = useCallback(() => {
    let seen = 0;
    const n = store.replay(query, () => { seen++; });
    setReplayed(n === seen ? n : seen);
  }, [store, query]);

  const doExport = useCallback(() => {
    try {
      const blob = new Blob([store.export(query)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'experience-events.json'; a.click();
      URL.revokeObjectURL(url);
    } catch { /* download unavailable — export is best-effort */ }
  }, [store, query]);

  const surfaces = useMemo(() => {
    const set = new Set<string>();
    store.all().forEach(e => { if (e.context.surface) set.add(e.context.surface); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return [...set];
  }, [store, tick]);

  const maxExpViews = Math.max(1, ...agg.byExperience.map(x => x.views));
  const maxFlag = Math.max(1, ...agg.flags.map(x => x.evaluations));
  const maxAud = Math.max(1, ...agg.audiences.map(x => x.views || x.matches));

  return (
    <div style={{ display: 'grid', gap: 16 }} id="experience_events_panel">
      {/* ── PART 5 · headline analytics ── */}
      <AdminCard>
        <SectionHeader
          title={L('تحليلات التجربة', 'Experience analytics')}
          action={<StatusBadge kind={agg.totals.events > 0 ? 'success' : 'inactive'} label={`${agg.totals.events} ${L('حدث', 'events')}`} />}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, padding: 14 }}>
          <StatTile label={L('قرارات', 'Decisions')} value={agg.totals.decisions} />
          <StatTile label={L('مشاهدات', 'Views')} value={agg.totals.views} />
          <StatTile label={L('نقرات', 'Clicks')} value={agg.totals.clicks} />
          <StatTile label={L('تجاهل', 'Dismisses')} value={agg.totals.dismisses} />
          <StatTile label={L('تحويلات', 'Conversions')} value={agg.totals.conversions} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, padding: '0 14px 14px' }}>
          <StatTile label="CTR" value={pct(agg.rates.ctr)} accent="#60a5fa" />
          <StatTile label={L('نسبة التجاهل', 'Dismiss rate')} value={pct(agg.rates.dismissRate)} accent="#f87171" />
          <StatTile label={L('نسبة التحويل', 'Conversion rate')} value={pct(agg.rates.conversionRate)} accent="#34d399" />
          <StatTile label={L('تبنّي الطرح', 'Rollout adoption')} value={pct(agg.rollout.adoptionRate)} accent="#f472b6" />
        </div>
      </AdminCard>

      {/* ── Filters (PART 6) ── */}
      <AdminCard>
        <SectionHeader
          title={L('تصفية', 'Filter')}
          action={
            <div style={{ display: 'flex', gap: 8 }}>
              <ActionButton variant="secondary" Icon={RotateCcw} onClick={doReplay}>{L('إعادة تشغيل', 'Replay')}</ActionButton>
              <ActionButton variant="secondary" Icon={Download} onClick={doExport}>{L('تصدير', 'Export')}</ActionButton>
              <ActionButton variant="secondary" Icon={Trash2} onClick={() => { store.clear(); setTick(t => t + 1); }}>{L('مسح', 'Clear')}</ActionButton>
            </div>
          }
        />
        <div style={{ padding: 14, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {TELEMETRY_TYPES.map(t => {
              const on = types.includes(t);
              return (
                <button key={t} onClick={() => toggleType(t)} aria-pressed={on}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    border: `1px solid ${on ? TYPE_TONE[t] : 'var(--color-outline-variant)'}`,
                    background: on ? `color-mix(in srgb, ${TYPE_TONE[t]} 16%, transparent)` : 'var(--color-surface-container-high)',
                    color: on ? TYPE_TONE[t] : 'var(--color-on-surface-variant)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: TYPE_TONE[t] }} />{t}
                </button>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={14} color="var(--color-on-surface-variant)" />
            <input aria-label={L('بحث', 'Search events')} value={search} onChange={e => setSearch(e.target.value)}
              placeholder={L('بحث في الأحداث…', 'Search events…')}
              style={{ flex: 1, minWidth: 180, background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: '8px 11px', color: 'var(--color-on-surface)', fontSize: 13, outline: 'none' }} />
            <select aria-label={L('السطح', 'Surface')} value={surface} onChange={e => setSurface(e.target.value)}
              style={{ background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)', borderRadius: 10, padding: '8px 11px', color: 'var(--color-on-surface)', fontSize: 13 }}>
              <option value="">{L('كل الأسطح', 'All surfaces')}</option>
              {surfaces.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => setLive(l => !l)} aria-pressed={live}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${live ? '#4ade80' : 'var(--color-outline-variant)'}`,
                background: live ? 'color-mix(in srgb, #4ade80 14%, transparent)' : 'var(--color-surface-container-high)',
                color: live ? '#4ade80' : 'var(--color-on-surface-variant)' }}>
              <Radio size={13} /> {live ? L('مباشر', 'Live') : L('متوقف', 'Paused')}
            </button>
          </div>
          {replayed !== null && (
            <div style={{ padding: 10, borderRadius: 10, background: 'var(--color-surface-container-high)', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              {L('أعيد تشغيل', 'Replayed')} <strong style={{ color: 'var(--color-on-surface)' }}>{replayed}</strong> {L('حدثاً عبر نفس المسار (بدون آثار جانبية).', 'events through the same pipeline (no side effects).')}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
            {L('الاحتفاظ', 'Retention')}: {retention.stored}/{retention.max} · {L('أُسقط', 'dropped')} {retention.dropped}
          </div>
        </div>
      </AdminCard>

      {/* ── PART 6 · timeline / live feed ── */}
      <AdminCard>
        <SectionHeader title={L('الخط الزمني', 'Timeline')} action={<span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{events.length} {L('معروض', 'shown')}</span>} />
        {events.length === 0 ? (
          <EmptyStateBox Icon={Activity} title={L('لا توجد أحداث بعد', 'No events yet')}
            description={L('تظهر الأحداث فور اتخاذ قرار أو عرض تجربة في أي واجهة.', 'Events appear as soon as a decision is made or an experience is shown on any surface.')} />
        ) : (
          <div style={{ maxHeight: 460, overflowY: 'auto' }}>
            {events.map(e => <EventRow key={e.id} e={e} lang={lang} />)}
          </div>
        )}
      </AdminCard>

      {/* ── PART 5 · breakdowns ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 16 }}>
        <AdminCard>
          <SectionHeader title={L('أداء التجارب المعروضة', 'Experience performance')} />
          <div style={{ padding: 14, display: 'grid', gap: 12 }}>
            {agg.byExperience.length === 0 ? <EmptyStateBox Icon={Eye} title={L('لا مشاهدات', 'No views yet')} /> : agg.byExperience.map(x => (
              <div key={x.experienceId} style={{ display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <code style={{ color: 'var(--color-on-surface)' }}>{x.experienceId}</code>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>
                    <MousePointerClick size={11} style={{ verticalAlign: -1 }} /> {pct(x.ctr)} · <XCircle size={11} style={{ verticalAlign: -1 }} /> {x.dismisses} · <Target size={11} style={{ verticalAlign: -1 }} /> {x.conversions}
                  </span>
                </div>
                <Bar value={x.views} max={maxExpViews} label={x.experienceId} accent="#4ade80" />
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <SectionHeader title={L('استخدام المزايا', 'Flag usage')} />
          <div style={{ padding: 14, display: 'grid', gap: 12 }}>
            {agg.flags.length === 0 ? <EmptyStateBox Icon={Activity} title={L('لا تقييمات', 'No evaluations yet')} /> : agg.flags.map(f => (
              <div key={f.flagId} style={{ display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <code>{f.flagId}</code>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{L('مفعّل', 'on')} {pct(f.onRate)}</span>
                </div>
                <Bar value={f.evaluations} max={maxFlag} label={f.flagId} accent="#fbbf24" />
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <SectionHeader title={L('أداء الجماهير', 'Audience performance')} />
          <div style={{ padding: 14, display: 'grid', gap: 12 }}>
            {agg.audiences.length === 0 ? <EmptyStateBox Icon={Activity} title={L('لا مطابقات', 'No matches yet')} /> : agg.audiences.map(a => (
              <div key={a.audienceId} style={{ display: 'grid', gap: 5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <code>{a.audienceId}</code>
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{a.views} {L('مشاهدة', 'views')} · {a.conversions} {L('تحويل', 'conv')}</span>
                </div>
                <Bar value={a.views || a.matches} max={maxAud} label={a.audienceId} accent="#38bdf8" />
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard>
          <SectionHeader title={L('نتائج التجارب', 'Experiment results')} />
          <div style={{ padding: 14, display: 'grid', gap: 14 }}>
            {agg.experiments.length === 0 ? <EmptyStateBox Icon={Activity} title={L('لا تخصيصات', 'No assignments yet')} /> : agg.experiments.map(x => {
              const max = Math.max(1, ...x.variants.map(v => v.assigned));
              return (
                <div key={x.experimentId} style={{ display: 'grid', gap: 8 }}>
                  <code style={{ fontSize: 12 }}>{x.experimentId}</code>
                  {x.variants.map(v => (
                    <div key={v.variant} style={{ display: 'grid', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                        <span>{v.variant}</span>
                        <span>CTR {pct(v.ctr)} · {L('تحويل', 'conv')} {pct(v.conversionRate)}</span>
                      </div>
                      <Bar value={v.assigned} max={max} label={`${x.experimentId} ${v.variant}`} accent="#c084fc" />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </AdminCard>
      </div>

      {/* ── Rollout adoption ── */}
      <AdminCard>
        <SectionHeader title={L('تبنّي الطرح التدريجي', 'Rollout adoption')} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, padding: 14 }}>
          <StatTile label={L('قرارات الطرح', 'Rollout decisions')} value={agg.rollout.evaluated} />
          <StatTile label={L('نُفّذت', 'Executed')} value={agg.rollout.executed} accent="#4ade80" />
          <StatTile label={L('نسبة التبنّي', 'Adoption')} value={pct(agg.rollout.adoptionRate)} />
        </div>
        {agg.rollout.reasons.length > 0 && (
          <div style={{ padding: '0 14px 14px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {agg.rollout.reasons.map(r => (
              <span key={r.reason} style={{ fontSize: 11, padding: '4px 9px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                {r.reason} · <strong style={{ color: 'var(--color-on-surface)' }}>{r.count}</strong>
              </span>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
};

const EventRow: React.FC<{ e: ExperienceTelemetryEvent; lang: 'ar' | 'en' }> = ({ e }) => {
  const tone = TYPE_TONE[e.type] ?? 'var(--color-on-surface-variant)';
  const detail = Object.entries(e.payload ?? {}).slice(0, 3).map(([k, v]) => `${k}=${String(v)}`).join(' · ');
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '9px 14px', borderBottom: '1px solid var(--color-outline-variant)' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: tone, marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: 12, color: tone }}>{e.type}</strong>
          {e.context.surface && <span style={{ fontSize: 10.5, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>{e.context.surface}</span>}
          {e.context.experienceId && <code style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{e.context.experienceId}</code>}
        </div>
        {detail && <div style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 2, overflowWrap: 'anywhere' }}>{detail}</div>}
        <div style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', marginTop: 3, opacity: .8 }}>
          {e.context.visitorId} · {e.context.tenantId} · {e.context.country ?? '—'} · {e.context.locale ?? '—'} · {e.context.device ?? '—'}
          {e.context.audiences.length > 0 && ` · ${e.context.audiences.join(', ')}`}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--color-on-surface-variant)', whiteSpace: 'nowrap' }}>{(e.at || '').slice(11, 19)}</span>
    </div>
  );
};

export default ExperienceEventsPanel;
