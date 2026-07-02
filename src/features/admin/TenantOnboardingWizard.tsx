import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, SkipForward, Circle, Rocket, RotateCcw, Building2, Palette, CreditCard, Globe, ClipboardCheck, LayoutGrid, Image } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { templatesService } from '../../services/templates.service';
import { themePresetsService } from '../../services/themePresets.service';
import { PLAN_CATALOG } from '../../services/subscription.service';
import { provisioningService, type ProvisionRun } from '../../services/provisioning.service';
import { Can } from '../../hooks/useRbac';

// Onboarding Wizard — PRESENTATION LAYER ONLY. Collects/validates input, selects a template, then calls the
// existing Provisioning Engine. It contains NO business logic and provisions NOTHING itself: theme/subscription/
// brand/roles/integrations are all applied by the engine (from the template manifest).
const DRAFT_KEY = 'haat_sb_onboarding_draft';
const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', borderRadius: 10, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 4, display: 'block' };

interface Form { brand_name: string; support_email: string; templateId: string; logo_url: string; theme_preset_id: string; plan: string; subdomain: string }
const empty: Form = { brand_name: '', support_email: '', templateId: '', logo_url: '', theme_preset_id: '', plan: '', subdomain: '' };
const StepIcon: React.FC<{ s: string }> = ({ s }) => s === 'ok' ? <Check size={13} color="#4ade80" /> : s === 'skipped' ? <SkipForward size={13} color="#60a5fa" /> : s === 'failed' ? <X size={13} color="#f87171" /> : <Circle size={11} color="var(--color-on-surface-variant)" />;

export const TenantOnboardingWizard: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const templates = templatesService.list();
  const presets = themePresetsService.list();
  // Resume interrupted onboarding — load the draft in the lazy initializer so the INITIAL state IS the draft.
  // (A resume-on-mount effect would be clobbered by the autosave effect firing first with the empty state.)
  const [draft0] = useState<{ step?: number; form?: Form } | null>(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } });
  const [step, setStep] = useState<number>(draft0?.form ? (draft0.step || 0) : 0);
  const [form, setForm] = useState<Form>(draft0?.form || empty);
  const [phase, setPhase] = useState<'input' | 'provisioning' | 'success' | 'error'>('input');
  const [run, setRun] = useState<ProvisionRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState<boolean>(!!draft0?.form);
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  // Autosave — the initial state already reflects any resumed draft, so this never clobbers it.
  useEffect(() => { if (phase === 'input') { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step })); } catch { /* ignore */ } } }, [form, step, phase]);

  const STEPS = [
    { key: 'welcome', ar: 'مرحبًا', en: 'Welcome', Icon: Sparkles },
    { key: 'company', ar: 'الشركة', en: 'Company', Icon: Building2 },
    { key: 'business', ar: 'نوع النشاط', en: 'Business', Icon: LayoutGrid },
    { key: 'template', ar: 'القالب', en: 'Template', Icon: LayoutGrid },
    { key: 'branding', ar: 'الهوية', en: 'Branding', Icon: Image },
    { key: 'theme', ar: 'السمة', en: 'Theme', Icon: Palette },
    { key: 'subscription', ar: 'الاشتراك', en: 'Subscription', Icon: CreditCard },
    { key: 'domain', ar: 'النطاق', en: 'Domain', Icon: Globe },
    { key: 'review', ar: 'مراجعة', en: 'Review', Icon: ClipboardCheck },
    { key: 'provision', ar: 'التزويد', en: 'Provision', Icon: Rocket },
  ];
  const sel = templatesService.get(form.templateId);

  // Per-step validation (reuses templatesService.validate; no duplicated validation).
  const stepValid = (): string | null => {
    const s = STEPS[step].key;
    if (s === 'company' && !form.brand_name.trim()) return L('أدخل اسم الشركة', 'Enter a company name');
    if ((s === 'business' || s === 'template') && !form.templateId) return L('اختر قالبًا', 'Select a template');
    if (s === 'review') { const t = templatesService.get(form.templateId); const v = t ? templatesService.validate(t) : { valid: false, errors: ['no template'] }; if (!v.valid) return v.errors.join(' · '); }
    return null;
  };
  const next = () => { const err = stepValid(); if (err) return toast.error(err); setStep(s => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const buildSpec = () => {
    const t = templatesService.get(form.templateId); if (!t) return null;
    const spec = templatesService.toSpec(t, { brand_name: form.brand_name, support_email: form.support_email || undefined, logo_url: form.logo_url || undefined, slug: form.subdomain || undefined });
    if (form.theme_preset_id) spec.theme_preset_id = form.theme_preset_id;
    if (form.plan) spec.plan = form.plan as any;
    return spec;
  };
  const provision = async () => {
    const spec = buildSpec(); if (!spec) return toast.error(L('اختر قالبًا أولًا', 'Select a template first'));
    setPhase('provisioning'); setBusy(true);
    const r = await provisioningService.provision(spec);
    if (r.tenantId) templatesService.assignToTenant(r.tenantId, form.templateId);
    setRun(r); setBusy(false); setPhase(r.status === 'completed' ? 'success' : 'error');
    if (r.status === 'completed') { try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } toast.success(L('تم إنشاء المستأجر', 'Tenant created')); } else toast.error(L('توقف التزويد — أعد المحاولة', 'Provisioning stopped — retry'));
  };
  const retry = async () => { if (!run) return; setBusy(true); const r = await provisioningService.retry(run.id); setRun(r); setBusy(false); setPhase(r.status === 'completed' ? 'success' : 'error'); };
  const restart = () => { setForm(empty); setStep(0); setPhase('input'); setRun(null); setResumed(false); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="onboarding_wizard">
      <WorkspaceHeader Icon={Sparkles} title={L('معالج تهيئة المستأجر', 'Tenant Onboarding Wizard')} subtitle={L('طبقة عرض فقط — يجمع المدخلات ثم يستدعي محرّك التزويد', 'Presentation only — collects input then calls the Provisioning Engine')} />

      {/* Progress indicator */}
      <div className="flex items-center gap-1 flex-wrap mb-4 p-2.5 rounded-2xl" style={surface} id="wizard_progress">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold" style={{ background: i === step && phase === 'input' ? 'var(--color-primary-fixed)' : 'transparent', color: i === step && phase === 'input' ? 'var(--color-on-primary-fixed)' : i < step || phase !== 'input' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)' }}>
            <s.Icon size={12} />{L(s.ar, s.en)}
          </div>
        ))}
      </div>

      <Can perm="platform.tenants.manage" fallback={<div className="p-4 rounded-2xl text-sm" style={surface}>{L('لا تملك صلاحية التهيئة.', 'You lack onboarding permission.')}</div>}>
        {resumed && phase === 'input' && <div className="mb-3 p-2.5 rounded-xl text-[12px] flex items-center justify-between" style={{ background: 'rgba(96,165,250,0.12)', color: '#60a5fa' }}><span>{L('تم استئناف تهيئة غير مكتملة.', 'Resumed an unfinished onboarding.')}</span><button onClick={restart} className="underline cursor-pointer">{L('ابدأ من جديد', 'Start over')}</button></div>}

        {/* PROGRESS / SUCCESS / ERROR phases */}
        {phase !== 'input' ? (
          <div className="rounded-2xl p-4" style={surface} id="wizard_result">
            {phase === 'success' ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-3" style={{ background: 'rgba(74,222,128,0.15)' }}><Check size={28} color="#4ade80" /></div>
                <p className="font-bold text-lg" id="wizard_success">{L('تم إنشاء المستأجر بنجاح', 'Tenant created successfully')}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{form.brand_name} · {run?.tenantId}</p>
                <button onClick={restart} className="mt-4 h-10 px-5 rounded-xl text-sm font-bold cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('تهيئة مستأجر آخر', 'Onboard another')}</button>
              </div>
            ) : (
              <>
                <p className="font-bold text-sm mb-2 flex items-center gap-1.5"><Rocket size={15} style={{ color: 'var(--color-primary-fixed)' }} />{L('جارٍ التزويد…', 'Provisioning…')} {phase === 'error' && <span style={{ color: '#f87171' }}>· {L('توقّف', 'stopped')}</span>}</p>
                {run && <div id="wizard_timeline">{run.steps.map(s => (
                  <div key={s.key} className="flex items-center gap-3 py-1.5">
                    <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}><StepIcon s={s.status} /></span>
                    <span className="text-sm flex-1">{L(s.ar, s.en)}</span>
                    <span className="text-[11px]" style={{ color: s.status === 'failed' ? '#f87171' : 'var(--color-on-surface-variant)' }}>{s.status}{s.error ? ` · ${s.error}` : ''}</span>
                  </div>
                ))}</div>}
                {phase === 'error' && <button onClick={retry} disabled={busy} id="wizard_retry" className="mt-3 h-10 px-4 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><RotateCcw size={14} />{L('إعادة المحاولة', 'Retry')}</button>}
              </>
            )}
          </div>
        ) : (
          <>
            {/* INPUT STEPS */}
            <div className="rounded-2xl p-4 min-h-[220px]" style={surface} id={`wizard_step_${STEPS[step].key}`}>
              {STEPS[step].key === 'welcome' && <div className="py-6 text-center"><Sparkles size={30} style={{ color: 'var(--color-primary-fixed)' }} className="mx-auto mb-3" /><p className="font-bold text-lg">{L('لنجهّز علامتك التجارية', "Let's set up your brand")}</p><p className="text-[13px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('خطوات قليلة ثم نُزوّد مستأجرك تلقائيًا عبر محرّك التزويد.', 'A few steps, then we auto-provision your tenant via the engine.')}</p></div>}

              {STEPS[step].key === 'company' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block"><span style={lbl}>{L('اسم الشركة/العلامة', 'Company / brand name')}</span><input id="wiz_brand" style={inp} value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="Acme Delivery" /></label>
                <label className="block"><span style={lbl}>{L('بريد الدعم', 'Support email')}</span><input id="wiz_email" style={inp} dir="ltr" value={form.support_email} onChange={e => set('support_email', e.target.value)} placeholder="support@acme.com" /></label>
              </div>}

              {(STEPS[step].key === 'business' || STEPS[step].key === 'template') && <div>
                <p style={lbl}>{L('اختر قالب النشاط', 'Choose a business template')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {templates.map(t => <button key={t.id} id={`wiz_tpl_${t.id}`} onClick={() => { set('templateId', t.id); }} className="p-2.5 rounded-xl text-start cursor-pointer" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${form.templateId === t.id ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}>
                    <span className="flex items-center justify-between"><span className="font-bold text-xs">{t.name}</span><span className="w-3.5 h-3.5 rounded" style={{ background: themePresetsService.getConfig(t.theme_preset_id).colors.primary }} /></span>
                    <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{t.vertical} · {t.subscription.plan}</span>
                  </button>)}
                </div>
              </div>}

              {STEPS[step].key === 'branding' && <div className="grid grid-cols-1 gap-3">
                <p className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('يُطبَّق الشعار عبر مدير أصول العلامة داخل المحرّك.', 'The logo is applied by the engine via Brand Assets.')}</p>
                <label className="block"><span style={lbl}>{L('شعار العلامة (URL)', 'Brand logo (URL)')}</span><input id="wiz_logo" style={inp} dir="ltr" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://…/logo.png" /></label>
              </div>}

              {STEPS[step].key === 'theme' && <div>
                <p style={lbl}>{L('السمة (افتراضي القالب أو اختر قالب سمة)', 'Theme (template default, or pick a preset)')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {presets.map(pr => <button key={pr.id} id={`wiz_preset_${pr.id}`} onClick={() => set('theme_preset_id', pr.id)} className="p-2 rounded-xl cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${(form.theme_preset_id || sel?.theme_preset_id) === pr.id ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}><span className="w-4 h-4 rounded" style={{ background: pr.config.colors.primary }} /><span className="text-xs font-bold">{pr.name}</span></button>)}
                </div>
              </div>}

              {STEPS[step].key === 'subscription' && <div>
                <p style={lbl}>{L('الخطة (افتراضي القالب أو اختر)', 'Plan (template default, or choose)')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLAN_CATALOG.map(pl => <button key={pl.key} id={`wiz_plan_${pl.key}`} onClick={() => set('plan', pl.key)} className="p-2.5 rounded-xl text-start cursor-pointer" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${(form.plan || sel?.subscription.plan) === pl.key ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}><span className="font-bold text-xs block">{L(pl.ar, pl.en)}</span><span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{pl.custom ? L('مخصّص', 'Custom') : pl.priceMonthly ? `$${pl.priceMonthly}/mo` : L('مجاني', 'Free')}</span></button>)}
                </div>
              </div>}

              {STEPS[step].key === 'domain' && <div className="grid grid-cols-1 gap-3">
                <label className="block"><span style={lbl}>{L('النطاق الفرعي', 'Subdomain')}</span><span className="flex items-center gap-1.5"><input id="wiz_domain" style={{ ...inp, flex: 1 }} dir="ltr" value={form.subdomain} onChange={e => set('subdomain', e.target.value)} placeholder="acme" /><span className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>.haatnow.app</span></span></label>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('التحقق من النطاق وشهادة SSL يأتيان لاحقًا (عنصر نائب).', 'Domain verification + SSL come later (placeholder).')}</p>
              </div>}

              {STEPS[step].key === 'review' && sel && <div className="space-y-1.5 text-[13px]">
                <p className="font-bold text-sm mb-1">{L('مراجعة', 'Review')}</p>
                {[[L('العلامة', 'Brand'), form.brand_name], [L('القالب', 'Template'), sel.name], [L('القطاع', 'Vertical'), sel.vertical], [L('السمة', 'Theme'), (form.theme_preset_id || sel.theme_preset_id)], [L('الخطة', 'Plan'), (form.plan || sel.subscription.plan)], [L('النطاق', 'Domain'), form.subdomain ? `${form.subdomain}.haatnow.app` : '—'], [L('الشعار', 'Logo'), form.logo_url ? '✓' : '—']].map(([k, v]) => <div key={k as string} className="flex justify-between"><span style={{ color: 'var(--color-on-surface-variant)' }}>{k}</span><span className="font-bold">{v || '—'}</span></div>)}
              </div>}

              {STEPS[step].key === 'provision' && <div className="py-6 text-center"><Rocket size={30} style={{ color: 'var(--color-primary-fixed)' }} className="mx-auto mb-3" /><p className="font-bold">{L('جاهز للتزويد', 'Ready to provision')}</p><p className="text-[12px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('سيستدعي المعالج محرّك التزويد الحالي لتطبيق القالب.', 'The wizard will call the existing Provisioning Engine to apply the template.')}</p></div>}
            </div>

            {/* Nav */}
            <div className="flex items-center justify-between mt-3">
              <button onClick={back} disabled={step === 0} id="wiz_back" className="h-10 px-4 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5" style={{ ...surface, opacity: step === 0 ? 0.5 : 1 }}><ArrowLeft size={15} />{L('السابق', 'Back')}</button>
              {STEPS[step].key === 'provision'
                ? <button onClick={provision} disabled={busy} id="wiz_provision" className="h-10 px-5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Rocket size={15} />{L('تزويد المستأجر', 'Provision tenant')}</button>
                : <button onClick={next} id="wiz_next" className="h-10 px-5 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('التالي', 'Next')}<ArrowRight size={15} /></button>}
            </div>
          </>
        )}
      </Can>
    </div>
  );
};
