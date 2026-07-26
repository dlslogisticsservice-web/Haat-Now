// ─────────────────────────────────────────────────────────────────────────────
// Motion Studio (Phase 8J).
//
// A professional motion editor inside the Website/Application Studio for the entry screens. It
// drives ONE MotionStore (layers / timeline / effects / presets) and projects it onto the live
// EntryExperience runtime renderer via CSS custom properties — no second rendering system. The
// device frame previews desktop/tablet/phone × portrait/landscape × dark/light with status/nav
// bars and safe areas. ▶ Simulate App Launch runs the REAL runtime boot sequence.
//
// The Publish pipeline + Versioning UI (MotionPublishPanel) lives in the right rail and shares the
// same MotionStore + PublishEngine. Session-only; no persistence.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useRef, useState } from 'react';
import {
  Eye, EyeOff, Lock, LockOpen, Copy, ChevronUp, ChevronDown, Layers as LayersIcon, Clock, Sparkles, Wand2,
  Play, Monitor, Tablet, Smartphone, RotateCw, Sun, Moon, Plus, Trash2, PackageCheck, CheckCircle2,
  UploadCloud, History, GitCompare, RotateCcw, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { EntryExperience } from '../../../experience-entry/EntryExperience';
import type { EntryKind } from '../../../experience-entry/entryModel';
import type { MotionStore } from '../../../experience-entry/motion/MotionStore';
import type { PublishEngine } from '../../../experience-entry/motion/PublishEngine';
import type { VisualEffects, TimelineStep } from '../../../experience-entry/motion/motionModel';
import { BootSimulator } from './BootSimulator';

const card: React.CSSProperties = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline-variant)', borderRadius: 12 };
const lbl: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: 'var(--color-on-surface-variant)' };
const iconBtn: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', cursor: 'pointer' };
const seg = (on: boolean): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, background: on ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: on ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' });

const DEVICE_DIM: Record<string, { w: number; h: number }> = { desktop: { w: 760, h: 470 }, tablet: { w: 500, h: 660 }, phone: { w: 300, h: 620 } };
const EFFECT_LABELS: [keyof VisualEffects, string, string][] = [
  ['animatedGradient', 'تدرّج متحرّك', 'Animated Gradient'], ['glow', 'توهّج', 'Glow'], ['particles', 'جزيئات', 'Particles'],
  ['noise', 'ضجيج', 'Noise'], ['mesh', 'تدرّج شبكي', 'Mesh Gradient'], ['glass', 'زجاجي', 'Glass Morphism'],
  ['shadow', 'ظلّ', 'Shadow'], ['innerShadow', 'ظلّ داخلي', 'Inner Shadow'], ['borderGlow', 'توهّج الحدود', 'Border Glow'],
  ['animatedBorder', 'حدود متحرّكة', 'Animated Border'], ['ripple', 'تموّج', 'Ripple'], ['pulse', 'نبض', 'Pulse'],
  ['floating', 'طفو', 'Floating'], ['parallax', 'بارالاكس', 'Parallax'],
];

export const MotionStudio: React.FC<{ kind: EntryKind; lang: 'ar' | 'en'; store: MotionStore; publish: PublishEngine }> = ({ kind, lang, store }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [tab, setTab] = useState<'layers' | 'timeline' | 'effects' | 'presets'>('layers');
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'phone'>('phone');
  const [orient, setOrient] = useState<'portrait' | 'landscape'>('portrait');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [chrome, setChrome] = useState({ status: true, nav: true, safe: true });
  const [sim, setSim] = useState(false);
  const [stepId, setStepId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  // Subscribe LOCALLY to the store (Phase 8K) so a motion edit re-renders only this subtree, not
  // the entire WebsiteCenter tree — no unnecessary renders.
  const [rev, setRev] = useState(0);
  useEffect(() => store.subscribe(() => setRev(r => r + 1)), [store]);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => { store.setKind(kind); }, [kind, store]);
  // Project the motion model onto the live entry renderer after every change / remount.
  useEffect(() => { store.project(hostRef.current?.querySelector('#entry_experience') ?? null); }, [rev, kind, device, orient, store]);

  const model = store.getModel();
  const dim = DEVICE_DIM[device];
  const w = orient === 'landscape' ? dim.h : dim.w;
  const h = orient === 'landscape' ? dim.w : dim.h;

  return (
    <div id="motion_studio" data-kind={kind} style={{ display: 'flex', gap: 12, width: '100%', alignItems: 'flex-start' }}>
      {/* ── Device preview column ── */}
      <div style={{ display: 'grid', gap: 8, justifyItems: 'center' }}>
        {/* toolbar */}
        <div style={{ ...card, padding: 6, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button id="motion_device_desktop" onClick={() => setDevice('desktop')} style={seg(device === 'desktop')}><Monitor size={13} /></button>
          <button id="motion_device_tablet" onClick={() => setDevice('tablet')} style={seg(device === 'tablet')}><Tablet size={13} /></button>
          <button id="motion_device_phone" onClick={() => setDevice('phone')} style={seg(device === 'phone')}><Smartphone size={13} /></button>
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          <button id="motion_orient" onClick={() => setOrient(o => (o === 'portrait' ? 'landscape' : 'portrait'))} style={seg(orient === 'landscape')}><RotateCw size={13} />{orient === 'portrait' ? L('طولي', 'Portrait') : L('عرضي', 'Landscape')}</button>
          <button id="motion_theme" onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))} style={seg(theme === 'light')}>{theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}</button>
          <button id="motion_chrome_safe" onClick={() => setChrome(c => ({ ...c, safe: !c.safe }))} style={seg(chrome.safe)}>{L('آمن', 'Safe')}</button>
          <span style={{ width: 1, height: 18, background: 'var(--color-outline-variant)' }} />
          <button id="motion_sim_btn" onClick={() => setSim(true)} style={{ ...seg(false), background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Play size={13} />{L('محاكاة الإقلاع', 'Simulate App Launch')}</button>
        </div>
        {/* device frame */}
        <div id="motion_device_frame" data-device={device} data-orient={orient} data-theme={theme}
          style={{ width: w + 20, height: h + 20, padding: 10, borderRadius: 34, background: theme === 'light' ? '#e7ebe8' : '#05070a', boxShadow: '0 30px 90px -34px rgba(0,0,0,.8)', position: 'relative' }}>
          <div ref={hostRef} style={{ width: w, height: h, borderRadius: 26, overflow: 'hidden', position: 'relative', background: '#05070a' }}>
            {chrome.status && <div id="motion_statusbar" style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 14px', fontSize: 10, fontWeight: 700, color: '#fff', pointerEvents: 'none' }}><span>9:41</span><span>▂▄▆ 5G ▮</span></div>}
            {chrome.safe && <div style={{ position: 'absolute', inset: 0, zIndex: 19, pointerEvents: 'none', border: '1px dashed rgba(163,249,91,.28)', margin: 8, borderRadius: 22 }} />}
            <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
              <EntryExperience key={kind} kind={kind} />
            </div>
            {chrome.nav && <div id="motion_navbar" style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', width: 110, height: 4, borderRadius: 999, background: 'rgba(255,255,255,.6)', zIndex: 20, pointerEvents: 'none' }} />}
          </div>
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{device} · {orient} · {theme} · {w}×{h}</span>
      </div>

      {/* ── Editor column ── */}
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {([['layers', LayersIcon, L('الطبقات', 'Layers')], ['timeline', Clock, L('الخطّ الزمني', 'Timeline')], ['effects', Sparkles, L('التأثيرات', 'Effects')], ['presets', Wand2, L('القوالب', 'Presets')]] as const).map(([id, Icon, label]) => (
            <button key={id} id={`motion_tab_${id}`} onClick={() => setTab(id)} style={seg(tab === id)}><Icon size={13} />{label}</button>
          ))}
        </div>

        {/* LAYERS */}
        {tab === 'layers' && (
          <div style={{ ...card, padding: 10, display: 'grid', gap: 5 }} id="motion_layers">
            {model.layers.map((ly) => (
              <div key={ly.id} className="motion-layer" data-layer-id={ly.id} data-kind={ly.kind} data-visible={ly.visible ? '1' : '0'} data-locked={ly.locked ? '1' : '0'}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 7px', borderRadius: 8, background: 'var(--color-surface-container-high)' }}>
                <button id={`layer_vis_${ly.id}`} className="layer-vis" data-kind={ly.kind} onClick={() => store.toggleVisible(ly.id)} title={L('إظهار/إخفاء', 'Show/hide')} style={{ ...iconBtn, width: 22, height: 22, opacity: ly.visible ? 1 : 0.5 }}>{ly.visible ? <Eye size={12} /> : <EyeOff size={12} />}</button>
                <button id={`layer_lock_${ly.id}`} className="layer-lock" data-kind={ly.kind} onClick={() => store.toggleLock(ly.id)} title={L('قفل', 'Lock')} style={{ ...iconBtn, width: 22, height: 22 }}>{ly.locked ? <Lock size={12} /> : <LockOpen size={12} />}</button>
                {renaming === ly.id
                  ? <input autoFocus defaultValue={ly.name} id={`layer_name_${ly.id}`} onBlur={e => { store.rename(ly.id, e.target.value); setRenaming(null); }} onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} style={{ flex: 1, fontSize: 11.5, padding: '2px 6px', borderRadius: 6, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container)', color: 'var(--color-on-surface)' }} />
                  : <span onDoubleClick={() => setRenaming(ly.id)} style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: 'var(--color-on-surface)' }}>{ly.name}</span>}
                <button id={`layer_rename_${ly.id}`} className="layer-rename" data-kind={ly.kind} onClick={() => setRenaming(ly.id)} title={L('إعادة تسمية', 'Rename')} style={{ ...iconBtn, width: 22, height: 22, fontSize: 9 }}>Aa</button>
                <button id={`layer_dup_${ly.id}`} className="layer-dup" data-kind={ly.kind} onClick={() => store.duplicate(ly.id)} title={L('تكرار', 'Duplicate')} style={{ ...iconBtn, width: 22, height: 22 }}><Copy size={11} /></button>
                <button id={`layer_up_${ly.id}`} className="layer-up" data-kind={ly.kind} onClick={() => store.reorder(ly.id, -1)} title={L('لأعلى', 'Up')} style={{ ...iconBtn, width: 22, height: 22 }}><ChevronUp size={12} /></button>
                <button id={`layer_down_${ly.id}`} className="layer-down" data-kind={ly.kind} onClick={() => store.reorder(ly.id, 1)} title={L('لأسفل', 'Down')} style={{ ...iconBtn, width: 22, height: 22 }}><ChevronDown size={12} /></button>
              </div>
            ))}
          </div>
        )}

        {/* TIMELINE */}
        {tab === 'timeline' && (
          <div style={{ ...card, padding: 10, display: 'grid', gap: 8 }} id="motion_timeline">
            <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
              {model.timeline.map((s) => (
                <button key={s.id} className="timeline-step" data-step={s.id} data-effect={s.effect} onClick={() => setStepId(s.id)}
                  style={{ flexShrink: 0, display: 'grid', gap: 2, padding: '6px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'start', border: stepId === s.id ? '1px solid var(--color-primary-fixed)' : '1px solid var(--color-outline-variant)', background: stepId === s.id ? 'color-mix(in srgb,var(--color-primary-fixed) 18%,transparent)' : 'var(--color-surface-container-high)' }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-on-surface)' }}>{s.label}</span>
                  <span style={{ fontSize: 9, color: 'var(--color-on-surface-variant)' }}>{s.at}s · {s.duration}ms</span>
                </button>
              ))}
              <button id="timeline_add" onClick={() => store.addStep()} style={{ ...iconBtn, flexShrink: 0, width: 30, height: 'auto' }}><Plus size={14} /></button>
            </div>
            {(() => {
              const s = model.timeline.find(t => t.id === stepId) ?? model.timeline[0];
              if (!s) return null;
              const num = (k: keyof TimelineStep, min: number, max: number, step: number, unit = '') => (
                <label style={{ display: 'grid', gap: 3 }}>
                  <span style={lbl}>{k}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input id={`step_${String(k)}`} type="range" min={min} max={max} step={step} value={s[k] as number} onChange={e => store.updateStep(s.id, { [k]: parseFloat(e.target.value) } as Partial<TimelineStep>)} style={{ flex: 1, accentColor: 'var(--color-primary-fixed,#a3f95b)' }} />
                    <span style={{ fontSize: 10, minWidth: 42, textAlign: 'end', color: 'var(--color-on-surface)' }}>{s[k] as number}{unit}</span>
                  </span>
                </label>
              );
              return (
                <div id="motion_step_editor" data-step={s.id} style={{ display: 'grid', gap: 7, gridTemplateColumns: '1fr 1fr' }}>
                  {num('duration', 100, 4000, 50, 'ms')}
                  {num('delay', 0, 3000, 50, 'ms')}
                  {num('opacity', 0, 1, 0.05)}
                  {num('scale', 0.2, 2, 0.05)}
                  {num('rotate', -180, 180, 5, '°')}
                  {num('translate', -100, 100, 2, 'px')}
                  {num('blur', 0, 30, 1, 'px')}
                  {num('glow', 0, 1, 0.05)}
                  {num('repeat', -1, 5, 1)}
                  <label style={{ display: 'grid', gap: 3 }}>
                    <span style={lbl}>curve</span>
                    <select id="step_curve" value={s.curve} onChange={e => store.updateStep(s.id, { curve: e.target.value })} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                      {['ease-out', 'ease-in-out', 'linear', 'cubic-bezier(.22,1,.36,1)', 'cubic-bezier(.34,1.56,.64,1)'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'grid', gap: 3 }}>
                    <span style={lbl}>direction</span>
                    <select id="step_direction" value={s.direction} onChange={e => store.updateStep(s.id, { direction: e.target.value as TimelineStep['direction'] })} style={{ fontSize: 11, padding: '4px 6px', borderRadius: 7, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>
                      {['normal', 'reverse', 'alternate'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <button id="step_remove" onClick={() => { store.removeStep(s.id); setStepId(null); }} style={{ ...seg(false), color: '#ff6b6b', gridColumn: '1 / -1' }}><Trash2 size={12} />{L('حذف الخطوة', 'Remove step')}</button>
                </div>
              );
            })()}
          </div>
        )}

        {/* EFFECTS */}
        {tab === 'effects' && (
          <div style={{ ...card, padding: 10, display: 'grid', gap: 6 }} id="motion_effects">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {EFFECT_LABELS.map(([key, ar, en]) => {
                const on = model.effects[key] as boolean;
                return (
                  <button key={key} id={`fx_${key}`} data-on={on ? '1' : '0'} onClick={() => store.toggleEffect(key)}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 9px', borderRadius: 8, cursor: 'pointer', border: on ? '1px solid var(--color-primary-fixed)' : '1px solid var(--color-outline-variant)', background: on ? 'color-mix(in srgb,var(--color-primary-fixed) 16%,transparent)' : 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', fontSize: 11, fontWeight: 700 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: on ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-outline-variant)' }} />{L(ar, en)}
                  </button>
                );
              })}
            </div>
            <label style={{ display: 'grid', gap: 3, marginTop: 4 }}><span style={lbl}>{L('التمويه', 'Blur')}: {model.effects.blur}px</span>
              <input id="fx_blur_range" type="range" min={0} max={20} step={1} value={model.effects.blur} onChange={e => store.setEffectValue('blur', parseFloat(e.target.value))} style={{ accentColor: 'var(--color-primary-fixed,#a3f95b)' }} /></label>
            <label style={{ display: 'grid', gap: 3 }}><span style={lbl}>{L('الشفافية', 'Opacity')}: {model.effects.opacity}</span>
              <input id="fx_opacity_range" type="range" min={0} max={1} step={0.05} value={model.effects.opacity} onChange={e => store.setEffectValue('opacity', parseFloat(e.target.value))} style={{ accentColor: 'var(--color-primary-fixed,#a3f95b)' }} /></label>
          </div>
        )}

        {/* PRESETS */}
        {tab === 'presets' && (
          <div style={{ ...card, padding: 10, display: 'grid', gap: 7 }} id="motion_presets">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {store.allPresets().map((p) => (
                <div key={p.id} className="preset-card" data-preset={p.id} data-active={model.presetId === p.id ? '1' : '0'}
                  style={{ display: 'grid', gap: 5, padding: 8, borderRadius: 9, border: model.presetId === p.id ? '1px solid var(--color-primary-fixed)' : '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)' }}>
                  <span style={{ height: 22, borderRadius: 6, background: `linear-gradient(90deg, ${p.vars['--entry-grad-a'] ?? '#0b3d24'}, ${p.vars['--entry-glow-color'] ?? '#a3f95b'})` }} />
                  <span style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--color-on-surface)' }}>{p.name}{!p.builtIn && ' ·'}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button id={`preset_apply_${p.id}`} onClick={() => store.applyPreset(p.id)} style={{ ...seg(model.presetId === p.id), flex: 1, justifyContent: 'center', fontSize: 10 }}>{L('تطبيق', 'Apply')}</button>
                    <button id={`preset_dup_${p.id}`} onClick={() => store.duplicatePreset(p.id)} title={L('تكرار', 'Duplicate')} style={{ ...iconBtn, width: 24, height: 24 }}><Copy size={11} /></button>
                  </div>
                </div>
              ))}
            </div>
            <button id="preset_save" onClick={() => store.savePreset(`Custom ${store.customPresets().length + 1}`)} style={{ ...seg(false) }}><Plus size={12} />{L('حفظ الحالة كقالب', 'Save current as preset')}</button>
          </div>
        )}
      </div>

      {sim && <BootSimulator lang={lang} onClose={() => setSim(false)} />}
    </div>
  );
};

// ── Publish pipeline + Versioning (right rail) ──────────────────────────────────
export const MotionPublishPanel: React.FC<{ kind: EntryKind; lang: 'ar' | 'en'; store: MotionStore; publish: PublishEngine }> = ({ kind, lang, store, publish }) => {
  const L = (a: string, e: string) => (lang === 'ar' ? a : e);
  const [notes, setNotes] = useState('');
  const [report, setReport] = useState<{ valid: boolean; errors: string[] } | null>(null);
  const [cmp, setCmp] = useState<string[]>([]);
  // Subscribe locally (Phase 8K) — the publish panel re-renders on its own, decoupled from WebsiteCenter.
  const [, setRev] = useState(0);
  useEffect(() => publish.subscribe(() => setRev(r => r + 1)), [publish]);
  // A candidate only counts for the screen currently being edited; versions are scoped by kind.
  const rawCand = publish.currentCandidate();
  const cand = rawCand && rawCand.kind === kind ? rawCand : null;
  const versions = publish.history(kind);

  const PIPE = ['draft', 'validation', 'candidate', 'approved', 'published', 'rollback'] as const;
  const pipeActive = (s: string) => {
    if (s === 'draft') return true;
    if (s === 'validation') return report != null;
    if (s === 'candidate') return !!cand;
    if (s === 'approved') return cand?.status === 'approved';
    if (s === 'published') return versions.some(v => v.status === 'published' || v.status === 'rolledback');
    if (s === 'rollback') return versions.some(v => v.status === 'rolledback');
    return false;
  };

  const diff = cmp.length === 2 ? publish.compare(cmp[0], cmp[1]) : [];

  return (
    <div id="motion_publish" style={{ display: 'grid', gap: 10 }}>
      {/* pipeline */}
      <div style={{ ...card, padding: 10, display: 'grid', gap: 8 }}>
        <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5 }}><UploadCloud size={12} />{L('خط النشر', 'Publish pipeline')}</p>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          {PIPE.map((s, i) => (
            <span key={s} id={`pipe_${s}`} data-active={pipeActive(s) ? '1' : '0'} style={{ fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 999, background: pipeActive(s) ? 'color-mix(in srgb,var(--color-primary-fixed) 22%,transparent)' : 'var(--color-surface-container-high)', color: pipeActive(s) ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant)' }}>{s}{i < PIPE.length - 1 ? ' ›' : ''}</span>
          ))}
        </div>
        {report && !report.valid && (
          <span id="publish_validation" className="rt-invalid" style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 4, fontSize: 10, fontWeight: 700, color: '#ff6b6b' }}><AlertTriangle size={11} />{report.errors.join(' · ')}</span>
        )}
        {report && report.valid && <span id="publish_validation" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: 'var(--color-primary-fixed,#a3f95b)' }}><ShieldCheck size={11} />{L('صالح', 'Valid')}</span>}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button id="publish_candidate_btn" onClick={() => { const r = publish.createCandidate(store.snapshot(), kind); setReport(r.report); }} style={{ ...seg(false) }}><PackageCheck size={12} />{L('مرشّح', 'Candidate')}</button>
          <button id="publish_approve_btn" disabled={!cand || cand.status === 'approved'} onClick={() => publish.approve()} style={{ ...seg(cand?.status === 'approved'), opacity: cand && cand.status !== 'approved' ? 1 : 0.5 }}><CheckCircle2 size={12} />{L('اعتماد', 'Approve')}</button>
        </div>
        <input id="publish_notes" value={notes} onChange={e => setNotes(e.target.value)} placeholder={L('ملاحظات النشر…', 'Publish notes…')} style={{ fontSize: 11, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--color-outline-variant)', background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }} />
        <div style={{ display: 'flex', gap: 6 }}>
          <button id="publish_btn" disabled={cand?.status !== 'approved'} onClick={() => { publish.publish(notes); setNotes(''); setReport(null); }}
            style={{ ...seg(false), flex: 1, justifyContent: 'center', background: cand?.status === 'approved' ? 'var(--color-primary-fixed)' : 'var(--color-surface-container-high)', color: cand?.status === 'approved' ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)', cursor: cand?.status === 'approved' ? 'pointer' : 'not-allowed' }}><UploadCloud size={12} />{L('نشر', 'Publish')}</button>
          <button id="publish_rollback_btn" disabled={versions.filter(v => v.status === 'published' || v.status === 'rolledback').length < 2} onClick={() => publish.rollback(kind)} style={{ ...seg(false) }}><RotateCcw size={12} />{L('تراجع', 'Rollback')}</button>
        </div>
      </div>

      {/* version history */}
      <div style={{ ...card, padding: 10, display: 'grid', gap: 6 }} id="motion_versions" data-count={versions.length}>
        <p style={{ margin: 0, ...lbl, display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><History size={12} />{L('سجلّ الإصدارات', 'Version history')}</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-on-surface-variant)' }}>{versions.length}</span>
        </p>
        {versions.length ? versions.map((v) => (
          <div key={v.id} className="version-row" data-version={v.id} data-status={v.status} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, padding: '5px 7px', borderRadius: 8, background: 'var(--color-surface-container-high)' }}>
            <span style={{ fontFamily: 'ui-monospace,monospace', color: 'var(--color-on-surface-variant)' }}>{v.id}</span>
            <span style={{ fontWeight: 700, color: 'var(--color-on-surface)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.notes || v.status}</span>
            <span style={{ fontSize: 8.5, padding: '1px 5px', borderRadius: 999, background: 'var(--color-surface-container)', color: v.status === 'rolledback' ? '#ffb454' : 'var(--color-primary-fixed,#a3f95b)' }}>{v.status}</span>
            <button className="version-restore" data-restore={v.id} onClick={() => { const s = publish.restore(v.id); if (s) store.restore(s); }} title={L('استرجاع', 'Restore')} style={{ ...iconBtn, width: 22, height: 22 }}><RotateCcw size={10} /></button>
            <button className="version-compare" data-compare={v.id} onClick={() => setCmp(c => (c.includes(v.id) ? c.filter(x => x !== v.id) : [...c, v.id].slice(-2)))} title={L('مقارنة', 'Compare')} style={{ ...iconBtn, width: 22, height: 22, outline: cmp.includes(v.id) ? '1px solid var(--color-primary-fixed)' : 'none' }}><GitCompare size={10} /></button>
          </div>
        )) : <span style={{ fontSize: 10.5, color: 'var(--color-on-surface-variant)' }}>{L('لا إصدارات بعد — انشر مسودّة.', 'No versions yet — publish a draft.')}</span>}
        {diff.length > 0 && (
          <div id="version_diff" style={{ display: 'grid', gap: 3, marginTop: 4, paddingTop: 6, borderTop: '1px solid var(--color-outline-variant)' }}>
            <span style={lbl}>{L('الفروقات', 'Diff')} {cmp[0]} → {cmp[1]}</span>
            {diff.slice(0, 10).map((d, i) => (
              <div key={i} className="diff-line" style={{ fontSize: 9.5, display: 'flex', gap: 6 }}>
                <code style={{ color: 'var(--color-on-surface-variant)' }}>{d.field}</code>
                <span style={{ color: '#ff8f8f' }}>{d.from}</span>→<span style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>{d.to}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MotionStudio;
