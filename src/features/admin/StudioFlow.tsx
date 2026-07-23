// ─────────────────────────────────────────────────────────────────────────────
// Studio Flow — the Experience Studio's visual maps for a channel.
//
//   · view="flow"    → a Screen Flow navigation graph: every screen of the channel as
//                      a clickable node, connected in navigation order, each node showing
//                      the experiences the engine can place there.
//   · view="journey" → a Customer/Merchant/Driver Journey map: the same screens grouped
//                      into UX phases (Discover → … → Retain) with the experience points
//                      marked, so the operator sees the whole experience as one path.
//
// Both are PRESENTATIONAL and read ONLY the channel registry (the single source of truth)
// and the live engine decision already computed by ChannelPreview. No routing, no second
// navigation model, no fabricated data — screen names and experience ids come from the
// registry. Selecting a screen hands control back to the Studio (which opens it in the
// phone preview), so Flow/Journey and the interactive phone are one editor, not three.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ArrowDown, ChevronRight, Sparkles, CircleDot, MapPin, Layers } from 'lucide-react';
import { getChannel, type ChannelId } from '../../experience-channels/channels';

export type FlowView = 'flow' | 'journey';

export interface StudioFlowProps {
  channel: ChannelId;
  screenId: string;
  lang: 'ar' | 'en';
  /** Engine decision for the CURRENTLY-open screen (from ChannelPreview.onDecision). */
  decision: { selected: string[]; eligible: string[]; all: string[] };
  view: FlowView;
  onSelectScreen: (screenId: string) => void;
}

// Journey phases per channel. These are UX groupings of the registry's OWN screens —
// no screen is invented; a screen not listed falls into a trailing "More" band. This is
// presentation structure (how to read the app), not fabricated content.
const JOURNEY_PHASES: Record<string, { ar: string; en: string; screens: string[] }[]> = {
  customer: [
    { ar: 'الاكتشاف', en: 'Discover', screens: ['splash', 'onboarding', 'landing', 'home'] },
    { ar: 'التصفّح', en: 'Browse', screens: ['categories', 'search', 'restaurant', 'store', 'offers', 'coupons'] },
    { ar: 'الطلب', en: 'Order', screens: ['checkout'] },
    { ar: 'التتبّع', en: 'Track', screens: ['orders', 'notifications'] },
    { ar: 'الولاء', en: 'Retain', screens: ['wallet', 'profile'] },
  ],
  merchant: [
    { ar: 'التهيئة', en: 'Onboard', screens: ['dashboard', 'settings'] },
    { ar: 'التشغيل', en: 'Operate', screens: ['orders', 'products'] },
    { ar: 'النمو', en: 'Grow', screens: ['analytics', 'campaigns', 'announcements'] },
    { ar: 'التسوية', en: 'Settle', screens: ['finance'] },
  ],
  driver: [
    { ar: 'الاتصال', en: 'Go Online', screens: ['home', 'safety'] },
    { ar: 'القبول', en: 'Accept', screens: ['orders'] },
    { ar: 'التوصيل', en: 'Deliver', screens: ['map', 'navigation'] },
    { ar: 'الكسب', en: 'Earn', screens: ['wallet', 'training', 'announcements'] },
  ],
};

export const StudioFlow: React.FC<StudioFlowProps> = ({ channel, screenId, lang, decision, view, onSelectScreen }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const def = getChannel(channel);
  const screens = def?.screens ?? [];
  // Total experience points across the channel (for the header stat) — de-duplicated per screen.
  const totalExp = screens.reduce((n, s) => n + s.experiences.length, 0);

  // Experience-state color, using the live decision for the OPEN screen and a neutral
  // "defined" state for the rest (their live state is only known once opened).
  const expTone = (id: string, isCurrent: boolean): string => {
    if (!isCurrent) return 'var(--color-on-surface-variant)';
    if (decision.selected.includes(id)) return '#4ade80';
    if (decision.eligible.includes(id)) return '#f5a623';
    return 'var(--color-on-surface-variant)';
  };

  const header = (
    <div id="flow_header" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 14, fontWeight: 800, color: 'var(--color-on-surface)' }}>
        {view === 'flow' ? <Layers size={16} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} /> : <MapPin size={16} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />}
        {view === 'flow' ? L('مخطّط الشاشات', 'Screen Flow') : L('رحلة المستخدم', 'User Journey')}
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>· {L(def?.ar ?? '', def?.en ?? '')}</span>
      </span>
      <span style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CircleDot size={12} />{screens.length} {L('شاشة', 'screens')}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Sparkles size={12} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />{totalExp} {L('نقطة تجربة', 'experience points')}</span>
      </span>
    </div>
  );

  // ── Screen Flow: a connected node graph in navigation order ──
  if (view === 'flow') {
    return (
      <div id="studio_flow" data-view="flow" data-channel={channel} dir={dir} style={{ width: '100%', maxWidth: 720, margin: '0 auto' }}>
        {header}
        <div style={{ display: 'grid', gap: 0 }}>
          {screens.map((s, i) => {
            const isCurrent = s.id === screenId;
            return (
              <div key={s.id}>
                <button id={`flow_node_${s.id}`} onClick={() => onSelectScreen(s.id)}
                  className="w-full cursor-pointer text-start"
                  style={{
                    display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12,
                    padding: '12px 14px', borderRadius: 14,
                    background: isCurrent ? 'color-mix(in srgb, var(--color-primary-fixed) 14%, var(--color-surface-container))' : 'var(--color-surface-container)',
                    border: `1px solid ${isCurrent ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)'}`,
                    boxShadow: isCurrent ? '0 8px 28px -14px var(--color-primary-fixed,#a3f95b)' : 'none',
                  }}>
                  <span style={{ width: 30, height: 30, borderRadius: 9, display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 800, background: isCurrent ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-surface-container-high)', color: isCurrent ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant)' }}>{i + 1}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{L(s.ar, s.en)}</span>
                    {s.experiences.length > 0 && (
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 5, marginTop: 5 }}>
                        {s.experiences.map(id => (
                          <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: expTone(id, isCurrent) }}>
                            <span style={{ width: 6, height: 6, borderRadius: 999, background: expTone(id, isCurrent) }} />{id.replace('flag.', '')}
                          </span>
                        ))}
                      </span>
                    )}
                  </span>
                  <ChevronRight size={16} style={{ color: 'var(--color-on-surface-variant)', transform: dir === 'rtl' ? 'scaleX(-1)' : 'none' }} />
                </button>
                {i < screens.length - 1 && (
                  <div style={{ display: 'grid', placeItems: 'center', height: 22 }}>
                    <ArrowDown size={15} style={{ color: 'var(--color-outline-variant)' }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── User Journey: phase bands with the screens and their experience points ──
  const phases = JOURNEY_PHASES[channel] ?? [];
  const placed = new Set(phases.flatMap(p => p.screens));
  const leftovers = screens.filter(s => !placed.has(s.id)).map(s => s.id);
  const bands = leftovers.length ? [...phases, { ar: 'أخرى', en: 'More', screens: leftovers }] : phases;

  return (
    <div id="studio_flow" data-view="journey" data-channel={channel} dir={dir} style={{ width: '100%' }}>
      {header}
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {bands.map((band, bi) => (
          <div key={band.en} style={{ minWidth: 190, flex: '1 0 190px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 8, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 800, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)' }}>{bi + 1}</span>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--color-on-surface)' }}>{L(band.ar, band.en)}</span>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {band.screens.map(sid => {
                const s = screens.find(x => x.id === sid);
                if (!s) return null;
                const isCurrent = s.id === screenId;
                return (
                  <button key={s.id} id={`journey_node_${s.id}`} onClick={() => onSelectScreen(s.id)}
                    className="w-full cursor-pointer text-start"
                    style={{
                      padding: '10px 11px', borderRadius: 12,
                      background: isCurrent ? 'color-mix(in srgb, var(--color-primary-fixed) 14%, var(--color-surface-container))' : 'var(--color-surface-container)',
                      border: `1px solid ${isCurrent ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)'}`,
                    }}>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>{L(s.ar, s.en)}</span>
                    {s.experiences.length > 0 ? (
                      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {s.experiences.map(id => (
                          <span key={id} title={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 9.5, fontWeight: 700, color: expTone(id, isCurrent) }}>
                            <Sparkles size={9} />{id.replace('flag.', '')}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span style={{ display: 'block', fontSize: 10, marginTop: 4, color: 'var(--color-on-surface-variant)', opacity: 0.7 }}>{L('لا نقاط تجربة', 'no experience points')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p style={{ margin: '12px 2px 0', fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>
        {L('كل نقطة تجربة يضعها محرّك التجربة على تلك الشاشة. اختر شاشة لتحريرها في المعاينة.', 'Each experience point is placed by the Experience Engine on that screen. Select a screen to edit it in the preview.')}
      </p>
    </div>
  );
};

export default StudioFlow;
