// ─────────────────────────────────────────────────────────────────────────────
// Channel Component Tree — the Experience Studio's structural view of the OPEN screen.
//
// It shows the selected screen as a widget tree: the app-shell chrome (header / bottom
// or side navigation) and, in between, the experience points the engine can place —
// each coloured by its live state (shown / eligible / off). Selecting an experience node
// selects it in the phone preview and the inspector; selecting a navigation node
// navigates to that screen. One structure, read from the SAME registry + chrome
// definition the preview uses (getChannel + chromeFor) — no second component model.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { ChevronDown, PanelTop, PanelBottom, Sparkles, Layers, CircleDot } from 'lucide-react';
import { getChannel, getScreen, type ChannelId } from '../../experience-channels/channels';
import { chromeFor } from './ChannelPreview';

export interface ChannelTreeProps {
  channel: ChannelId;
  screenId: string;
  lang: 'ar' | 'en';
  decision: { selected: string[]; eligible: string[]; all: string[] };
  selectedId: string | null;
  onSelectExperience: (id: string) => void;
  onNavigate: (screenId: string) => void;
}

const rowBase: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 7, width: '100%', textAlign: 'start',
  padding: '5px 8px', borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
  fontSize: 12, color: 'var(--color-on-surface)',
};

export const ChannelTree: React.FC<ChannelTreeProps> = ({ channel, screenId, lang, decision, selectedId, onSelectExperience, onNavigate }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const def = getChannel(channel);
  const screen = getScreen(channel, screenId) ?? def?.screens[0];
  const chrome = chromeFor(channel);
  const isMobile = def?.form === 'mobile';
  const exps = screen?.experiences ?? [];

  const stateTone = (id: string): string =>
    decision.selected.includes(id) ? '#4ade80' : decision.eligible.includes(id) ? '#f5a623' : 'var(--color-on-surface-variant)';
  const stateLabel = (id: string): string =>
    decision.selected.includes(id) ? L('معروضة', 'shown') : decision.eligible.includes(id) ? L('مؤهّلة', 'eligible') : L('معطّلة', 'off');

  return (
    <div id="channel_tree" data-channel={channel} data-screen={screen?.id} className="mt-3 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
      <p className="text-[10px] font-bold uppercase px-1 mb-1 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Layers size={11} />{L('شجرة المكوّنات', 'Component tree')}
      </p>

      {/* Root: the open screen */}
      <div style={{ ...rowBase, fontWeight: 800, cursor: 'default' }}>
        <ChevronDown size={13} style={{ color: 'var(--color-on-surface-variant)' }} />
        <CircleDot size={12} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
        <span className="flex-1 truncate">{L(screen?.ar ?? '', screen?.en ?? '')}</span>
      </div>

      <div style={{ marginInlineStart: 10, borderInlineStart: '1px solid var(--color-outline-variant)', paddingInlineStart: 6 }}>
        {/* App-shell header (informational — defined by the app shell) */}
        <div id="tree_appbar" style={{ ...rowBase, cursor: 'default', color: 'var(--color-on-surface-variant)' }} title={L('يُعرّفه هيكل التطبيق', 'Defined by the app shell')}>
          <PanelTop size={12} /><span className="flex-1 truncate">{L('الشريط العلوي', 'App bar')}</span>
        </div>

        {/* Experience points on this screen — selectable, live-state coloured */}
        {exps.length > 0 ? exps.map(id => {
          const on = selectedId === id;
          return (
            <button key={id} id={`tree_exp_${id.replace('flag.', '')}`} onClick={() => onSelectExperience(id)}
              style={{ ...rowBase, background: on ? 'color-mix(in srgb, var(--color-primary-fixed) 16%, transparent)' : 'transparent', outline: on ? '1px solid var(--color-primary-fixed)' : 'none' }}>
              <Sparkles size={12} style={{ color: stateTone(id) }} />
              <span className="flex-1 truncate">{id.replace('flag.', '')}</span>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: stateTone(id) }} title={stateLabel(id)} />
            </button>
          );
        }) : (
          <div style={{ ...rowBase, cursor: 'default', color: 'var(--color-on-surface-variant)', opacity: 0.7, fontSize: 11 }}>
            <Sparkles size={12} /><span>{L('لا نقاط تجربة', 'No experience points')}</span>
          </div>
        )}

        {/* Navigation chrome — each entry navigates to its screen */}
        {chrome.length > 0 && (
          <>
            <div style={{ ...rowBase, cursor: 'default', color: 'var(--color-on-surface-variant)', marginTop: 2 }}>
              <PanelBottom size={12} /><span className="flex-1 truncate">{isMobile ? L('شريط التنقّل', 'Bottom navigation') : L('التنقّل الجانبي', 'Side navigation')}</span>
            </div>
            <div style={{ marginInlineStart: 10, borderInlineStart: '1px solid var(--color-outline-variant)', paddingInlineStart: 6 }}>
              {chrome.map(c => {
                const on = c.screen === screen?.id;
                return (
                  <button key={c.screen} id={`tree_nav_${c.screen}`} onClick={() => onNavigate(c.screen)}
                    style={{ ...rowBase, fontSize: 11.5, color: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface)', fontWeight: on ? 800 : 500 }}>
                    <c.icon size={12} /><span className="flex-1 truncate">{L(c.ar, c.en)}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ChannelTree;
