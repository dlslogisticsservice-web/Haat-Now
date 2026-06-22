import { useEffect, useState, useCallback } from 'react';
import { experienceService, ExperienceVersion } from '../../experience/experience.service';
import {
  ScreenType, CountryCode, ExperienceSet, EXPERIENCE_COUNTRIES, cloneExperience, DEFAULT_EXPERIENCE,
  SplashExperience, OnboardingExperience, LoginExperience, OnboardingSlide,
} from '../../experience/experienceTypes';
import { MediaPicker } from '../../experience/admin/MediaPicker';
import { useAppConfig } from '../../contexts/AppConfigContext';

const ACCENT = 'var(--color-primary-fixed)';
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 };
const inputStyle: React.CSSProperties = { width: '100%', minHeight: 34, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 12, outline: 'none' };
const label: React.CSSProperties = { fontSize: 11, color: 'var(--color-on-surface-variant)', marginBottom: 4, display: 'block' };

function Field({ l, children }: { l: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 10 }}><label style={label}>{l}</label>{children}</div>;
}
function Txt({ l, value, onChange, area }: { l: string; value: string; onChange: (v: string) => void; area?: boolean }) {
  return <Field l={l}>{area
    ? <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={value} onChange={e => onChange(e.target.value)} />
    : <input style={inputStyle} value={value} onChange={e => onChange(e.target.value)} />}</Field>;
}
function Toggle({ l, on, onChange }: { l: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', ...card, marginBottom: 12 }}>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'white' }}>{l}</span>
      <button onClick={() => onChange(!on)} style={{ width: 46, height: 26, borderRadius: 13, border: 'none', cursor: 'pointer', position: 'relative', background: on ? ACCENT : 'rgba(255,255,255,0.12)' }}>
        <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.18s' }} />
      </button>
    </div>
  );
}

const SCREENS: { k: ScreenType; label: string }[] = [
  { k: 'splash', label: 'شاشة البداية' },
  { k: 'onboarding', label: 'الترحيب' },
  { k: 'login', label: 'تسجيل الدخول' },
];

export function ExperienceBuilder() {
  const { country: appCountry } = useAppConfig();
  const [country, setCountry] = useState<CountryCode>(appCountry.code as CountryCode);
  const [screen, setScreen] = useState<ScreenType>('splash');
  const [set, setSet] = useState<ExperienceSet>(() => cloneExperience(DEFAULT_EXPERIENCE));
  const [versions, setVersions] = useState<ExperienceVersion[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const [draft, vers] = await Promise.all([experienceService.getDraftSet(country), experienceService.listVersions(country, screen)]);
    setSet(draft); setVersions(vers); setBusy(false);
  }, [country, screen]);
  useEffect(() => { load(); }, [load]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(null), 2200); };

  const patch = (next: ExperienceSet) => { setSet(next); experienceService.saveDraft(country, screen, next[screen]); };
  const patchSplash = (p: Partial<SplashExperience>) => patch({ ...set, splash: { ...set.splash, ...p } });
  const patchOnb = (p: Partial<OnboardingExperience>) => patch({ ...set, onboarding: { ...set.onboarding, ...p } });
  const patchLogin = (p: Partial<LoginExperience>) => patch({ ...set, login: { ...set.login, ...p } });

  const publish = async () => { setBusy(true); await experienceService.publish(country, screen); flash('تم النشر — التغييرات الآن مباشرة للمستخدمين'); await load(); };
  const discard = async () => { setBusy(true); await experienceService.discardDraft(country, screen); flash('تم تجاهل المسودة'); await load(); };
  const rollback = async (v: number) => { setBusy(true); await experienceService.rollback(country, screen, v); flash(`تم الرجوع للإصدار ${v}`); await load(); };

  // ── slide ops (onboarding) ──
  const onb = set.onboarding;
  const setSlides = (slides: OnboardingSlide[]) => patchOnb({ slides });
  const addSlide = () => setSlides([...onb.slides, { id: `s-${Date.now()}`, media: { kind: 'icon', icon: 'star' }, badge: 'جديد', title: 'عنوان', description: 'الوصف' }]);
  const delSlide = (i: number) => setSlides(onb.slides.filter((_, x) => x !== i));
  const moveSlide = (i: number, dir: -1 | 1) => { const a = [...onb.slides]; const j = i + dir; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setSlides(a); };
  const editSlide = (i: number, p: Partial<OnboardingSlide>) => setSlides(onb.slides.map((s, x) => x === i ? { ...s, ...p } : s));

  return (
    <div id="experience_builder" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
      {/* Toolbar */}
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={label}>الدولة:</label>
          <select value={country} onChange={e => setCountry(e.target.value as CountryCode)} style={{ ...inputStyle, width: 'auto' }}>
            {EXPERIENCE_COUNTRIES.map(c => <option key={c.code} value={c.code} style={{ color: '#000' }}>{c.flag} {c.nameAr}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4, marginInlineStart: 8 }}>
            {SCREENS.map(s => (
              <button key={s.k} onClick={() => setScreen(s.k)} style={{ padding: '6px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: screen === s.k ? ACCENT : 'rgba(255,255,255,0.04)', color: screen === s.k ? 'var(--color-on-primary-fixed)' : 'var(--color-on-surface-variant)' }}>{s.label}</button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={discard} disabled={busy} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}>تجاهل</button>
          <button onClick={publish} disabled={busy} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: ACCENT, border: 'none', color: 'var(--color-on-primary-fixed)' }}>نشر</button>
        </div>
      </div>
      {msg && <div style={{ ...card, color: ACCENT, fontSize: 12, fontWeight: 600 }}>{msg}</div>}

      {/* ── Splash editor ── */}
      {screen === 'splash' && (
        <div style={card}>
          <Toggle l="تفعيل شاشة البداية المخصّصة" on={set.splash.enabled} onChange={v => patchSplash({ enabled: v })} />
          <Txt l="اسم العلامة" value={set.splash.brandText} onChange={v => patchSplash({ brandText: v })} />
          <Txt l="الشعار النصّي (Tagline)" value={set.splash.tagline} onChange={v => patchSplash({ tagline: v })} />
          <Field l="الوسائط (شعار / Lottie / فيديو)"><MediaPicker value={set.splash.media} category="splash" onChange={m => patchSplash({ media: m })} /></Field>
          <Field l="لون الخلفية"><input type="color" value={set.splash.background.color} onChange={e => patchSplash({ background: { ...set.splash.background, color: e.target.value } })} style={{ width: 48, height: 32, background: 'none', border: 'none' }} /></Field>
          <Field l="فيديو الخلفية (اختياري)"><input style={inputStyle} value={set.splash.background.videoUrl || ''} placeholder="رابط mp4/webm" onChange={e => patchSplash({ background: { ...set.splash.background, videoUrl: e.target.value } })} /></Field>
          <Field l="المدة (مللي ثانية)"><input type="number" style={inputStyle} value={set.splash.durationMs} onChange={e => patchSplash({ durationMs: Number(e.target.value) || 2750 })} /></Field>
          <Field l="الحركة"><select value={set.splash.animation} onChange={e => patchSplash({ animation: e.target.value as SplashExperience['animation'] })} style={inputStyle}>{['fade', 'scale', 'slide', 'none'].map(a => <option key={a} value={a} style={{ color: '#000' }}>{a}</option>)}</select></Field>
          <Txt l="ملاحظة سفلية" value={set.splash.footnote} onChange={v => patchSplash({ footnote: v })} />
        </div>
      )}

      {/* ── Onboarding editor ── */}
      {screen === 'onboarding' && (
        <div style={card}>
          <Toggle l="تفعيل شاشات الترحيب المخصّصة" on={onb.enabled} onChange={v => patchOnb({ enabled: v })} />
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Txt l="زر التالي" value={onb.ctaNextLabel} onChange={v => patchOnb({ ctaNextLabel: v })} />
            <Txt l="زر البدء" value={onb.ctaStartLabel} onChange={v => patchOnb({ ctaStartLabel: v })} />
            <Txt l="تخطّي" value={onb.skipLabel} onChange={v => patchOnb({ skipLabel: v })} />
          </div>
          {onb.slides.map((s, i) => (
            <div key={s.id} style={{ ...card, marginBottom: 10, borderColor: 'rgba(163,249,91,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 12, color: ACCENT }}>شريحة {i + 1}</strong>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => moveSlide(i, -1)} style={miniBtn}>↑</button>
                  <button onClick={() => moveSlide(i, 1)} style={miniBtn}>↓</button>
                  <button onClick={() => delSlide(i)} style={{ ...miniBtn, color: 'var(--color-error)' }}>حذف</button>
                </div>
              </div>
              <Field l="الوسائط"><MediaPicker value={s.media} category="onboarding" onChange={m => editSlide(i, { media: m })} /></Field>
              <Txt l="الشارة" value={s.badge} onChange={v => editSlide(i, { badge: v })} />
              <Txt l="العنوان" value={s.title} onChange={v => editSlide(i, { title: v })} />
              <Txt l="الوصف" value={s.description} onChange={v => editSlide(i, { description: v })} area />
            </div>
          ))}
          <button onClick={addSlide} style={{ width: '100%', height: 38, borderRadius: 9, border: '1px dashed rgba(163,249,91,0.4)', background: 'rgba(163,249,91,0.06)', color: ACCENT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ إضافة شريحة</button>
        </div>
      )}

      {/* ── Login editor (auth form untouched; bg/branding only) ── */}
      {screen === 'login' && (
        <div style={card}>
          <Toggle l="تفعيل خلفية مخصّصة لتسجيل الدخول" on={set.login.enabled} onChange={v => patchLogin({ enabled: v })} />
          <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginBottom: 10 }}>نموذج المصادقة لا يتغيّر إطلاقاً. هنا تتحكّم بخلفية الفيديو والهوية فقط.</p>
          <Field l="التخطيط"><select value={set.login.layout} onChange={e => patchLogin({ layout: e.target.value as LoginExperience['layout'] })} style={inputStyle}>{['centered', 'hero', 'video'].map(a => <option key={a} value={a} style={{ color: '#000' }}>{a}</option>)}</select></Field>
          <Field l="فيديو الخلفية (mp4/webm)"><input style={inputStyle} value={set.login.background.videoUrl || ''} placeholder="رابط الفيديو" onChange={e => patchLogin({ background: { ...set.login.background, videoUrl: e.target.value } })} /></Field>
          <Field l="صورة Poster"><input style={inputStyle} value={set.login.background.posterUrl || ''} placeholder="رابط الصورة" onChange={e => patchLogin({ background: { ...set.login.background, posterUrl: e.target.value } })} /></Field>
        </div>
      )}

      {/* ── Versions / rollback ── */}
      <div style={card}>
        <strong style={{ fontSize: 13, color: 'white' }}>سجل الإصدارات — {SCREENS.find(s => s.k === screen)?.label}</strong>
        {versions.length === 0 ? <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 8 }}>لا توجد إصدارات سابقة بعد. كل عملية نشر تُنشئ نقطة رجوع.</p> : (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {versions.map(v => (
              <div key={v.version_number} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)' }}>
                <span style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>إصدار {v.version_number} · {new Date(v.published_at).toLocaleString('ar')}</span>
                <button onClick={() => rollback(v.version_number)} style={{ ...miniBtn, color: ACCENT }}>رجوع</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = { padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' };
