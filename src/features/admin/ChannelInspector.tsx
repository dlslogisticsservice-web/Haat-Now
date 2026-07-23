// ─────────────────────────────────────────────────────────────────────────────
// Channel Inspector — the Experience Studio right panel for the Customer, Merchant and
// Driver channels.
//
// The website inspector (Blocks / SEO / Theme) is the existing editor and is NOT touched.
// This inspector does two jobs:
//   1. When an experience is selected, it EDITS that experience's content — title, body,
//      icon, variant — bound to the ONE content store the live app also reads. So editing
//      here changes the live Customer/Merchant/Driver app. This is authoring, not preview.
//   2. It shows the engine decision for the screen (which experiences are shown / eligible /
//      off) and links to the Experience Center for TARGETING (audiences/flags), which the
//      engine owns — no duplicate targeting UI here.
//
// Property vocabulary per channel: Customer → Cards/Lists/Buttons/Offers/Components,
// Merchant → Widgets/Tables/Charts, Driver → Maps/Tasks/Cards/Announcements.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import {
  LayoutGrid, List, MousePointerClick, Tag, Table2, BarChart3, Map, ClipboardList,
  Megaphone, Sparkles, ExternalLink, CheckCircle2, MinusCircle, RotateCcw, EyeOff, Eye, Lock, LockOpen,
} from 'lucide-react';
import { getChannel, getScreen, type ChannelId, type InspectorKind } from '../../experience-channels/channels';
import { resolveContent, type ExperienceContentOverride } from '../../experience-content/content';
import { EXPERIENCE_ICON_NAMES } from '../../components/experience/experienceIcons';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const field: React.CSSProperties = {
  width: '100%', padding: '8px 10px', borderRadius: 9, fontSize: 12.5,
  background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)',
  border: '1px solid var(--color-outline-variant)', outline: 'none',
};
const lbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: 4 };

const PALETTE: Record<InspectorKind, { icon: typeof Tag; ar: string; en: string }[]> = {
  website: [],
  customer: [
    { icon: LayoutGrid, ar: 'البطاقات', en: 'Cards' }, { icon: List, ar: 'القوائم', en: 'Lists' },
    { icon: MousePointerClick, ar: 'الأزرار', en: 'Buttons' }, { icon: Tag, ar: 'العروض', en: 'Offers' },
    { icon: LayoutGrid, ar: 'المكوّنات', en: 'Components' },
  ],
  merchant: [
    { icon: LayoutGrid, ar: 'الأدوات', en: 'Widgets' }, { icon: Table2, ar: 'الجداول', en: 'Tables' }, { icon: BarChart3, ar: 'الرسوم', en: 'Charts' },
  ],
  driver: [
    { icon: Map, ar: 'الخرائط', en: 'Maps' }, { icon: ClipboardList, ar: 'المهام', en: 'Tasks' },
    { icon: LayoutGrid, ar: 'البطاقات', en: 'Cards' }, { icon: Megaphone, ar: 'الإعلانات', en: 'Announcements' },
  ],
};

export interface ChannelInspectorProps {
  channel: ChannelId;
  screenId: string;
  lang: 'ar' | 'en';
  decision: { selected: string[]; eligible: string[]; all: string[] };
  selectedId: string | null;
  /** Bumped when content changes so the resolved values re-read. */
  contentVersion: number;
  overrideOf: (id: string) => ExperienceContentOverride | undefined;
  onEditContent: (id: string, patch: ExperienceContentOverride) => void;
  onResetContent: (id: string) => void;
  locked: string[];
  hidden: string[];
  onAction: (id: string, action: 'hide' | 'lock' | 'up' | 'down') => void;
  onOpenExperienceCenter?: () => void;
}

export const ChannelInspector: React.FC<ChannelInspectorProps> = (props) => {
  const { channel, screenId, lang, decision, selectedId, contentVersion, overrideOf, onEditContent, onResetContent, locked, hidden, onAction, onOpenExperienceCenter } = props;
  void contentVersion; // a change re-renders this panel so resolved content re-reads
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const def = getChannel(channel);
  const screen = getScreen(channel, screenId) ?? def?.screens[0];
  const kind = def?.inspector ?? 'customer';
  const palette = PALETTE[kind];

  // ── Property editor for the SELECTED experience ──
  if (selectedId) {
    const content = resolveContent(selectedId, overrideOf(selectedId) ?? null);
    const isLocked = locked.includes(selectedId);
    const isHidden = hidden.includes(selectedId);
    const edited = !!overrideOf(selectedId);
    if (content) {
      const setField = (field: 'title' | 'body', loc: 'ar' | 'en', value: string) => onEditContent(selectedId, { [field]: { [loc]: value } } as ExperienceContentOverride);
      return (
        <div id="channel_inspector" data-channel={channel} data-selected={selectedId} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ display: 'grid', gap: 12 }} key={selectedId}>
          <div>
            <span style={lbl}>{L('تجربة محدّدة', 'Selected experience')}</span>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-on-surface)' }}>{selectedId.replace('flag.', '')}</h3>
          </div>

          {/* Layout ops for the selection */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button id="prop_toggle_hidden" onClick={() => onAction(selectedId, 'hide')} className="inline-flex items-center gap-1.5 cursor-pointer" style={{ ...card, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: isHidden ? '#f87171' : 'var(--color-on-surface)' }}>
              {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}{isHidden ? L('مخفي', 'Hidden') : L('ظاهر', 'Visible')}
            </button>
            <button id="prop_toggle_lock" onClick={() => onAction(selectedId, 'lock')} className="inline-flex items-center gap-1.5 cursor-pointer" style={{ ...card, padding: '6px 10px', fontSize: 11.5, fontWeight: 700, color: isLocked ? '#f5a623' : 'var(--color-on-surface)' }}>
              {isLocked ? <Lock size={13} /> : <LockOpen size={13} />}{isLocked ? L('مقفل', 'Locked') : L('مفتوح', 'Unlocked')}
            </button>
          </div>

          {/* Content properties — bound to the shared store (reaches the live app) */}
          <div style={{ ...card, padding: 12, display: 'grid', gap: 10, opacity: isLocked ? 0.55 : 1, pointerEvents: isLocked ? 'none' : 'auto' }}>
            <p className="text-[11px] font-bold" style={{ margin: 0, color: 'var(--color-on-surface)' }}>{L('المحتوى', 'Content')}</p>
            <div>
              <label style={lbl} htmlFor="prop_title_en">{L('العنوان (إنجليزي)', 'Title (EN)')}</label>
              <input id="prop_title_en" style={field} value={content.title.en} onChange={e => setField('title', 'en', e.target.value)} />
            </div>
            <div>
              <label style={lbl} htmlFor="prop_title_ar">{L('العنوان (عربي)', 'Title (AR)')}</label>
              <input id="prop_title_ar" style={field} dir="rtl" value={content.title.ar} onChange={e => setField('title', 'ar', e.target.value)} />
            </div>
            {content.kind === 'banner' && (<>
              <div>
                <label style={lbl} htmlFor="prop_body_en">{L('النص (إنجليزي)', 'Body (EN)')}</label>
                <textarea id="prop_body_en" rows={2} style={{ ...field, resize: 'vertical' }} value={content.body?.en ?? ''} onChange={e => setField('body', 'en', e.target.value)} />
              </div>
              <div>
                <label style={lbl} htmlFor="prop_body_ar">{L('النص (عربي)', 'Body (AR)')}</label>
                <textarea id="prop_body_ar" rows={2} dir="rtl" style={{ ...field, resize: 'vertical' }} value={content.body?.ar ?? ''} onChange={e => setField('body', 'ar', e.target.value)} />
              </div>
            </>)}
            <div>
              <label style={lbl} htmlFor="prop_icon">{L('الأيقونة', 'Icon')}</label>
              <select id="prop_icon" style={field} value={content.icon} onChange={e => onEditContent(selectedId, { icon: e.target.value })}>
                {EXPERIENCE_ICON_NAMES.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
          </div>

          <button id="prop_reset" onClick={() => onResetContent(selectedId)} disabled={!edited}
            className="w-full flex items-center justify-center gap-2 cursor-pointer"
            style={{ ...card, padding: '9px 12px', fontSize: 12, fontWeight: 700, color: 'var(--color-on-surface)', opacity: edited ? 1 : 0.45 }}>
            <RotateCcw size={13} />{L('إرجاع إلى الافتراضي', 'Reset to default')}
          </button>

          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.5, color: 'var(--color-on-surface-variant)' }}>
            {L('التعديلات تُحفظ فوراً وتظهر في التطبيق الحيّ عبر نفس مصدر المحتوى.', 'Edits save instantly and appear in the live app through the same content source.')}
          </p>
        </div>
      );
    }
  }

  // ── Default: screen overview + engine decision (no selection) ──
  return (
    <div id="channel_inspector" data-channel={channel} dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ display: 'grid', gap: 14 }}>
      <div>
        <span style={lbl}>{L(def?.ar ?? '', def?.en ?? '')}</span>
        <h3 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 800, color: 'var(--color-on-surface)' }}>{L(screen?.ar ?? '', screen?.en ?? '')}</h3>
        {screen?.en_desc && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--color-on-surface-variant)' }}>{screen.en_desc}</p>}
        <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('انقر تجربة في المعاينة لتحريرها.', 'Click an experience in the preview to edit it.')}</p>
      </div>

      <div style={{ ...card, padding: 12 }}>
        <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--color-on-surface)' }}>{L('مكوّنات القناة', 'Channel components')}</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {palette.map(p => (
            <span key={p.en} className="inline-flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 700, padding: '5px 10px', borderRadius: 999, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface-variant)' }}>
              <p.icon size={13} />{L(p.ar, p.en)}
            </span>
          ))}
        </div>
      </div>

      <div style={{ ...card, padding: 12 }}>
        <p className="text-[11px] font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--color-on-surface)' }}>
          <Sparkles size={13} style={{ color: 'var(--color-primary-fixed,#a3f95b)' }} />{L('تجارب هذه الشاشة', 'Experiences on this screen')}
        </p>
        {decision.all.length === 0 ? (
          <p style={{ fontSize: 11.5, color: 'var(--color-on-surface-variant)' }}>{L('لا تجارب مُعرّفة لهذه الشاشة بعد.', 'No experiences are defined for this screen yet.')}</p>
        ) : (
          <div style={{ display: 'grid', gap: 6 }}>
            {decision.all.map(id => {
              const state = decision.selected.includes(id) ? 'shown' : decision.eligible.includes(id) ? 'eligible' : 'off';
              const color = state === 'shown' ? '#4ade80' : state === 'eligible' ? '#f5a623' : 'var(--color-on-surface-variant)';
              return (
                <div key={id} className="flex items-center gap-2" style={{ fontSize: 11.5, padding: '7px 9px', borderRadius: 9, background: 'var(--color-surface-container-high)' }}>
                  {state === 'off' ? <MinusCircle size={13} color={color} /> : <CheckCircle2 size={13} color={color} />}
                  <code style={{ fontSize: 11, color: 'var(--color-on-surface)', flex: 1 }}>{id.replace('flag.', '')}</code>
                  <span style={{ fontSize: 10, fontWeight: 800, color }}>{state === 'shown' ? L('معروضة', 'shown') : state === 'eligible' ? L('مؤهّلة', 'eligible') : L('معطّلة', 'off')}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={onOpenExperienceCenter} id="channel_open_experience_center"
        className="w-full flex items-center justify-center gap-2 cursor-pointer"
        style={{ ...card, padding: '10px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface)' }}>
        <ExternalLink size={14} />{L('تعديل الاستهداف في مركز التجربة', 'Edit targeting in the Experience Center')}
      </button>
    </div>
  );
};

export default ChannelInspector;
