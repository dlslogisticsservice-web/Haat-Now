// ─────────────────────────────────────────────────────────────────────────────
// Website Studio · per-section targeting authoring.
//
// Lets an editor decide WHO sees a section, visually — no JSON. Choosing an audience creates (or
// updates) a feature flag named for the section's STABLE block id, targeted at that audience. That
// is exactly the rule the live runtime already enforces (Wave 16), so nothing new is invented:
// this screen only authors the flag the engine was always going to read.
//
// Reuse-only: flags live in the engine's registry via `experience-platform.service`, and the
// operator's choice persists through `experience-state.service` (adminCrud) like every other
// Experience Center action.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo, useState } from 'react';
import { Users, Globe, Eye, EyeOff, Check } from 'lucide-react';
import { experiencePlatform, PLATFORM_AUDIENCES } from '../../services/experience-platform.service';
import { saveFlagState } from '../../services/experience-state.service';
import { assignBlockIds } from '../../experience-channels/website/blockId';
import type { WebsiteBlock } from '../../services/website.service';
import type { FeatureFlag } from '../../experience-engine';

const chip = (active: boolean): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 999,
  fontSize: 11.5, fontWeight: 700, cursor: 'pointer', transition: 'all .18s ease',
  border: `1px solid ${active ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-outline-variant)'}`,
  background: active ? 'color-mix(in srgb, var(--color-primary-fixed, #a3f95b) 16%, transparent)' : 'var(--color-surface-container-high)',
  color: active ? 'var(--color-primary-fixed, #a3f95b)' : 'var(--color-on-surface-variant)',
});

export const SectionTargeting: React.FC<{
  sections: WebsiteBlock[];
  index: number;
  lang: 'ar' | 'en';
}> = ({ sections, index, lang }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [, force] = useState(0);
  const refresh = () => force(n => n + 1);

  const blockId = useMemo(() => assignBlockIds(sections)[index], [sections, index]);
  const platform = experiencePlatform();
  const flag = blockId ? platform.engine.flags.get(blockId) : null;

  // Which audiences is this section currently limited to? (empty ⇒ everyone)
  const targeted: string[] = useMemo(() => {
    const rule = flag?.rules?.find(r => r.criteria?.audiences?.length);
    return rule?.criteria?.audiences ?? [];
  }, [flag]);

  const visibleToAll = !flag || (flag.default?.enabled !== false && targeted.length === 0);

  /** Write the rule the runtime reads: default OFF + "on for these audiences". */
  const setTargeting = (audiences: string[]) => {
    if (!blockId) return;
    if (audiences.length === 0) {
      // Visible to everyone → remove the restriction by defaulting the flag on with no rules.
      platform.engine.flags.register({
        metadata: { id: blockId, name: `Section ${blockId}`, version: '1.0.0', priority: 0, description: 'Website Studio section targeting' },
        enabled: true, default: { enabled: true }, rules: [],
      } as FeatureFlag);
      void saveFlagState(blockId, true);
    } else {
      platform.engine.flags.register({
        metadata: { id: blockId, name: `Section ${blockId}`, version: '1.0.0', priority: 0, description: 'Website Studio section targeting' },
        enabled: true,
        default: { enabled: false },
        rules: [{ id: 'studio-audience', criteria: { audiences }, enabled: true }],
      } as FeatureFlag);
      void saveFlagState(blockId, false);
    }
    refresh();
  };

  const toggleAudience = (id: string) => {
    setTargeting(targeted.includes(id) ? targeted.filter(a => a !== id) : [...targeted, id]);
  };

  if (!blockId) return null;

  return (
    <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 12, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={14} color="var(--color-primary-fixed, #a3f95b)" />
        <strong style={{ fontSize: 12.5 }}>{L('من يرى هذا القسم؟', 'Who sees this section?')}</strong>
        <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: visibleToAll ? '#4ade80' : '#fbbf24' }}>
          {visibleToAll ? <Eye size={13} /> : <EyeOff size={13} />}
          {visibleToAll ? L('الجميع', 'Everyone') : `${targeted.length} ${L('جمهور', 'audience(s)')}`}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <button onClick={() => setTargeting([])} style={chip(visibleToAll)} aria-pressed={visibleToAll}>
          <Globe size={12} /> {L('الجميع', 'Everyone')}
        </button>
        {PLATFORM_AUDIENCES.map(a => {
          const on = targeted.includes(a.metadata.id);
          return (
            <button key={a.metadata.id} onClick={() => toggleAudience(a.metadata.id)} style={chip(on)} aria-pressed={on} title={a.metadata.description}>
              {on && <Check size={12} />} {a.metadata.name}
            </button>
          );
        })}
      </div>

      <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.6, color: 'var(--color-on-surface-variant)' }}>
        {visibleToAll
          ? L('هذا القسم ظاهر لكل الزوّار. اختر جمهوراً لتقييده.', 'This section is visible to every visitor. Pick an audience to limit it.')
          : L('يظهر هذا القسم فقط للجماهير المحدّدة أعلاه — يطبّقه محرّك التجربة على الموقع الحيّ.', 'This section shows only for the audiences above — enforced by the Experience Runtime on the live site.')}
      </p>
    </div>
  );
};

export default SectionTargeting;
