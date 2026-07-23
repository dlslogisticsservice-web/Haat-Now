import React, { useRef, useState } from 'react';
import {
  Store, Truck, Bike, Megaphone, Building2, Landmark, Briefcase,
  Users, LayoutDashboard, Wallet, PackageCheck, MapPin, Clock, Navigation, QrCode,
  BarChart3, Rocket, BookOpen, BadgeCheck, ShieldCheck, Award,
  ChevronRight, Check, UploadCloud, X, FileText, ArrowLeft, Loader2, CheckCircle2,
} from 'lucide-react';
import { PARTNER_TYPES, partnerTypeBySlug, type PartnerTypeContent, type BiText } from './partnerContent';
import { partnerService, type PartnerApplication } from '../../../services/partner.service';
import { HaatLogo } from '../../../components/brand/HaatLogo';

const ICONS: Record<string, any> = {
  Store, Truck, Bike, Megaphone, Building2, Landmark, Briefcase, Users, LayoutDashboard, Wallet,
  PackageCheck, MapPin, Clock, Navigation, QrCode, BarChart3, Rocket, BookOpen, BadgeCheck, ShieldCheck, Award,
};
const Ico: React.FC<{ name: string; size?: number; color?: string }> = ({ name, size = 20, color }) => {
  const C = ICONS[name] || FileText; return <C size={size} color={color} />;
};

type Lang = 'ar' | 'en';
const tx = (t: BiText, lang: Lang) => (lang === 'ar' ? t.ar : t.en);

// ── Section primitives (reuse website design tokens; no new design system) ──────
const Section: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <section style={{ maxWidth: 1080, margin: '0 auto', padding: '0 20px', ...style }}>{children}</section>
);
const H2: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ fontSize: 'clamp(22px,4vw,32px)', fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--color-on-surface,#e8ebe3)', margin: '0 0 18px' }}>{children}</h2>
);
const card: React.CSSProperties = { background: 'color-mix(in srgb, var(--color-surface-container,#10160f) 82%, transparent)', border: '1px solid var(--color-outline-variant,#2a3330)', borderRadius: 18 };
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--color-surface-container-high,#141a13)', border: '1px solid var(--color-outline-variant,#2a3330)', borderRadius: 12, padding: '11px 13px', color: 'var(--color-on-surface,#e8ebe3)', fontSize: 15, outline: 'none' };

// ══════════════════════════════════════════════════════════════════════════════
// Public entry — hub (no slug) or a type's landing page.
// ══════════════════════════════════════════════════════════════════════════════
export const PartnerCenter: React.FC<{ slug?: string | null; lang: Lang; onNav: (path: string) => void }> = ({ slug, lang, onNav }) => {
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const type = slug ? partnerTypeBySlug(slug) : null;
  return (
    <div dir={dir} style={{ color: 'var(--color-on-surface,#e8ebe3)', fontFamily: 'var(--font-family, Cairo, system-ui, sans-serif)', paddingBottom: 64 }}>
      {type ? <PartnerLanding content={type} lang={lang} onNav={onNav} /> : <PartnerHub lang={lang} onNav={onNav} />}
    </div>
  );
};

// ── Hub: all 7 partner types as premium cards ──────────────────────────────────
const PartnerHub: React.FC<{ lang: Lang; onNav: (p: string) => void }> = ({ lang, onNav }) => (
  <>
    <div style={{ textAlign: 'center', padding: 'clamp(48px,8vw,88px) 20px 32px', background: 'radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 12%, transparent), transparent 60%)' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><HaatLogo height={34} /></div>
      <h1 style={{ fontSize: 'clamp(30px,6vw,54px)', fontWeight: 900, letterSpacing: '-0.03em', margin: '0 0 12px' }}>{lang === 'ar' ? 'مركز الشركاء' : 'Partner Center'}</h1>
      <p style={{ fontSize: 'clamp(16px,2.4vw,20px)', color: 'var(--color-on-surface-variant,#a7b0a6)', maxWidth: 640, margin: '0 auto' }}>
        {lang === 'ar' ? 'انضم إلى منظومة هات الآن — تاجراً أو أسطولاً أو كابتن أو مسوّقاً أو امتيازاً أو شريكاً مؤسسياً، أو ابنِ مستقبلك المهني معنا.' : 'Join the HAAT NOW ecosystem — as a merchant, fleet, driver, affiliate, franchise or enterprise partner, or build your career with us.'}
      </p>
    </div>
    <Section>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        {PARTNER_TYPES.map(t => (
          <button key={t.slug} id={`partner_card_${t.slug}`} onClick={() => onNav(`/partners/${t.slug}`)}
            style={{ ...card, textAlign: 'start', padding: 22, cursor: 'pointer', color: 'inherit', transition: 'transform .15s, border-color .15s' }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--color-primary-fixed,#a3f95b)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = 'var(--color-outline-variant,#2a3330)'; }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, display: 'grid', placeItems: 'center', color: 'var(--color-primary-fixed,#a3f95b)', background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 28%, transparent)' }}><Ico name={t.icon} size={26} /></span>
            <h3 style={{ fontSize: 19, fontWeight: 800, margin: '14px 0 6px' }}>{tx(t.title, lang)}</h3>
            <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant,#a7b0a6)', margin: 0 }}>{tx(t.tagline, lang)}</p>
            <span className="hn-arrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 14, color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 800, fontSize: 14 }}>
              {lang === 'ar' ? 'اعرف المزيد' : 'Learn more'} <ChevronRight size={16} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
            </span>
          </button>
        ))}
      </div>
    </Section>
  </>
);

// ── Landing template (renders any type from config) + application flow ─────────
const PartnerLanding: React.FC<{ content: PartnerTypeContent; lang: Lang; onNav: (p: string) => void }> = ({ content, lang, onNav }) => {
  const c = content;
  const applyRef = useRef<HTMLDivElement>(null);
  const scrollToApply = () => applyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return (
    <>
      {/* Hero */}
      <div style={{ padding: 'clamp(40px,7vw,80px) 20px clamp(28px,4vw,44px)', background: 'radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 12%, transparent), transparent 60%)' }}>
        <Section style={{ padding: '0 20px' }}>
          <button onClick={() => onNav('/partners')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: 'var(--color-on-surface-variant,#a7b0a6)', cursor: 'pointer', fontSize: 13.5, fontWeight: 700, marginBottom: 16 }}>
            <ArrowLeft size={15} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />{lang === 'ar' ? 'كل الشركاء' : 'All partners'}
          </button>
          <span style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', color: 'var(--color-primary-fixed,#a3f95b)', background: 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 28%, transparent)' }}><Ico name={c.icon} size={28} /></span>
          <h1 style={{ fontSize: 'clamp(30px,6vw,52px)', fontWeight: 900, letterSpacing: '-0.03em', margin: '16px 0 10px' }}>{tx(c.title, lang)}</h1>
          <p style={{ fontSize: 'clamp(16px,2.4vw,21px)', color: 'var(--color-on-surface-variant,#a7b0a6)', maxWidth: 640, margin: '0 0 22px' }}>{tx(c.heroSub, lang)}</p>
          <button id="partner_apply_cta" onClick={scrollToApply} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '13px 26px', borderRadius: 14, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)', fontWeight: 800, fontSize: 16, border: 'none', cursor: 'pointer' }}>
            {lang === 'ar' ? 'قدّم الآن' : 'Apply now'} <ChevronRight size={18} style={{ transform: lang === 'ar' ? 'scaleX(-1)' : 'none' }} />
          </button>
        </Section>
      </div>

      {/* Benefits */}
      <Section style={{ paddingTop: 40 }}>
        <H2>{lang === 'ar' ? 'المزايا' : 'Benefits'}</H2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
          {c.benefits.map((b, i) => (
            <div key={i} style={{ ...card, padding: 20 }}>
              <span style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}><Ico name={b.icon} size={22} /></span>
              <h3 style={{ fontSize: 16.5, fontWeight: 800, margin: '10px 0 5px' }}>{tx(b.title, lang)}</h3>
              <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant,#a7b0a6)', margin: 0, lineHeight: 1.55 }}>{tx(b.body, lang)}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Requirements + How it works */}
      <Section style={{ paddingTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div>
          <H2>{lang === 'ar' ? 'المتطلبات' : 'Requirements'}</H2>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
            {c.requirements.map((r, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 15, color: 'var(--color-on-surface,#cfd6c9)' }}>
                <Check size={18} color="var(--color-primary-fixed,#a3f95b)" style={{ flexShrink: 0, marginTop: 2 }} />{tx(r, lang)}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <H2>{lang === 'ar' ? 'كيف تعمل' : 'How it works'}</H2>
          <div style={{ display: 'grid', gap: 12 }}>
            {c.howItWorks.map((s, i) => (
              <div key={i} style={{ display: 'flex', gap: 12 }}>
                <span style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)' }}>{i + 1}</span>
                <div><h3 style={{ fontSize: 15.5, fontWeight: 800, margin: '3px 0 3px' }}>{tx(s.title, lang)}</h3><p style={{ fontSize: 14, color: 'var(--color-on-surface-variant,#a7b0a6)', margin: 0 }}>{tx(s.body, lang)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* Timeline */}
      <Section style={{ paddingTop: 40 }}>
        <H2>{lang === 'ar' ? 'رحلة الطلب' : 'Your application journey'}</H2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {c.timeline.map((s, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 15px', borderRadius: 999, ...card, fontSize: 13.5, fontWeight: 700 }}>
              <span style={{ color: 'var(--color-primary-fixed,#a3f95b)', fontWeight: 900 }}>{i + 1}</span>{tx(s, lang)}
            </span>
          ))}
        </div>
      </Section>

      {/* Success story + FAQ */}
      <Section style={{ paddingTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
        <div>
          <H2>{lang === 'ar' ? 'قصص نجاح' : 'Success stories'}</H2>
          {c.stories.map((s, i) => (
            <div key={i} style={{ ...card, padding: 20 }}>
              <p style={{ fontSize: 16, fontStyle: 'italic', margin: '0 0 10px', lineHeight: 1.6 }}>“{tx(s.quote, lang)}”</p>
              <p style={{ fontSize: 13, color: 'var(--color-on-surface-variant,#a7b0a6)', margin: 0, fontWeight: 700 }}>{tx(s.author, lang)}</p>
            </div>
          ))}
        </div>
        <div>
          <H2>{lang === 'ar' ? 'الأسئلة الشائعة' : 'FAQ'}</H2>
          <div style={{ display: 'grid', gap: 10 }}>
            {c.faq.map((f, i) => (
              <details key={i} style={{ ...card, padding: '14px 16px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 700, fontSize: 15 }}>{tx(f.q, lang)}</summary>
                <p style={{ fontSize: 14, color: 'var(--color-on-surface-variant,#a7b0a6)', margin: '8px 0 0', lineHeight: 1.55 }}>{tx(f.a, lang)}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>

      {/* Application form */}
      <div ref={applyRef} style={{ paddingTop: 48 }}>
        <Section>
          <H2>{lang === 'ar' ? 'قدّم طلبك' : 'Apply'}</H2>
          <ApplicationFlow content={c} lang={lang} onNav={onNav} />
        </Section>
      </div>
    </>
  );
};

// ── Multi-step application: details → documents → confirmation ─────────────────
const ApplicationFlow: React.FC<{ content: PartnerTypeContent; lang: Lang; onNav: (p: string) => void }> = ({ content: c, lang, onNav }) => {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [app, setApp] = useState<PartnerApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({ name: '', phone: '', email: '', city: '', subType: c.subTypes[0] ? tx(c.subTypes[0], 'en') : '' });

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);

  const submit = () => {
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) { setError(L('الاسم ورقم الهاتف مطلوبان.', 'Name and phone are required.')); return; }
    setSubmitting(true);
    const { name, phone, email, city, subType, ...rest } = form;
    const res = partnerService.submit({ type: c.type, subType, name, phone, email, city, country: 'EG', fields: rest });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.reason === 'rate_limited' ? L('لقد قدّمت طلباً للتو. حاول بعد قليل.', 'You just applied — please try again shortly.')
        : res.reason === 'duplicate' ? L('لديك طلب قائم بالفعل لهذا النوع.', 'You already have an active application for this type.')
        : L('تعذّر إرسال الطلب.', 'Could not submit the application.'));
      return;
    }
    setApp(res.application!); setStep(1);
  };

  const stepDot = (i: number, label: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 26, height: 26, borderRadius: 999, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, background: step >= i ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-surface-container-high,#141a13)', color: step >= i ? 'var(--color-on-primary-fixed,#0c2000)' : 'var(--color-on-surface-variant,#a7b0a6)' }}>{step > i ? <Check size={14} /> : i + 1}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: step >= i ? 'var(--color-on-surface,#e8ebe3)' : 'var(--color-on-surface-variant,#a7b0a6)' }}>{label}</span>
    </span>
  );

  return (
    <div style={{ ...card, padding: 'clamp(18px,3vw,28px)' }} id="partner_application">
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 20 }}>
        {stepDot(0, L('البيانات', 'Details'))}{stepDot(1, L('المستندات', 'Documents'))}{stepDot(2, L('تأكيد', 'Confirmation'))}
      </div>

      {step === 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', gap: 12 }}>
            <Field label={L('الاسم الكامل', 'Full name')} required value={form.name} onChange={v => set('name', v)} id="pf_name" />
            <Field label={L('رقم الهاتف', 'Phone number')} required type="tel" value={form.phone} onChange={v => set('phone', v)} id="pf_phone" />
            <Field label={L('البريد الإلكتروني', 'Email')} type="email" value={form.email} onChange={v => set('email', v)} id="pf_email" />
            <Field label={L('المدينة', 'City')} value={form.city} onChange={v => set('city', v)} id="pf_city" />
            <label style={{ display: 'block' }}>
              <span style={lblStyle}>{L('الفئة', 'Category')}</span>
              <select value={form.subType} onChange={e => set('subType', e.target.value)} style={{ ...inputStyle, marginTop: 5 }} id="pf_subtype">
                {c.subTypes.map((s, i) => <option key={i} value={tx(s, 'en')}>{tx(s, lang)}</option>)}
              </select>
            </label>
            {c.fields.map(f => (
              <label key={f.key} style={{ display: 'block', gridColumn: f.type === 'textarea' ? '1 / -1' : undefined }}>
                <span style={lblStyle}>{tx({ ar: f.ar, en: f.en }, lang)}{f.required && <b style={{ color: '#f5a623' }}> *</b>}</span>
                {f.type === 'select' ? (
                  <select value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ ...inputStyle, marginTop: 5 }}>
                    <option value="">—</option>
                    {(f.options || []).map((o, i) => <option key={i} value={tx(o, 'en')}>{tx(o, lang)}</option>)}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} rows={3} style={{ ...inputStyle, marginTop: 5, resize: 'vertical' }} />
                ) : (
                  <input type={f.type} value={form[f.key] || ''} onChange={e => set(f.key, e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
                )}
              </label>
            ))}
          </div>
          {error && <p role="alert" style={{ color: '#f87171', fontSize: 13.5, margin: 0 }}>{error}</p>}
          <button id="partner_submit" onClick={submit} disabled={submitting} style={{ justifySelf: 'start', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 26px', borderRadius: 13, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)', fontWeight: 800, fontSize: 15.5, border: 'none', cursor: 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? <Loader2 size={16} className="animate-spin" /> : null}{L('إرسال الطلب', 'Submit application')}
          </button>
        </div>
      )}

      {step === 1 && app && <DocumentUpload app={app} lang={lang} onDone={(updated) => { setApp(updated); setStep(2); }} />}

      {step === 2 && app && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle2 size={54} color="var(--color-primary-fixed,#a3f95b)" style={{ marginBottom: 12 }} />
          <h3 style={{ fontSize: 22, fontWeight: 900, margin: '0 0 8px' }}>{L('تم استلام طلبك', 'Application received')}</h3>
          <p style={{ color: 'var(--color-on-surface-variant,#a7b0a6)', margin: '0 0 6px' }}>{L('رقم المرجع', 'Reference')}: <b style={{ color: 'var(--color-primary-fixed,#a3f95b)' }}>{app.ref}</b></p>
          <p style={{ color: 'var(--color-on-surface-variant,#a7b0a6)', maxWidth: 520, margin: '0 auto 18px', fontSize: 14.5 }}>{L('سيتواصل معك فريقنا لمراجعة المستندات وتحديد الخطوات التالية.', 'Our team will contact you to review documents and arrange the next steps.')}</p>
          <button onClick={() => onNav('/partners')} style={{ padding: '11px 22px', borderRadius: 12, ...card, cursor: 'pointer', color: 'var(--color-on-surface,#e8ebe3)', fontWeight: 700 }}>{L('العودة لمركز الشركاء', 'Back to Partner Center')}</button>
        </div>
      )}
    </div>
  );
};

// ── Professional upload component (drag & drop, preview, replace, delete) ───────
const DocumentUpload: React.FC<{ app: PartnerApplication; lang: Lang; onDone: (a: PartnerApplication) => void }> = ({ app: initial, lang, onDone }) => {
  const [app, setApp] = useState(initial);
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const docs = app.documents.filter(d => d.requirement !== 'hidden');

  const readFile = (docId: string, file: File) => {
    const rule = partnerService.rules(app.type).find(r => r.id === app.documents.find(d => d.id === docId)?.ruleId);
    const maxMb = rule?.maxSizeMb || 10;
    if (file.size > maxMb * 1024 * 1024) { alert(L(`الحد الأقصى ${maxMb}MB`, `Max size ${maxMb}MB`)); return; }
    const reader = new FileReader();
    reader.onload = () => { const updated = partnerService.attachDocument(app.id, docId, { name: file.name, dataUrl: String(reader.result), size: file.size }); if (updated) setApp({ ...updated }); };
    reader.readAsDataURL(file);
  };

  return (
    <div>
      <p style={{ color: 'var(--color-on-surface-variant,#a7b0a6)', fontSize: 14.5, marginTop: 0 }}>{L('ارفع المستندات المطلوبة. يمكنك أيضاً رفعها لاحقاً بعد أن يتواصل معك فريقنا.', 'Upload the required documents. You can also upload them later after our team contacts you.')}</p>
      <div style={{ display: 'grid', gap: 12 }}>
        {docs.map(d => <UploadRow key={d.id} doc={d} lang={lang} onPick={(file) => readFile(d.id, file)} />)}
      </div>
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button id="partner_docs_done" onClick={() => onDone(app)} style={{ padding: '12px 24px', borderRadius: 13, background: 'var(--color-primary-fixed,#a3f95b)', color: 'var(--color-on-primary-fixed,#0c2000)', fontWeight: 800, fontSize: 15, border: 'none', cursor: 'pointer' }}>{L('إنهاء', 'Finish')}</button>
        <button onClick={() => onDone(app)} style={{ padding: '12px 24px', borderRadius: 13, ...card, color: 'var(--color-on-surface-variant,#a7b0a6)', fontWeight: 700, cursor: 'pointer' }}>{L('تخطّي الآن', 'Skip for now')}</button>
      </div>
    </div>
  );
};

const UploadRow: React.FC<{ doc: PartnerApplication['documents'][number]; lang: Lang; onPick: (f: File) => void }> = ({ doc, lang, onPick }) => {
  const [drag, setDrag] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const has = !!doc.fileDataUrl;
  return (
    <div style={{ ...card, padding: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      borderColor: drag ? 'var(--color-primary-fixed,#a3f95b)' : has ? 'color-mix(in srgb, var(--color-primary-fixed,#a3f95b) 40%, var(--color-outline-variant))' : 'var(--color-outline-variant,#2a3330)' }}
      onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onPick(f); }}>
      <span style={{ width: 40, height: 40, borderRadius: 10, display: 'grid', placeItems: 'center', flexShrink: 0, color: has ? 'var(--color-primary-fixed,#a3f95b)' : 'var(--color-on-surface-variant,#a7b0a6)', background: 'var(--color-surface-container-high,#141a13)' }}>{has ? <CheckCircle2 size={20} /> : <FileText size={20} />}</span>
      <span style={{ flex: 1, minWidth: 160 }}>
        <span style={{ display: 'block', fontWeight: 700, fontSize: 14.5 }}>{lang === 'ar' ? doc.nameAr : doc.nameEn}
          {doc.requirement === 'required' ? <b style={{ color: '#f5a623', fontSize: 12 }}> · {L('مطلوب', 'Required')}</b> : <span style={{ color: 'var(--color-on-surface-variant,#a7b0a6)', fontSize: 12 }}> · {L('اختياري', 'Optional')}</span>}
        </span>
        {has && <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-on-surface-variant,#a7b0a6)', marginTop: 2 }}>{doc.fileName}</span>}
      </span>
      <input ref={ref} type="file" accept={'application/pdf,image/*'} style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
      <button onClick={() => ref.current?.click()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 11, background: has ? 'var(--color-surface-container-high,#141a13)' : 'var(--color-primary-fixed,#a3f95b)', color: has ? 'var(--color-on-surface,#e8ebe3)' : 'var(--color-on-primary-fixed,#0c2000)', border: 'none', fontWeight: 700, fontSize: 13.5, cursor: 'pointer' }}>
        {has ? <><X size={14} />{L('استبدال', 'Replace')}</> : <><UploadCloud size={15} />{L('رفع', 'Upload')}</>}
      </button>
    </div>
  );
};

const lblStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 700, color: 'var(--color-on-surface-variant,#a7b0a6)' };
const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean; id?: string }> = ({ label, value, onChange, type = 'text', required, id }) => (
  <label style={{ display: 'block' }}>
    <span style={lblStyle}>{label}{required && <b style={{ color: '#f5a623' }}> *</b>}</span>
    <input id={id} type={type} value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, marginTop: 5 }} />
  </label>
);
