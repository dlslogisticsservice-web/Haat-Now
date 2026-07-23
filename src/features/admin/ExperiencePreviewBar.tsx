// ─────────────────────────────────────────────────────────────────────────────
// Website Studio · Experience preview bar.
//
// Lets an editor preview the page AS a visitor — country, language, device and the resulting
// audiences / flags / experiment arm — and see exactly which authored sections the Experience
// Runtime would hide, WITHOUT touching JSON.
//
// Reuse-only: the decision comes from the same `experience-platform.service` every product screen
// uses, and section ids come from the same `assignBlockIds` the live runtime and the engine mapper
// share (Wave 16). Nothing here re-implements targeting.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Globe, Languages, Users, EyeOff, Eye, FlaskConical, Sparkles, UserRound, Timer } from 'lucide-react';
import { decideFor, experienceEvents } from '../../services/experience-platform.service';
import { deriveVisitorProfile, deriveSegments, personalize, type ExperienceCandidate } from '../../experience-engine';
import { assignBlockIds } from '../../experience-channels/website/blockId';
import type { WebsiteBlock } from '../../services/website.service';

const COUNTRIES = ['SA', 'AE', 'EG', 'KW'] as const;

const pill = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 10,
  fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all .18s ease',
  border: `1px solid ${active ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-outline-variant)'}`,
  background: active ? 'color-mix(in srgb, var(--color-primary-fixed, #a3f95b) 14%, transparent)' : 'var(--color-surface-container-high)',
  color: active ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-on-surface-variant)',
});

export const ExperiencePreviewBar: React.FC<{
  sections: WebsiteBlock[];
  path: string;
  lang: 'ar' | 'en';
  device: 'desktop' | 'tablet' | 'mobile';
}> = ({ sections, path, lang, device }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [country, setCountry] = useState<string>('SA');
  const [locale, setLocale] = useState<'ar' | 'en'>(lang);
  const [open, setOpen] = useState(true);

  const decision = useMemo(
    () => decideFor({ surface: 'website', locale, country, experienceId: path }),
    [locale, country, path],
  );

  // Which authored sections would the runtime hide for this visitor? A section is hidden when a
  // registered flag named for its stable id resolves off — the exact live rule (Wave 16).
  const hidden = useMemo(() => {
    const ids = assignBlockIds(sections);
    return ids.filter(id => decision.flags[id] && !decision.flags[id].enabled);
  }, [sections, decision]);

  const experiments = Object.entries(decision.experiments);

  // Wave 20 · what personalization would do for this previewed visitor (deterministic).
  const personal = useMemo(() => {
    const now = (() => { try { return new Date().toISOString(); } catch { return ''; } })();
    const profile = deriveVisitorProfile(experienceEvents().all(), decision.context.identity.visitorId);
    const segments = deriveSegments(profile, now);
    const candidates: ExperienceCandidate[] = assignBlockIds(sections).map((id, i) => ({ experienceId: id, priority: sections.length - i }));
    return { profile, segments, decision: personalize(profile, candidates, { now, segments, limit: 3 }), now };
  }, [decision, sections]);

  return (
    <div style={{ border: '1px solid var(--color-outline-variant)', borderRadius: 14, background: 'var(--color-surface-container)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-on-surface)' }}
      >
        <Sparkles size={15} color="var(--color-primary-fixed, #a3f95b)" />
        <strong style={{ fontSize: 12.5 }}>{L('معاينة التجربة', 'Experience preview')}</strong>
        <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
          {decision.audiences.length} {L('جمهور مطابق', 'audience(s)')}
          {hidden.length > 0 && ` · ${hidden.length} ${L('قسم مخفي', 'section(s) hidden')}`}
        </span>
        <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{ padding: '0 12px 12px', display: 'grid', gap: 12 }}>
          {/* Visitor controls */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Globe size={13} /> {L('الدولة', 'Country')}
            </span>
            {COUNTRIES.map(c => (
              <button key={c} onClick={() => setCountry(c)} aria-pressed={country === c} style={pill(country === c)}>{c}</button>
            ))}
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--color-outline-variant)' }} />
            <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Languages size={13} /> {L('اللغة', 'Language')}
            </span>
            {(['en', 'ar'] as const).map(l => (
              <button key={l} onClick={() => setLocale(l)} aria-pressed={locale === l} style={pill(locale === l)}>{l.toUpperCase()}</button>
            ))}
            <span style={{ marginInlineStart: 'auto', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
              {L('الجهاز', 'Device')}: <strong style={{ color: 'var(--color-on-surface)' }}>{device}</strong>
            </span>
          </div>

          {/* Matched audiences */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <Users size={13} color="var(--color-on-surface-variant)" />
            {decision.audiences.length === 0
              ? <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('لا يوجد جمهور مطابق لهذا الزائر', 'No audience matches this visitor')}</span>
              : decision.audiences.map(a => (
                <span key={a} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, fontWeight: 700, background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 16%, transparent)', color: 'var(--color-primary-fixed,#a3f95b)' }}>{a}</span>
              ))}
          </div>

          {/* Experiment arms */}
          {experiments.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <FlaskConical size={13} color="var(--color-on-surface-variant)" />
              {experiments.map(([id, v]) => (
                <span key={id} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
                  {id.replace('exp.', '')} → <strong style={{ color: 'var(--color-on-surface)' }}>{v}</strong>
                </span>
              ))}
            </div>
          )}

          {/* Wave 20 · personalization preview — profile, segments, caps, selected set */}
          <div style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 10, background: 'var(--color-surface-container-high)' }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <UserRound size={13} color="var(--color-on-surface-variant)" />
              <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>
                {L('ملف الزائر', 'Visitor profile')}: {personal.profile.totals.views} {L('مشاهدة', 'views')} · {personal.profile.totals.clicks} {L('نقرة', 'clicks')} · {personal.profile.sessions} {L('جلسة', 'sessions')}
              </span>
              {personal.segments.map(sg => (
                <span key={sg} style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 999, fontWeight: 700, background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 16%, transparent)', color: 'var(--color-primary-fixed,#a3f95b)' }}>{sg}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Timer size={13} color="var(--color-on-surface-variant)" />
              <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('التجارب المخصّصة', 'Personalized experiences')}:</span>
              {personal.decision.ranked.length === 0
                ? <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('لا مرشّحين', 'no candidates')}</span>
                : personal.decision.ranked.slice(0, 6).map(r => (
                  <span key={r.experienceId} title={r.reason}
                    style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 999,
                      background: r.eligible ? 'color-mix(in srgb, #4ade80 15%, transparent)' : 'var(--color-surface-container)',
                      color: r.eligible ? '#4ade80' : 'var(--color-on-surface-variant)' }}>
                    {r.experienceId.replace('flag.', '')} {r.eligible ? '✓' : '·'} {r.score.toFixed(1)}
                  </span>
                ))}
            </div>
          </div>

          {/* Section visibility for this visitor */}
          <div style={{ display: 'grid', gap: 4 }}>
            {sections.length === 0 && (
              <span style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('لا توجد أقسام في هذه الصفحة.', 'This page has no sections yet.')}</span>
            )}
            {sections.map((b, i) => {
              const id = assignBlockIds(sections)[i];
              const isHidden = hidden.includes(id);
              const authoredOff = (b as { enabled?: boolean }).enabled === false;
              const off = isHidden || authoredOff;
              return (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 9, background: 'var(--color-surface-container-high)', opacity: off ? 0.55 : 1 }}>
                  {off ? <EyeOff size={13} color="#f87171" /> : <Eye size={13} color="#4ade80" />}
                  <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{String((b as { type?: string }).type ?? 'block')}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>
                    {authoredOff ? L('مطفأ يدوياً', 'disabled by editor') : isHidden ? L('يخفيه محرّك التجربة', 'hidden by Experience Runtime') : L('ظاهر', 'visible')}
                  </span>
                  <code style={{ marginInlineStart: 'auto', fontSize: 10, color: 'var(--color-on-surface-variant)' }}>{id}</code>
                </div>
              );
            })}
          </div>

          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, color: 'var(--color-on-surface-variant)' }}>
            {L(
              'لإخفاء قسم لجمهور معيّن: أنشئ ميزة في مركز التجربة بنفس معرّف القسم الظاهر أعلاه، ثم استهدف الجمهور المطلوب.',
              'To hide a section for an audience: create a feature flag in the Experience Center using the section id shown above, then target the audience you want.',
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default ExperiencePreviewBar;
