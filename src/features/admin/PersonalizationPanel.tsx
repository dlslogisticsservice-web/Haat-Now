// ─────────────────────────────────────────────────────────────────────────────
// Experience Center · Personalization panel (Wave 20).
//
// Visitor Profiles · Segments · Exposure History · Frequency Caps · Personalization Decisions.
// Everything is DERIVED from the existing Experience Event log — there is no personalization
// database and no model. Each row can be traced back to the events that produced it.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useState } from 'react';
import { UserRound, Layers, History, Timer, Sparkles, ShieldAlert, CheckCircle2, XCircle } from 'lucide-react';
import { AdminCard, SectionHeader, StatTile, EmptyStateBox, StatusBadge } from '../../components/admin/EnterpriseUI';
import { experienceEvents, PLATFORM_FLAGS } from '../../services/experience-platform.service';
import {
  deriveVisitorProfile, deriveSegments, engagementScore, personalize,
  checkFrequencyCap, assessFatigue, DEFAULT_FREQUENCY_CAP,
  type ExperienceCandidate, type VisitorProfile,
} from '../../experience-engine';

const pct = (n: number): string => `${(n * 100).toFixed(0)}%`;
const shortTime = (at: string): string => (at ? `${at.slice(0, 10)} ${at.slice(11, 16)}` : '—');

const chip = (tone: string): React.CSSProperties => ({
  fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700,
  background: `color-mix(in srgb, ${tone} 16%, transparent)`, color: tone,
  border: `1px solid color-mix(in srgb, ${tone} 34%, transparent)`,
});

const SEGMENT_TONE: Record<string, string> = {
  'new-visitor': '#38bdf8', 'returning-visitor': '#a3f95b', 'high-engagement': '#4ade80',
  'low-engagement': '#fbbf24', 'frequent-buyer': '#34d399', 'dormant-user': '#f87171',
  'coupon-seeker': '#c084fc', 'restaurant-lover': '#fb923c', 'retail-shopper': '#60a5fa',
  'late-night-user': '#818cf8',
};

export const PersonalizationPanel: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const store = useMemo(() => experienceEvents(), []);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string>('');

  // Wave 20.1 · profiles update as the product is used, so this panel follows the live event
  // stream instead of waiting for the refresh button. Coalesced to one re-render per animation
  // frame — a busy session emits far more events than a dashboard needs to redraw for.
  useEffect(() => {
    let queued = false;
    const off = store.subscribe(() => {
      if (queued) return;
      queued = true;
      const run = () => { queued = false; setTick(t => t + 1); };
      if (typeof requestAnimationFrame === 'function') requestAnimationFrame(run);
      else setTimeout(run, 16);
    });
    return off;
  }, [store]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const events = useMemo(() => store.all(), [store, tick]);
  const now = useMemo(() => { try { return new Date().toISOString(); } catch { return ''; } }, [tick]);

  /** Every visitor observed in the log — the profile list is a projection, not a table. */
  const visitors = useMemo(() => {
    const seen = new Map<string, number>();
    events.forEach(e => seen.set(e.context.visitorId, (seen.get(e.context.visitorId) ?? 0) + 1));
    return [...seen.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);
  }, [events]);

  const visitorId = selected || visitors[0]?.id || '';
  const profile: VisitorProfile | null = useMemo(
    () => (visitorId ? deriveVisitorProfile(events, visitorId) : null),
    [events, visitorId],
  );
  const segments = useMemo(() => (profile ? deriveSegments(profile, now) : []), [profile, now]);

  // Candidates = the platform's own experience flags, so the decision mirrors production.
  const candidates: ExperienceCandidate[] = useMemo(
    () => PLATFORM_FLAGS.map(f => ({ experienceId: f.metadata.id, priority: f.metadata.priority ?? 0 })),
    [],
  );
  const decision = useMemo(
    () => (profile ? personalize(profile, candidates, { now, segments, limit: 3 }) : null),
    [profile, candidates, now, segments],
  );

  const exposures = useMemo(() => {
    if (!profile) return [];
    const ids = new Set([
      ...Object.keys(profile.viewed), ...Object.keys(profile.clicked),
      ...Object.keys(profile.dismissed), ...Object.keys(profile.converted),
    ]);
    return [...ids].map(id => ({
      id,
      views: profile.viewed[id]?.count ?? 0,
      clicks: profile.clicked[id]?.count ?? 0,
      dismisses: profile.dismissed[id]?.count ?? 0,
      conversions: profile.converted[id]?.count ?? 0,
      lastAt: profile.viewed[id]?.lastAt ?? profile.clicked[id]?.lastAt ?? '',
      cap: checkFrequencyCap(profile, id, now, DEFAULT_FREQUENCY_CAP),
      fatigue: assessFatigue(profile, id),
    })).sort((a, b) => b.views - a.views);
  }, [profile, now]);

  return (
    <div style={{ display: 'grid', gap: 16 }} id="personalization_panel">
      <AdminCard>
        <SectionHeader
          title={L('ملفات الزوّار', 'Visitor profiles')}
          action={
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusBadge kind={visitors.length ? 'success' : 'inactive'} label={`${visitors.length} ${L('زائر', 'visitors')}`} />
              <button onClick={() => setTick(t => t + 1)} style={{ fontSize: 12, padding: '5px 10px', borderRadius: 9, cursor: 'pointer', border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                {L('تحديث', 'Refresh')}
              </button>
            </div>
          }
        />
        {visitors.length === 0 ? (
          <EmptyStateBox Icon={UserRound} title={L('لا توجد ملفات بعد', 'No profiles yet')}
            description={L('يُبنى الملف من سجلّ أحداث التجربة — تصفّح أي واجهة لإنشائه.', 'A profile is built from the Experience Event log — browse any surface to create one.')} />
        ) : (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 14 }}>
            {visitors.slice(0, 12).map(v => (
              <button key={v.id} onClick={() => setSelected(v.id)} aria-pressed={v.id === visitorId}
                style={{ ...chip(v.id === visitorId ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)'), cursor: 'pointer' }}>
                {v.id.slice(0, 14)} · {v.count}
              </button>
            ))}
          </div>
        )}
      </AdminCard>

      {profile && (
        <>
          <AdminCard>
            <SectionHeader title={L('الملف', 'Profile')} action={<code style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{profile.visitorId}</code>} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 12, padding: 14 }}>
              <StatTile label={L('الجلسات', 'Sessions')} value={profile.sessions} />
              <StatTile label={L('مشاهدات', 'Views')} value={profile.totals.views} />
              <StatTile label={L('نقرات', 'Clicks')} value={profile.totals.clicks} />
              <StatTile label={L('تجاهل', 'Dismisses')} value={profile.totals.dismisses} accent={profile.totals.dismisses ? '#f87171' : undefined} />
              <StatTile label={L('تحويلات', 'Conversions')} value={profile.totals.conversions} accent="#34d399" />
              <StatTile label={L('التفاعل', 'Engagement')} value={engagementScore(profile).toFixed(2)} />
            </div>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: '0 14px 14px', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>
              <span>{L('الدولة', 'Country')}: <strong style={{ color: 'var(--color-on-surface)' }}>{profile.country ?? '—'}</strong></span>
              <span>{L('اللغة', 'Language')}: <strong style={{ color: 'var(--color-on-surface)' }}>{profile.locale ?? '—'}</strong></span>
              <span>{L('الجهاز', 'Device')}: <strong style={{ color: 'var(--color-on-surface)' }}>{profile.device ?? '—'}</strong></span>
              <span>{L('أول ظهور', 'First seen')}: <strong style={{ color: 'var(--color-on-surface)' }}>{shortTime(profile.firstSeen)}</strong></span>
              <span>{L('آخر ظهور', 'Last seen')}: <strong style={{ color: 'var(--color-on-surface)' }}>{shortTime(profile.lastSeen)}</strong></span>
            </div>
            {(profile.preferredCategories.length > 0 || profile.favouriteMerchants.length > 0) && (
              <div style={{ display: 'grid', gap: 8, padding: '0 14px 14px' }}>
                {profile.preferredCategories.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('الفئات المفضّلة', 'Preferred categories')}</span>
                    {profile.preferredCategories.slice(0, 6).map(c => <span key={c.key} style={chip('#fb923c')}>{c.key} · {c.count}</span>)}
                  </div>
                )}
                {profile.favouriteMerchants.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('المتاجر المفضّلة', 'Favourite merchants')}</span>
                    {profile.favouriteMerchants.slice(0, 6).map(m => <span key={m.key} style={chip('#60a5fa')}>{m.key} · {m.count}</span>)}
                  </div>
                )}
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('الشرائح السلوكية', 'Behavioural segments')} action={<Layers size={15} color="var(--color-on-surface-variant)" />} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: 14 }}>
              {segments.length === 0
                ? <span style={{ fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{L('لا شرائح', 'No segments')}</span>
                : segments.map(s => <span key={s} style={chip(SEGMENT_TONE[s] ?? '#a3f95b')}>{s}</span>)}
            </div>
            <div style={{ padding: '0 14px 14px', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              {L('كل شريحة قاعدة حتمية على الملف — لا نموذج ولا استدلال.', 'Each segment is a deterministic threshold over the profile — no model, no inference.')}
            </div>
          </AdminCard>

          <AdminCard>
            <SectionHeader title={L('سجلّ العرض وحدود التكرار', 'Exposure history & frequency caps')} action={<History size={15} color="var(--color-on-surface-variant)" />} />
            {exposures.length === 0 ? (
              <EmptyStateBox Icon={Timer} title={L('لا عروض بعد', 'No exposures yet')} />
            ) : (
              <div>
                {exposures.map(x => (
                  <div key={x.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--color-outline-variant)', flexWrap: 'wrap' }}>
                    {x.cap.capped || x.fatigue.fatigued
                      ? <ShieldAlert size={15} color="#f87171" />
                      : <CheckCircle2 size={15} color="#4ade80" />}
                    <code style={{ fontSize: 12, flex: 1, minWidth: 170 }}>{x.id}</code>
                    <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>
                      {x.views}👁 · {x.clicks}🖱 · {x.dismisses}✕ · {x.conversions}★
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{shortTime(x.lastAt)}</span>
                    <span style={chip(x.cap.capped ? '#f87171' : '#4ade80')}>
                      {x.cap.capped ? `${L('محدود', 'capped')}: ${x.cap.reason}` : L('متاح', 'available')}
                    </span>
                    <span style={chip(x.fatigue.fatigued ? '#fbbf24' : 'var(--color-on-surface-variant)')}>
                      {L('إجهاد', 'fatigue')} {pct(x.fatigue.score)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <SectionHeader
              title={L('قرارات التخصيص', 'Personalization decisions')}
              action={<Sparkles size={15} color="var(--color-primary-fixed,#a3f95b)" />}
            />
            <div style={{ padding: 14, display: 'grid', gap: 8 }}>
              {decision?.ranked.map(r => (
                <div key={r.experienceId} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: 10, borderRadius: 11, flexWrap: 'wrap',
                  background: 'var(--color-surface-container-high)',
                  border: `1px solid ${r.eligible ? 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 34%, transparent)' : 'var(--color-outline-variant)'}` }}>
                  {r.eligible ? <CheckCircle2 size={14} color="#4ade80" /> : <XCircle size={14} color="var(--color-on-surface-variant)" />}
                  <code style={{ fontSize: 12, flex: 1, minWidth: 170 }}>{r.experienceId}</code>
                  {r.segmentMatches.map(s => <span key={s} style={chip(SEGMENT_TONE[s] ?? '#a3f95b')}>{s}</span>)}
                  <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('نقاط', 'score')} {r.score.toFixed(2)}</span>
                  <span style={{ fontSize: 11, color: r.eligible ? '#4ade80' : '#fbbf24' }}>{r.reason}</span>
                </div>
              ))}
              {decision && (
                <div style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)', marginTop: 4 }}>
                  {L('المختار', 'Selected')}: <strong style={{ color: 'var(--color-on-surface)' }}>{decision.selected.map(s => s.experienceId).join(', ') || L('لا شيء', 'none')}</strong>
                  {' · '}{L('مكبوت', 'suppressed')}: {decision.suppressed.length}
                </div>
              )}
            </div>
          </AdminCard>
        </>
      )}
    </div>
  );
};

export default PersonalizationPanel;
