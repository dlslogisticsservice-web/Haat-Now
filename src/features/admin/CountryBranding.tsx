import { useEffect, useState } from 'react';
import { experienceService } from '../../experience/experience.service';
import { EXPERIENCE_COUNTRIES, CountryCode, ExperienceSet, cloneExperience, DEFAULT_EXPERIENCE } from '../../experience/experienceTypes';

const ACCENT = 'var(--color-primary-fixed)';
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: 14 };
const input: React.CSSProperties = { width: '100%', height: 32, padding: '0 8px', borderRadius: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', color: 'white', fontSize: 12, outline: 'none' };

// Per-country branding quick panel (Phase G). Each country gets its own splash
// brand text, tagline, logo and accent — saved + published independently so the
// change propagates to that country's real users.
import { useAppConfig } from '../../contexts/AppConfigContext';

export function CountryBranding() {
  const { lang } = useAppConfig();
  const L = (ar, en) => (lang === 'ar' ? ar : en);
  const [country, setCountry] = useState<CountryCode>('EG');
  const [set, setSet] = useState<ExperienceSet>(() => cloneExperience(DEFAULT_EXPERIENCE));
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { experienceService.getDraftSet(country).then(setSet); }, [country]);

  const splash = set.splash;
  const patch = (p: Partial<typeof splash>) => {
    const next = { ...set, splash: { ...splash, ...p } };
    setSet(next);
    experienceService.saveDraft(country, 'splash', next.splash);
  };
  const publish = async () => {
    setBusy(true);
    await experienceService.saveDraft(country, 'splash', { ...splash, enabled: true });
    await experienceService.publish(country, 'splash');
    setBusy(false);
    setMsg(`${L('تم نشر هوية','Published branding for')} ${country} — ${L('مباشرة الآن','live now')}`); setTimeout(() => setMsg(null), 2200);
  };

  return (
    <div id="country_branding" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ ...card, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {EXPERIENCE_COUNTRIES.map(c => (
          <button key={c.code} onClick={() => setCountry(c.code)} style={{ padding: '8px 14px', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: country === c.code ? ACCENT : 'rgba(255,255,255,0.04)', color: country === c.code ? 'var(--color-on-primary-fixed)' : 'white' }}>
            {c.flag} {c.nameAr}
          </button>
        ))}
      </div>

      {msg && <div style={{ ...card, color: ACCENT, fontSize: 12, fontWeight: 600 }}>{msg}</div>}

      <div style={{ ...card, display: 'grid', gap: 10 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: 18, background: splash.background.color, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            {splash.media.kind === 'image' && splash.media.url
              ? <img src={splash.media.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              : <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>{splash.brandText}</span>}
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('اسم العلامة','Brand name')}</label>
            <input style={input} value={splash.brandText} onChange={e => patch({ brandText: e.target.value })} />
            <label style={{ fontSize: 11, color: 'var(--color-on-surface-variant)', marginTop: 6, display: 'block' }}>{L('الشعار النصّي','Text logo')}</label>
            <input style={input} value={splash.tagline} onChange={e => patch({ tagline: e.target.value })} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('رابط الشعار (صورة)','Logo URL (image)')}</label>
          <input style={input} value={splash.media.url || ''} placeholder="https://…/logo.png" onChange={e => patch({ media: { kind: 'image', url: e.target.value } })} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('لون الهوية','Brand color')}</label>
          <input type="color" value={splash.background.color} onChange={e => patch({ background: { ...splash.background, color: e.target.value } })} style={{ width: 44, height: 30, background: 'none', border: 'none', cursor: 'pointer' }} />
          <button onClick={publish} disabled={busy} style={{ marginInlineStart: 'auto', padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: ACCENT, border: 'none', color: 'var(--color-on-primary-fixed)' }}>
            {busy ? L('جارٍ النشر…','Publishing…') : `${L('نشر هوية','Publish branding')} ${country}`}
          </button>
        </div>
        <p style={{ fontSize: 11, color: 'var(--color-on-surface-variant)' }}>{L('كل دولة لها شعار وألوان وتجربة بداية/ترحيب/دخول مستقلة. التحرير الكامل لكل الشاشات من تبويب «منشئ التجارب».','Each country has its own logo, colors and splash/onboarding/login experience. Full per-screen editing is in the Experience Builder tab.')}</p>
      </div>
    </div>
  );
}
