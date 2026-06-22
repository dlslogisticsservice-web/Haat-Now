import { useState } from 'react';
import { useDesign } from '../../design/DesignContext';
import { DesignConfig } from '../../design/designSystem';
import { Eye, Save, UploadCloud, RotateCcw, Trash2, Smartphone, Tablet, Monitor, Check } from 'lucide-react';
import { ExperienceBuilder } from './ExperienceBuilder';
import { AssetsManager } from './AssetsManager';
import { CountryBranding } from './CountryBranding';

const ACCENT = 'var(--color-primary-fixed)';
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.85rem', padding: '14px' };
const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '6px' };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: '10px' }}><span style={lbl}>{label}</span>{children}</div>;
}
function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="flex items-center gap-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: '40px', height: '32px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', background: 'none', cursor: 'pointer' }} />
        <input value={value} onChange={e => onChange(e.target.value)} dir="ltr" style={{ flex: 1, height: '32px', borderRadius: '8px', padding: '0 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '12px' }} />
      </div>
    </Field>
  );
}
function Slider({ label, value, min, max, step, onChange, unit }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string }) {
  return (
    <Field label={`${label} — ${value}${unit || ''}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#a3f95b' }} />
    </Field>
  );
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ width: '100%', height: '34px', borderRadius: '8px', padding: '0 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px' }}>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </Field>
  );
}
function Text({ label, value, onChange, ph }: { label: string; value: string; onChange: (v: string) => void; ph?: string }) {
  return (
    <Field label={label}>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={ph} dir="ltr" style={{ width: '100%', height: '34px', borderRadius: '8px', padding: '0 8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '12px' }} />
    </Field>
  );
}

const SECTIONS = ['الثيم', 'الخطوط', 'البطاقات', 'الأزرار', 'الأيقونات', 'التخطيط', 'الهوية', 'الحركات', 'النشر', 'منشئ التجارب', 'الأصول', 'هوية الدول'] as const;
const EXP_SECTIONS = ['منشئ التجارب', 'الأصول', 'هوية الدول'] as readonly string[];
const DEVICE = { mobile: 393, tablet: 768, desktop: 1100 } as const;

export function DesignCenter() {
  const d = useDesign();
  const cfg = d.draftConfig;
  const [section, setSection] = useState<typeof SECTIONS[number]>('الثيم');
  const [scope, setScope] = useState<'base' | 'country'>('base');
  const [device, setDevice] = useState<keyof typeof DEVICE>('mobile');
  const [saved, setSaved] = useState(false);

  // set helper: patch one key inside one section of the draft
  const set = <K extends keyof DesignConfig>(sec: K, key: keyof DesignConfig[K], v: any) =>
    d.patchDraft(scope, { [sec]: { [key]: v } } as Partial<DesignConfig>);

  const flash = () => { setSaved(true); setTimeout(() => setSaved(false), 1500); };
  const isExp = EXP_SECTIONS.includes(section);

  return (
    <div id="admin_design_tab" className={`grid grid-cols-1 ${isExp ? '' : 'lg:grid-cols-[1fr_360px]'} gap-5`}>
      {/* ── Controls ── */}
      <div className="space-y-4">
        {/* scope + section tabs */}
        <div style={card}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-2">
              {(['base', 'country'] as const).map(s => (
                <button key={s} onClick={() => setScope(s)} style={{ fontSize: '12px', fontWeight: 700, padding: '5px 10px', borderRadius: '8px', cursor: 'pointer', background: scope === s ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.03)', border: scope === s ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.07)', color: scope === s ? ACCENT : 'white' }}>
                  {s === 'base' ? 'عام (كل الدول)' : `خاص بـ ${d.country}`}
                </button>
              ))}
            </div>
            <h3 className="text-title-md font-bold text-white">مركز التصميم</h3>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SECTIONS.map(s => (
              <button key={s} onClick={() => setSection(s)} style={{ fontSize: '12px', fontWeight: 600, padding: '5px 10px', borderRadius: '999px', cursor: 'pointer', background: section === s ? ACCENT : 'rgba(255,255,255,0.03)', color: section === s ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)', border: 'none' }}>{s}</button>
            ))}
          </div>
        </div>

        <div style={card}>
          {section === 'الثيم' && (<>
            <Color label="اللون الأساسي (Primary)" value={cfg.colors.primary} onChange={v => set('colors', 'primary', v)} />
            <Color label="الثانوي (Secondary)" value={cfg.colors.secondary} onChange={v => set('colors', 'secondary', v)} />
            <Color label="التمييز (Accent)" value={cfg.colors.accent} onChange={v => set('colors', 'accent', v)} />
            <Color label="نجاح (Success)" value={cfg.colors.success} onChange={v => set('colors', 'success', v)} />
            <Color label="تحذير (Warning)" value={cfg.colors.warning} onChange={v => set('colors', 'warning', v)} />
            <Color label="خطر (Danger)" value={cfg.colors.danger} onChange={v => set('colors', 'danger', v)} />
            <Slider label="شفافية الزجاج (Glass)" value={cfg.glass.intensity} min={0} max={48} step={1} unit="px" onChange={v => set('glass', 'intensity', v)} />
            <Slider label="شفافية الحدود" value={cfg.glass.borderOpacity} min={0} max={0.4} step={0.01} onChange={v => set('glass', 'borderOpacity', v)} />
          </>)}
          {section === 'الخطوط' && (<>
            <Select label="عائلة الخط" value={cfg.typography.fontFamily} options={['Cairo', 'Tajawal', 'Inter', 'Almarai', 'IBM Plex Sans Arabic']} onChange={v => set('typography', 'fontFamily', v)} />
            <Slider label="مقياس الخط العام" value={cfg.typography.fontScale} min={0.85} max={1.25} step={0.01} onChange={v => set('typography', 'fontScale', v)} />
            <Slider label="مقياس العناوين" value={cfg.typography.headerScale} min={0.85} max={1.4} step={0.01} onChange={v => set('typography', 'headerScale', v)} />
            <Slider label="مقياس النص" value={cfg.typography.bodyScale} min={0.85} max={1.25} step={0.01} onChange={v => set('typography', 'bodyScale', v)} />
            <Slider label="وزن الخط" value={cfg.typography.weight} min={300} max={800} step={100} onChange={v => set('typography', 'weight', v)} />
            <Slider label="تباعد الأحرف" value={cfg.typography.letterSpacing} min={-0.03} max={0.08} step={0.005} unit="em" onChange={v => set('typography', 'letterSpacing', v)} />
            <Slider label="ارتفاع السطر" value={cfg.typography.lineHeight} min={1.1} max={2} step={0.05} onChange={v => set('typography', 'lineHeight', v)} />
          </>)}
          {section === 'البطاقات' && (<>
            <Slider label="نصف القطر (Radius)" value={cfg.cards.radius} min={0} max={40} step={1} unit="px" onChange={v => set('cards', 'radius', v)} />
            <Slider label="مستوى الظل" value={cfg.cards.shadow} min={0} max={5} step={1} onChange={v => set('cards', 'shadow', v)} />
            <Slider label="الحشو (Padding)" value={cfg.cards.padding} min={8} max={28} step={1} unit="px" onChange={v => set('cards', 'padding', v)} />
            <Select label="الكثافة" value={cfg.cards.density} options={['compact', 'standard', 'premium']} onChange={v => set('cards', 'density', v)} />
          </>)}
          {section === 'الأزرار' && (<>
            <Slider label="نصف القطر" value={cfg.buttons.radius} min={0} max={28} step={1} unit="px" onChange={v => set('buttons', 'radius', v)} />
            <Slider label="الارتفاع" value={cfg.buttons.height} min={36} max={56} step={1} unit="px" onChange={v => set('buttons', 'height', v)} />
            <Select label="الكثافة" value={cfg.buttons.density} options={['compact', 'standard', 'comfortable']} onChange={v => set('buttons', 'density', v)} />
          </>)}
          {section === 'الأيقونات' && (<>
            <Slider label="الحجم" value={cfg.icons.size} min={14} max={32} step={1} unit="px" onChange={v => set('icons', 'size', v)} />
            <Slider label="سمك الخط (Stroke)" value={cfg.icons.weight} min={1} max={3} step={0.1} onChange={v => set('icons', 'weight', v)} />
          </>)}
          {section === 'التخطيط' && (<>
            <Slider label="مقياس المسافات" value={cfg.layout.spacing} min={0.8} max={1.4} step={0.05} onChange={v => set('layout', 'spacing', v)} />
            <Slider label="فجوة الأقسام" value={cfg.layout.sectionGap} min={8} max={32} step={1} unit="px" onChange={v => set('layout', 'sectionGap', v)} />
            <Slider label="عرض الحاوية" value={cfg.layout.containerWidth} min={960} max={1600} step={20} unit="px" onChange={v => set('layout', 'containerWidth', v)} />
            <Select label="الكثافة" value={cfg.layout.density} options={['compact', 'comfortable']} onChange={v => set('layout', 'density', v)} />
          </>)}
          {section === 'الهوية' && (<>
            <Text label="شعار التطبيق (URL)" value={cfg.branding.appLogo} onChange={v => set('branding', 'appLogo', v)} ph="https://…/logo.png" />
            <Text label="شعار البداية (Splash)" value={cfg.branding.splashLogo} onChange={v => set('branding', 'splashLogo', v)} />
            <Text label="أيقونة الموقع (Favicon)" value={cfg.branding.favicon} onChange={v => set('branding', 'favicon', v)} />
            <Text label="الشعار الداكن" value={cfg.branding.darkLogo} onChange={v => set('branding', 'darkLogo', v)} />
            <Text label="الشعار الفاتح" value={cfg.branding.lightLogo} onChange={v => set('branding', 'lightLogo', v)} />
            <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>الصق رابط الصورة أو ارفعها عبر التخزين. الشعارات تُطبَّق حسب الدولة عند اختيار النطاق "خاص بـ {d.country}".</p>
          </>)}
          {section === 'الحركات' && (<>
            <Select label="الحركات" value={cfg.animations.enabled ? 'مفعّلة' : 'متوقفة'} options={['مفعّلة', 'متوقفة']} onChange={v => set('animations', 'enabled', v === 'مفعّلة')} />
            <Slider label="السرعة" value={cfg.animations.speed} min={0.5} max={2} step={0.1} onChange={v => set('animations', 'speed', v)} />
          </>)}
          {section === 'النشر' && (
            <div className="space-y-2">
              <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>الإصدارات المنشورة — يمكنك التراجع لأي إصدار سابق:</p>
              {d.versions.length === 0 && <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>لا توجد إصدارات بعد. انشر التغييرات لإنشاء أول إصدار.</p>}
              {d.versions.map(v => (
                <div key={v.id} className="flex items-center justify-between" style={{ ...card, padding: '10px 12px' }}>
                  <button onClick={() => d.rollback(v.id)} className="cursor-pointer flex items-center gap-1.5" style={{ fontSize: '12px', color: ACCENT, background: 'rgba(163,249,91,0.08)', border: '1px solid rgba(163,249,91,0.2)', borderRadius: '8px', padding: '5px 10px' }}><RotateCcw size={13} /> تراجع</button>
                  <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }} dir="ltr">{v.id} · {new Date(v.at).toLocaleString('ar-SA')}</span>
                </div>
              ))}
            </div>
          )}
          {section === 'منشئ التجارب' && <ExperienceBuilder />}
          {section === 'الأصول' && <AssetsManager />}
          {section === 'هوية الدول' && <CountryBranding />}
        </div>

        {/* actions (design tokens) — hidden for Experience sections which have their own publish */}
        {!isExp && <div className="flex flex-wrap gap-2">
          <button onClick={() => d.setPreviewing(!d.previewing)} id="design_preview_btn" className="flex items-center gap-1.5 cursor-pointer" style={{ height: '40px', padding: '0 14px', borderRadius: '0.7rem', background: d.previewing ? ACCENT : 'rgba(255,255,255,0.04)', color: d.previewing ? 'var(--color-on-primary-fixed)' : 'white', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '13px' }}><Eye size={16} /> {d.previewing ? 'إيقاف المعاينة' : 'معاينة مباشرة'}</button>
          <button onClick={() => { d.saveDraft(); flash(); }} id="design_save_btn" className="flex items-center gap-1.5 cursor-pointer" style={{ height: '40px', padding: '0 14px', borderRadius: '0.7rem', background: 'rgba(255,255,255,0.04)', color: 'white', border: '1px solid rgba(255,255,255,0.08)', fontWeight: 700, fontSize: '13px' }}><Save size={16} /> {saved ? 'تم الحفظ ✓' : 'حفظ مسودة'}</button>
          <button onClick={() => d.publish()} id="design_publish_btn" className="flex items-center gap-1.5 cursor-pointer" style={{ height: '40px', padding: '0 16px', borderRadius: '0.7rem', background: ACCENT, color: 'var(--color-on-primary-fixed)', border: 'none', fontWeight: 800, fontSize: '13px' }}><UploadCloud size={16} /> نشر</button>
          <button onClick={() => { d.discardDraft(); d.setPreviewing(false); }} id="design_discard_btn" className="flex items-center gap-1.5 cursor-pointer" style={{ height: '40px', padding: '0 14px', borderRadius: '0.7rem', background: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)', fontWeight: 700, fontSize: '13px' }}><Trash2 size={16} /> تجاهل</button>
        </div>}
      </div>

      {/* ── Live preview (design tokens) — hidden for Experience sections ── */}
      {!isExp && <div className="space-y-3">
        <div className="flex items-center justify-center gap-2">
          {(['mobile', 'tablet', 'desktop'] as const).map(dev => {
            const Icon = dev === 'mobile' ? Smartphone : dev === 'tablet' ? Tablet : Monitor;
            return <button key={dev} onClick={() => setDevice(dev)} aria-label={dev} className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer" style={{ background: device === dev ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.03)', border: device === dev ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.07)', color: device === dev ? ACCENT : 'white' }}><Icon size={16} /></button>;
          })}
        </div>
        <div style={{ overflow: 'auto', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.08)' }}>
          {/* Preview applies the DRAFT config inline so the sample reflects edits even without global preview. */}
          <div style={{ width: device === 'mobile' ? 320 : device === 'tablet' ? 360 : 360, margin: '0 auto', padding: '16px', background: 'var(--color-background)', ['--glass-blur' as any]: `${cfg.glass.intensity}px` }}>
            <PreviewSample cfg={cfg} />
          </div>
        </div>
        <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', textAlign: 'center' }}>المعاينة تعكس المسودة. اضغط «معاينة مباشرة» لتطبيقها على كامل التطبيق قبل النشر.</p>
      </div>}
    </div>
  );
}

function PreviewSample({ cfg }: { cfg: DesignConfig }) {
  const r = `${cfg.cards.radius}px`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontFamily: `"${cfg.typography.fontFamily}", sans-serif` }} dir="rtl">
      <div className="glass" style={{ borderRadius: r, padding: cfg.cards.padding, border: `1px solid rgba(255,255,255,${cfg.glass.borderOpacity})` }}>
        <h3 style={{ color: 'white', fontSize: `${17 * cfg.typography.headerScale * cfg.typography.fontScale}px`, fontWeight: cfg.typography.weight, letterSpacing: `${cfg.typography.letterSpacing}em`, margin: 0 }}>مطعم الجليلة</h3>
        <p style={{ color: 'var(--color-on-surface-variant)', fontSize: `${13 * cfg.typography.bodyScale * cfg.typography.fontScale}px`, lineHeight: cfg.typography.lineHeight }}>مأكولات شعبية · ٢٥–٤٠ دقيقة</p>
        <div className="flex gap-2 mt-2">
          <button style={{ height: cfg.buttons.height, borderRadius: cfg.buttons.radius, background: cfg.colors.primary, color: '#0a1c00', border: 'none', fontWeight: 800, fontSize: '13px', padding: '0 14px' }}>اطلب الآن</button>
          <button style={{ height: cfg.buttons.height, borderRadius: cfg.buttons.radius, background: 'transparent', color: cfg.colors.secondary, border: `1px solid ${cfg.colors.secondary}`, fontWeight: 700, fontSize: '13px', padding: '0 14px' }}>التفاصيل</button>
        </div>
      </div>
      <div className="flex gap-2">
        {[['نجاح', cfg.colors.success], ['تحذير', cfg.colors.warning], ['خطر', cfg.colors.danger], ['تمييز', cfg.colors.accent]].map(([t, c]) => (
          <span key={t as string} style={{ fontSize: '11px', fontWeight: 700, color: c as string, background: `${c}22`, borderRadius: '999px', padding: '4px 10px' }}>{t as string}</span>
        ))}
      </div>
      <div className="glass" style={{ borderRadius: r, padding: cfg.cards.padding, border: `1px solid rgba(255,255,255,${cfg.glass.borderOpacity})`, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <Check size={cfg.icons.size} color={cfg.colors.primary} strokeWidth={cfg.icons.weight} />
        <span style={{ color: 'white', fontSize: `${14 * cfg.typography.fontScale}px` }}>أيقونة + نص — معاينة حية</span>
      </div>
    </div>
  );
}
