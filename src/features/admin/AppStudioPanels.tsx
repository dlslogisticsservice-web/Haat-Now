// ─────────────────────────────────────────────────────────────────────────────
// App Studio · right-rail builder panels.
//
// The Application Studio's properties rail is a real builder inspector with tabs:
//   Properties · Components · Theme · Bottom Nav · App Bar
//
// • Properties  → the existing ChannelInspector (edits the selected experience's content,
//                 bound to the ONE content store the live app reads). Not duplicated.
// • Components  → the Component Library: the app-shell parts (App Bar, Bottom/Side Nav,
//                 Search, FAB) and this screen's experience points. Selecting a part opens
//                 its editor / selects it in the phone.
// • Theme       → app theme tokens (primary / accent / radius) applied live to the phone.
// • Bottom Nav  → edit each navigation label; the phone updates immediately.
// • App Bar     → edit the app-bar brand text; the phone updates immediately.
//
// Theme + Nav + App-Bar edits are authored overrides (not fabricated data) held in the
// App Studio shell state, autosaved client-side and pushed into the canvas as it types.
// The Experience Engine, Runtime, CMS, services and DB are untouched.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import {
  SlidersHorizontal, LayoutGrid, Palette, PanelBottom, PanelTop, Sparkles, Search,
  Plus, RotateCcw, ExternalLink, MousePointerClick,
} from 'lucide-react';
import { ChannelInspector, type ChannelInspectorProps } from './ChannelInspector';
import { chromeFor, type AppShellOverride } from './ChannelPreview';
import { getChannel } from '../../experience-channels/channels';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const field: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 9, fontSize: 12.5, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: 4 };

type Tab = 'properties' | 'components' | 'theme' | 'nav' | 'appbar';

export interface AppStudioPanelsProps extends ChannelInspectorProps {
  shell: AppShellOverride;
  onShellChange: (patch: AppShellOverride) => void;
  onResetShell: () => void;
  onSelectExperience: (id: string) => void;
}

export const AppStudioPanels: React.FC<AppStudioPanelsProps> = (props) => {
  const { channel, lang, decision, selectedId, shell, onShellChange, onResetShell, onSelectExperience } = props;
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const [tab, setTab] = useState<Tab>('properties');
  const def = getChannel(channel);
  const isMobile = def?.form === 'mobile';
  const chrome = chromeFor(channel);
  const locKey: 'ar' | 'en' = lang === 'ar' ? 'ar' : 'en';

  // Selecting a surface in the canvas jumps to Properties (edit what you clicked).
  useEffect(() => { if (selectedId) setTab('properties'); }, [selectedId]);

  const TABS: { id: Tab; icon: typeof LayoutGrid; ar: string; en: string }[] = [
    { id: 'properties', icon: SlidersHorizontal, ar: 'الخصائص', en: 'Properties' },
    { id: 'components', icon: LayoutGrid, ar: 'المكوّنات', en: 'Components' },
    { id: 'theme', icon: Palette, ar: 'الثيم', en: 'Theme' },
    { id: 'nav', icon: PanelBottom, ar: 'التنقّل', en: 'Bottom Nav' },
    { id: 'appbar', icon: PanelTop, ar: 'الشريط', en: 'App Bar' },
  ];

  const theme = shell.theme ?? {};
  const setTheme = (patch: Partial<NonNullable<AppShellOverride['theme']>>) => onShellChange({ theme: { ...theme, ...patch } });
  const setNavLabel = (screen: string, value: string) => onShellChange({ navLabels: { ...(shell.navLabels ?? {}), [screen]: { ...(shell.navLabels?.[screen] ?? {}), [locKey]: value } } });
  const setBrand = (value: string) => onShellChange({ brand: { ...(shell.brand ?? {}), [locKey]: value } });

  return (
    <div id="app_studio_panels" dir={dir} style={{ display: 'grid', gap: 10 }}>
      {/* Tab bar */}
      <div id="app_studio_tabs" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--color-surface-container-high)', flexWrap: 'wrap' }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button key={t.id} id={`app_tab_${t.id}`} onClick={() => setTab(t.id)} title={L(t.ar, t.en)}
              className="inline-flex items-center gap-1 cursor-pointer text-[11px] font-bold"
              style={{ flex: '1 0 auto', justifyContent: 'center', padding: '6px 8px', borderRadius: 8, border: 'none', background: on ? 'var(--color-primary-fixed)' : 'transparent', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>
              <t.icon size={12} />{L(t.ar, t.en)}
            </button>
          );
        })}
      </div>

      {/* Properties — the existing channel inspector, unchanged */}
      {tab === 'properties' && <ChannelInspector {...props} />}

      {/* Components — the app building blocks + this screen's experience points */}
      {tab === 'components' && (
        <div id="component_library" style={{ display: 'grid', gap: 10 }}>
          <div style={{ ...card, padding: 12 }}>
            <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}><LayoutGrid size={13} />{L('مكوّنات الهيكل', 'Shell components')}</p>
            <div style={{ display: 'grid', gap: 6 }}>
              {[
                { icon: PanelTop, ar: 'الشريط العلوي', en: 'App Bar', go: 'appbar' as Tab },
                { icon: isMobile ? PanelBottom : LayoutGrid, ar: isMobile ? 'شريط التنقّل' : 'التنقّل الجانبي', en: isMobile ? 'Bottom Navigation' : 'Side Navigation', go: 'nav' as Tab },
                { icon: Search, ar: 'البحث', en: 'Search', go: null },
                { icon: Palette, ar: 'ثيم التطبيق', en: 'App Theme', go: 'theme' as Tab },
              ].map(c => (
                <button key={c.en} id={`lib_${c.en.replace(/\s+/g, '_').toLowerCase()}`} onClick={() => c.go && setTab(c.go)}
                  className="flex items-center gap-2 cursor-pointer text-start" style={{ ...card, padding: '8px 10px', background: 'var(--color-surface-container-high)' }}>
                  <c.icon size={14} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />
                  <span className="text-[12px] font-semibold flex-1" style={{ color: 'var(--color-on-surface)' }}>{L(c.ar, c.en)}</span>
                  {c.go && <MousePointerClick size={12} style={{ color: 'var(--color-on-surface-variant)' }} />}
                </button>
              ))}
            </div>
          </div>
          <div style={{ ...card, padding: 12 }}>
            <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}><Sparkles size={13} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />{L('نقاط التجربة', 'Experience points')}</p>
            {decision.all.length === 0
              ? <p className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا نقاط تجربة على هذه الشاشة.', 'No experience points on this screen.')}</p>
              : <div style={{ display: 'grid', gap: 6 }}>
                  {decision.all.map(id => {
                    const on = selectedId === id;
                    const tone = decision.selected.includes(id) ? '#4ade80' : decision.eligible.includes(id) ? '#f5a623' : 'var(--color-on-surface-variant)';
                    return (
                      <button key={id} id={`lib_exp_${id.replace('flag.', '')}`} onClick={() => onSelectExperience(id)}
                        className="flex items-center gap-2 cursor-pointer text-start" style={{ ...card, padding: '8px 10px', background: on ? 'color-mix(in srgb, var(--color-primary-fixed) 16%, transparent)' : 'var(--color-surface-container-high)', outline: on ? '1px solid var(--color-primary-fixed)' : 'none' }}>
                        <Sparkles size={13} style={{ color: tone }} />
                        <code className="text-[11px] flex-1" style={{ color: 'var(--color-on-surface)' }}>{id.replace('flag.', '')}</code>
                      </button>
                    );
                  })}
                </div>}
            <button id="lib_add_experience" onClick={props.onOpenExperienceCenter}
              className="w-full flex items-center justify-center gap-2 cursor-pointer mt-2" style={{ ...card, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)', background: 'var(--color-surface-container-high)' }}>
              <Plus size={13} />{L('إضافة تجربة (مركز التجربة)', 'Add experience (Experience Center)')}<ExternalLink size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Theme — app tokens applied live */}
      {tab === 'theme' && (
        <div id="app_theme_editor" style={{ ...card, padding: 12, display: 'grid', gap: 12 }}>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ margin: 0, color: 'var(--color-on-surface)' }}><Palette size={13} />{L('ثيم التطبيق', 'App theme')}</p>
          {([['primary', L('اللون الأساسي', 'Primary'), '#A3F95B'], ['accent', L('لون التمييز', 'Accent'), '#6EE7FF']] as const).map(([k, label, def0]) => (
            <div key={k}>
              <label style={lbl}>{label}</label>
              <div className="flex items-center gap-2">
                <input type="color" id={`apptheme_${k}`} value={/^#[0-9a-fA-F]{6}$/.test((theme as any)[k] || '') ? (theme as any)[k] : def0}
                  onChange={e => setTheme({ [k]: e.target.value } as any)} style={{ width: 40, height: 32, border: '1px solid var(--color-outline-variant)', borderRadius: 8, background: 'transparent', cursor: 'pointer' }} />
                <input value={(theme as any)[k] || ''} placeholder={def0} onChange={e => setTheme({ [k]: e.target.value || undefined } as any)} style={field} />
              </div>
            </div>
          ))}
          <div>
            <label style={lbl}>{L('استدارة البطاقات', 'Card radius')} · {theme.radius ?? 14}px</label>
            <input type="range" id="apptheme_radius" min={0} max={28} value={theme.radius ?? 14} onChange={e => setTheme({ radius: Number(e.target.value) })} style={{ width: '100%' }} />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['#A3F95B', '#6EE7FF', '#F97316', '#F43F5E', '#8B5CF6', '#22D3EE'].map(c => (
              <button key={c} onClick={() => setTheme({ primary: c })} title={c} style={{ width: 24, height: 24, borderRadius: 7, background: c, border: '1px solid var(--color-outline-variant)', cursor: 'pointer' }} />
            ))}
          </div>
          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('يُطبَّق فوراً على المعاينة.', 'Applies to the preview immediately.')}</p>
        </div>
      )}

      {/* Bottom Nav editor */}
      {tab === 'nav' && (
        <div id="bottom_nav_editor" style={{ ...card, padding: 12, display: 'grid', gap: 10 }}>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ margin: 0, color: 'var(--color-on-surface)' }}><PanelBottom size={13} />{isMobile ? L('شريط التنقّل السفلي', 'Bottom navigation') : L('التنقّل الجانبي', 'Side navigation')}</p>
          {chrome.length === 0 ? <p className="text-[11.5px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا يوجد تنقّل لهذه القناة.', 'No navigation for this channel.')}</p> : chrome.map(c => (
            <div key={c.screen}>
              <label style={lbl}>{L(c.ar, c.en)}</label>
              <div className="flex items-center gap-1.5">
                <input id={`nav_label_${c.screen}`} style={field} value={(lang === 'ar' ? shell.navLabels?.[c.screen]?.ar : shell.navLabels?.[c.screen]?.en) ?? ''} placeholder={L(c.ar, c.en)} onChange={e => setNavLabel(c.screen, e.target.value)} />
              </div>
            </div>
          ))}
          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('اكتب لتحديث التسميات في المعاينة مباشرة.', 'Type to update the labels in the preview live.')}</p>
        </div>
      )}

      {/* App Bar editor */}
      {tab === 'appbar' && (
        <div id="app_bar_editor" style={{ ...card, padding: 12, display: 'grid', gap: 10 }}>
          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ margin: 0, color: 'var(--color-on-surface)' }}><PanelTop size={13} />{L('الشريط العلوي', 'App bar')}</p>
          <div>
            <label style={lbl}>{L('اسم التطبيق', 'App name / brand')}</label>
            <input id="appbar_brand" style={field} value={(lang === 'ar' ? shell.brand?.ar : shell.brand?.en) ?? ''} placeholder={def?.en === 'Driver App' ? 'HAAT Captain' : channel === 'merchant' ? 'Merchant Portal' : 'HAAT NOW'} onChange={e => setBrand(e.target.value)} />
          </div>
          <p style={{ margin: 0, fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('يظهر في أعلى المعاينة مباشرة.', 'Shows at the top of the preview live.')}</p>
        </div>
      )}

      {/* Reset shell overrides */}
      {(shell.theme || shell.brand || (shell.navLabels && Object.keys(shell.navLabels).length)) && tab !== 'properties' && (
        <button id="app_shell_reset" onClick={onResetShell} className="w-full flex items-center justify-center gap-2 cursor-pointer"
          style={{ ...card, padding: '8px 10px', fontSize: 11.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>
          <RotateCcw size={13} />{L('إرجاع الهيكل إلى الافتراضي', 'Reset shell to default')}
        </button>
      )}
    </div>
  );
};

export default AppStudioPanels;
