import React, { useEffect, useState } from 'react';
import { Sparkles, ArrowRight, ArrowLeft, Check, X, SkipForward, Circle, Rocket, RotateCcw, Palette, CreditCard, Globe, ClipboardCheck, LayoutGrid, Image, UserCog, Factory, ExternalLink } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { toast } from '../../components/ui/feedback';
import { templatesService } from '../../services/templates.service';
import { themePresetsService } from '../../services/themePresets.service';
import { PLAN_CATALOG } from '../../services/subscription.service';
import { provisioningService, type ProvisionRun } from '../../services/provisioning.service';
import { tenantService } from '../../services/tenant.service';
import { websiteService } from '../../services/website.service';
import { Can } from '../../hooks/useRbac';

// Tenant Provisioning Experience — PRESENTATION LAYER ONLY. Collects input across 9 visual steps, then calls the
// existing Provisioning Engine (no business logic here). After provisioning it auto-verifies every surface and
// shows a Provisioning Summary. Reuses: Provisioning Engine (+ operation_events timeline), Template Marketplace,
// Theme Presets, Subscription, Tenant Service, Website Runtime. No duplicate provisioning logic.
const DRAFT_KEY = 'haat_sb_onboarding_draft';
const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const inp: React.CSSProperties = { width: '100%', height: 38, padding: '0 12px', borderRadius: 10, background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 13, outline: 'none' };
const lbl: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--color-on-surface-variant)', marginBottom: 4, display: 'block' };

interface Form { vertical: string; templateId: string; theme_preset_id: string; brand_name: string; support_email: string; logo_url: string; primary_color: string; subdomain: string; custom_domain: string; plan: string; admin_name: string; admin_phone: string }
const empty: Form = { vertical: '', templateId: '', theme_preset_id: '', brand_name: '', support_email: '', logo_url: '', primary_color: '', subdomain: '', custom_domain: '', plan: '', admin_name: '', admin_phone: '' };
interface VerifyRow { name: string; ok: boolean; detail: string }

const StepIcon: React.FC<{ s: string }> = ({ s }) => s === 'ok' ? <Check size={13} color="#4ade80" /> : s === 'skipped' ? <SkipForward size={13} color="#60a5fa" /> : s === 'failed' ? <X size={13} color="#f87171" /> : <Circle size={11} color="var(--color-on-surface-variant)" />;
const tenantById = (id: string | null) => { if (!id) return null; try { return JSON.parse(localStorage.getItem('haat_crud_tenants') || '[]').find((t: any) => String(t.id) === String(id)) || null; } catch { return null; } };

export const TenantOnboardingWizard: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const templates = templatesService.list();
  const presets = themePresetsService.list();
  const verticals = Array.from(new Set(templates.map(t => t.vertical)));
  const [draft0] = useState<{ step?: number; form?: Form } | null>(() => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } });
  const [step, setStep] = useState<number>(draft0?.form ? (draft0.step || 0) : 0);
  const [form, setForm] = useState<Form>(draft0?.form || empty);
  const [phase, setPhase] = useState<'input' | 'provisioning' | 'summary' | 'error'>('input');
  const [run, setRun] = useState<ProvisionRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [resumed, setResumed] = useState<boolean>(!!draft0?.form);
  const [verifications, setVerifications] = useState<VerifyRow[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const set = (k: keyof Form, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { if (phase === 'input') { try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step })); } catch { /* ignore */ } } }, [form, step, phase]);

  const STEPS = [
    { key: 'industry', ar: 'القطاع', en: 'Industry', Icon: Factory },
    { key: 'template', ar: 'القالب', en: 'Template', Icon: LayoutGrid },
    { key: 'theme', ar: 'السمة', en: 'Theme', Icon: Palette },
    { key: 'brand', ar: 'الهوية', en: 'Brand', Icon: Image },
    { key: 'domain', ar: 'النطاق', en: 'Domain', Icon: Globe },
    { key: 'subscription', ar: 'الاشتراك', en: 'Subscription', Icon: CreditCard },
    { key: 'admin', ar: 'حساب المدير', en: 'Admin Account', Icon: UserCog },
    { key: 'review', ar: 'مراجعة', en: 'Review', Icon: ClipboardCheck },
    { key: 'provision', ar: 'التزويد', en: 'Provision', Icon: Rocket },
  ];
  const sel = templatesService.get(form.templateId);
  const shownTemplates = form.vertical ? templates.filter(t => t.vertical === form.vertical) : templates;

  const stepValid = (): string | null => {
    const s = STEPS[step].key;
    if (s === 'industry' && !form.vertical) return L('اختر قطاعًا', 'Select an industry');
    if (s === 'template' && !form.templateId) return L('اختر قالبًا', 'Select a template');
    if (s === 'brand' && !form.brand_name.trim()) return L('أدخل اسم العلامة', 'Enter a brand name');
    if (s === 'admin' && (!form.admin_name.trim() || !form.admin_phone.trim())) return L('أدخل اسم ورقم المدير', 'Enter admin name and phone');
    if (s === 'review') { const t = templatesService.get(form.templateId); const v = t ? templatesService.validate(t) : { valid: false, errors: ['no template'] }; if (!v.valid) return v.errors.join(' · '); }
    return null;
  };
  const next = () => { const err = stepValid(); if (err) return toast.error(err); if (STEPS[step].key === 'template' && sel && !form.plan) setForm(f => ({ ...f, plan: sel.subscription.plan, theme_preset_id: f.theme_preset_id || sel.theme_preset_id, primary_color: f.primary_color || sel.brand_defaults?.primary_color || '' })); setStep(s => Math.min(STEPS.length - 1, s + 1)); };
  const back = () => setStep(s => Math.max(0, s - 1));

  const buildSpec = () => {
    const t = templatesService.get(form.templateId); if (!t) return null;
    const spec = templatesService.toSpec(t, { brand_name: form.brand_name, support_email: form.support_email || undefined, logo_url: form.logo_url || undefined, slug: form.subdomain || undefined });
    if (form.theme_preset_id) spec.theme_preset_id = form.theme_preset_id;
    if (form.plan) spec.plan = form.plan as any;
    if (form.vertical) spec.vertical = form.vertical;
    if (form.primary_color) spec.primary_color = form.primary_color;
    return spec;
  };

  // Post-provision verification — reuses provisioningService.verify + the tenant record + the Website Runtime.
  const verifyAll = (r: ProvisionRun): VerifyRow[] => {
    const t = tenantById(r.tenantId);
    const eng = provisioningService.verify(r.id);
    const chk = (k: string) => !!eng.checks.find(c => c.key === k)?.ok;
    const slug = t?.slug || r.slug;
    const site = (() => { try { return websiteService.getPublishedSite(slug); } catch { return null; } })();
    const active = t?.status === 'active';
    return [
      { name: L('الموقع', 'Website'), ok: !!site && site.pages.length > 0, detail: site ? `${site.pages.length} ${L('صفحات', 'pages')}` : L('لا يوجد', 'none') },
      { name: L('لوحة الإدارة', 'Admin Portal'), ok: active, detail: active ? L('متاح', 'available') : L('غير نشط', 'inactive') },
      { name: L('بوابة التاجر', 'Merchant Portal'), ok: active, detail: active ? L('متاح', 'available') : L('غير نشط', 'inactive') },
      { name: L('تطبيق العميل', 'Customer App'), ok: active, detail: active ? L('متاح', 'available') : L('غير نشط', 'inactive') },
      { name: L('تطبيق الكابتن', 'Captain App'), ok: active, detail: active ? L('متاح', 'available') : L('غير نشط', 'inactive') },
      { name: L('السمة', 'Theme'), ok: chk('theme'), detail: t?.theme_preset_id || '—' },
      { name: L('الهوية', 'Brand'), ok: chk('brand'), detail: t?.app_name || t?.brand_name || '—' },
      { name: 'CMS', ok: chk('cms') && !!site, detail: t?.default_website ? L('مُهيّأ', 'seeded') : '—' },
      { name: L('الصلاحيات', 'Permissions'), ok: chk('roles'), detail: t?.roles_seeded ? L('أدوار مُهيّأة', 'roles seeded') : '—' },
      { name: L('الاشتراك', 'Subscription'), ok: chk('subscription'), detail: t?.plan || t?.sub_status || '—' },
    ];
  };

  const finishSuccess = (r: ProvisionRun, start: number) => {
    if (r.tenantId) {
      try { templatesService.assignToTenant(r.tenantId, form.templateId); } catch { /* best-effort */ }
      try { tenantService.update(r.tenantId, { admin_name: form.admin_name, admin_phone: form.admin_phone, custom_domain: form.custom_domain || null }); } catch { /* best-effort */ }
      if (form.custom_domain) { try { websiteService.saveDraft(r.tenantId, { customDomain: form.custom_domain, sslStatus: 'provisioning' }); websiteService.publish(r.tenantId); } catch { /* best-effort */ } }
    }
    setVerifications(verifyAll(r));
    setDurationMs(Date.now() - start);
    setPhase('summary');
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    toast.success(L('تم إنشاء المستأجر', 'Tenant provisioned'));
  };

  const provision = async () => {
    const spec = buildSpec(); if (!spec) return toast.error(L('اختر قالبًا أولًا', 'Select a template first'));
    setPhase('provisioning'); setBusy(true);
    const start = Date.now();
    const r = await provisioningService.provision(spec);
    setRun(r); setBusy(false);
    if (r.status === 'completed') finishSuccess(r, start); else setPhase('error');
  };
  const retry = async () => { if (!run) return; setBusy(true); const start = Date.now(); const r = await provisioningService.retry(run.id); setRun(r); setBusy(false); if (r.status === 'completed') finishSuccess(r, start); else setPhase('error'); };
  const restart = () => { setForm(empty); setStep(0); setPhase('input'); setRun(null); setResumed(false); setVerifications([]); try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ } };

  const activeSlug = tenantById(run?.tenantId || null)?.slug || run?.slug || form.subdomain || '';
  const origin = (() => { try { return window.location.origin; } catch { return ''; } })();
  const websiteUrl = form.custom_domain ? `https://${form.custom_domain}` : `https://${activeSlug}.haatnow.app`;
  const previewUrl = `${origin}/?site=${activeSlug}`;
  const completedSteps = run ? run.steps.filter(s => s.status === 'ok' || s.status === 'skipped') : [];
  const failures = run ? [...run.steps.filter(s => s.status === 'failed').map(s => `${L(s.ar, s.en)}: ${s.error || ''}`), ...verifications.filter(v => !v.ok).map(v => `${v.name}: ${v.detail}`)] : [];
  const warnings = [
    !form.custom_domain && L('يُستخدم نطاق فرعي مُدار — أضف نطاقًا مخصّصًا من مركز الموقع.', 'Using the managed subdomain — add a custom domain in the Website Center.'),
    form.admin_phone && L(`حساب المدير مُسجّل (${form.admin_phone}) — الوضع الحيّ ينشئ مستخدم المصادقة ويُسنِد الدور.`, `Admin account recorded (${form.admin_phone}); live mode creates the Auth user + assigns the role.`),
  ].filter(Boolean) as string[];

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="onboarding_wizard">
      <WorkspaceHeader Icon={Sparkles} title={L('تجربة تزويد المستأجر', 'Tenant Provisioning Experience')} subtitle={L('9 خطوات مرئية ← محرّك التزويد ← تحقّق تلقائي ← ملخّص', '9 visual steps → Provisioning Engine → auto-verify → summary')} />

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

        {/* ── Provisioning timeline (reuses the engine run.steps + operation_events audit) ── */}
        {phase === 'provisioning' || phase === 'error' ? (
          <div className="rounded-2xl p-4" style={surface} id="wizard_result">
            <p className="font-bold text-sm mb-2 flex items-center gap-1.5"><Rocket size={15} style={{ color: 'var(--color-primary-fixed)' }} />{L('جارٍ التزويد…', 'Provisioning…')} {phase === 'error' && <span style={{ color: '#f87171' }}>· {L('توقّف', 'stopped')}</span>}</p>
            {run && <div id="wizard_timeline">{run.steps.map(s => (
              <div key={s.key} className="flex items-center gap-3 py-1.5">
                <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--color-surface-container-lowest)' }}><StepIcon s={s.status} /></span>
                <span className="text-sm flex-1">{L(s.ar, s.en)}</span>
                <span className="text-[11px]" style={{ color: s.status === 'failed' ? '#f87171' : 'var(--color-on-surface-variant)' }}>{s.status}{s.error ? ` · ${s.error}` : ''}</span>
              </div>
            ))}</div>}
            {phase === 'error' && <button onClick={retry} disabled={busy} id="wizard_retry" className="mt-3 h-10 px-4 rounded-xl text-sm font-bold cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><RotateCcw size={14} />{L('إعادة المحاولة', 'Retry')}</button>}
          </div>
        ) : phase === 'summary' ? (
          /* ── Provisioning Summary ── */
          <div id="wizard_summary" className="space-y-3">
            <div className="rounded-2xl p-4 text-center" style={surface}>
              <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-2" style={{ background: 'rgba(74,222,128,0.15)' }}><Check size={28} color="#4ade80" /></div>
              <p className="font-bold text-lg" id="wizard_success">{L('اكتمل التزويد', 'Provisioning complete')}</p>
              <p className="text-[12px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{form.brand_name} · {run?.tenantId} · <span id="summary_duration">{(durationMs / 1000).toFixed(2)}s</span></p>
            </div>

            {/* Verification */}
            <div className="rounded-2xl p-4" style={surface} id="wizard_verify">
              <p className="font-bold text-sm mb-2">{L('التحقّق التلقائي', 'Automatic verification')} · {verifications.filter(v => v.ok).length}/{verifications.length}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {verifications.map(v => (
                  <div key={v.name} className="flex items-center gap-2 text-[13px]">
                    {v.ok ? <Check size={14} color="#4ade80" /> : <X size={14} color="#f87171" />}
                    <span className="flex-1">{v.name}</span>
                    <span className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{v.detail}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Modules + warnings + errors */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl p-3" style={surface}>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('الوحدات المكتملة', 'Completed modules')} ({completedSteps.length})</p>
                <div className="flex flex-wrap gap-1">{completedSteps.map(s => <span key={s.key} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80' }}>{L(s.ar, s.en)}</span>)}</div>
              </div>
              <div className="rounded-2xl p-3" style={surface}>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: '#fbbf24' }}>{L('تحذيرات', 'Warnings')} ({warnings.length})</p>
                {warnings.length ? warnings.map((w, i) => <p key={i} className="text-[11px] mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>• {w}</p>) : <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>—</p>}
              </div>
              <div className="rounded-2xl p-3" style={surface}>
                <p className="text-[11px] font-bold mb-1.5" style={{ color: '#f87171' }}>{L('أخطاء', 'Errors')} ({failures.length})</p>
                {failures.length ? failures.map((f, i) => <p key={i} className="text-[11px] mb-1" style={{ color: '#f87171' }}>• {f}</p>) : <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>—</p>}
              </div>
            </div>

            {/* Links */}
            <div className="rounded-2xl p-4 space-y-2" style={surface}>
              <p className="font-bold text-sm mb-1">{L('الروابط', 'Links')}</p>
              {[[L('رابط الموقع', 'Website URL'), websiteUrl, previewUrl, 'summary_website_url'], [L('رابط لوحة الإدارة', 'Admin URL'), origin, origin, 'summary_admin_url'], [L('رابط المستأجر', 'Tenant URL'), websiteUrl, previewUrl, 'summary_tenant_url']].map(([label, url, open, id]) => (
                <div key={id as string} className="flex items-center justify-between gap-2 text-[13px]">
                  <span style={{ color: 'var(--color-on-surface-variant)' }}>{label}</span>
                  <a id={id as string} href={open as string} target="_blank" rel="noreferrer" className="font-bold flex items-center gap-1 truncate" style={{ color: 'var(--color-primary-fixed)' }}>{url}<ExternalLink size={11} /></a>
                </div>
              ))}
            </div>

            <button onClick={restart} className="h-10 px-5 rounded-xl text-sm font-bold cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('تهيئة مستأجر آخر', 'Onboard another tenant')}</button>
          </div>
        ) : (
          <>
            {/* ── INPUT STEPS ── */}
            <div className="rounded-2xl p-4 min-h-[220px]" style={surface} id={`wizard_step_${STEPS[step].key}`}>
              {STEPS[step].key === 'industry' && <div>
                <p style={lbl}>{L('اختر قطاع النشاط', 'Choose an industry')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {verticals.map(v => <button key={v} id={`wiz_industry_${v}`} onClick={() => { set('vertical', v); if (sel && sel.vertical !== v) set('templateId', ''); }} className="p-3 rounded-xl text-start cursor-pointer flex items-center gap-2" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${form.vertical === v ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}><Factory size={15} style={{ color: 'var(--color-primary-fixed)' }} /><span className="font-bold text-xs capitalize">{v}</span></button>)}
                </div>
              </div>}

              {STEPS[step].key === 'template' && <div>
                <p style={lbl}>{L('اختر قالب النشاط', 'Choose a business template')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {shownTemplates.map(t => <button key={t.id} id={`wiz_tpl_${t.id}`} onClick={() => set('templateId', t.id)} className="p-2.5 rounded-xl text-start cursor-pointer" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${form.templateId === t.id ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}>
                    <span className="flex items-center justify-between"><span className="font-bold text-xs">{t.name}</span><span className="w-3.5 h-3.5 rounded" style={{ background: themePresetsService.getConfig(t.theme_preset_id).colors.primary }} /></span>
                    <span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{t.vertical} · {t.subscription.plan}</span>
                  </button>)}
                </div>
              </div>}

              {STEPS[step].key === 'theme' && <div>
                <p style={lbl}>{L('السمة (افتراضي القالب أو اختر قالب سمة)', 'Theme (template default, or pick a preset)')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {presets.map(pr => <button key={pr.id} id={`wiz_preset_${pr.id}`} onClick={() => set('theme_preset_id', pr.id)} className="p-2 rounded-xl cursor-pointer flex items-center gap-1.5" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${(form.theme_preset_id || sel?.theme_preset_id) === pr.id ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}><span className="w-4 h-4 rounded" style={{ background: pr.config.colors.primary }} /><span className="text-xs font-bold">{pr.name}</span></button>)}
                </div>
              </div>}

              {STEPS[step].key === 'brand' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block"><span style={lbl}>{L('اسم العلامة', 'Brand name')}</span><input id="wiz_brand" style={inp} value={form.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="Acme Delivery" /></label>
                <label className="block"><span style={lbl}>{L('بريد الدعم', 'Support email')}</span><input id="wiz_email" style={inp} dir="ltr" value={form.support_email} onChange={e => set('support_email', e.target.value)} placeholder="support@acme.com" /></label>
                <label className="block"><span style={lbl}>{L('شعار العلامة (URL)', 'Brand logo (URL)')}</span><input id="wiz_logo" style={inp} dir="ltr" value={form.logo_url} onChange={e => set('logo_url', e.target.value)} placeholder="https://…/logo.png" /></label>
                <label className="block"><span style={lbl}>{L('اللون الأساسي', 'Primary color')}</span><input id="wiz_color" style={{ ...inp, padding: 3 }} type="color" value={form.primary_color || '#a3f95b'} onChange={e => set('primary_color', e.target.value)} /></label>
                <p className="text-[11px] sm:col-span-2" style={{ color: 'var(--color-on-surface-variant)' }}>{L('تُطبَّق الهوية عبر محرك السمة ومدير أصول العلامة داخل محرّك التزويد.', 'Brand is applied via the Theme Engine + Brand Assets inside the Provisioning Engine.')}</p>
              </div>}

              {STEPS[step].key === 'domain' && <div className="grid grid-cols-1 gap-3">
                <label className="block"><span style={lbl}>{L('النطاق الفرعي', 'Subdomain')}</span><span className="flex items-center gap-1.5"><input id="wiz_domain" style={{ ...inp, flex: 1 }} dir="ltr" value={form.subdomain} onChange={e => set('subdomain', e.target.value)} placeholder="acme" /><span className="text-[12px]" style={{ color: 'var(--color-on-surface-variant)' }}>.haatnow.app</span></span></label>
                <label className="block"><span style={lbl}>{L('نطاق مخصّص (اختياري)', 'Custom domain (optional)')}</span><input id="wiz_custom_domain" style={inp} dir="ltr" value={form.custom_domain} onChange={e => set('custom_domain', e.target.value)} placeholder="www.acme.com" /></label>
                <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('أولوية التشغيل: نطاق مخصّص ← نطاق فرعي ← مُعامل التطوير. التحقق وSSL يُداران من مركز الموقع.', 'Runtime priority: custom domain → subdomain → dev param. Verification + SSL are managed in the Website Center.')}</p>
              </div>}

              {STEPS[step].key === 'subscription' && <div>
                <p style={lbl}>{L('الخطة (افتراضي القالب أو اختر)', 'Plan (template default, or choose)')}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PLAN_CATALOG.map(pl => <button key={pl.key} id={`wiz_plan_${pl.key}`} onClick={() => set('plan', pl.key)} className="p-2.5 rounded-xl text-start cursor-pointer" style={{ background: 'var(--color-surface-container-lowest)', border: `1px solid ${(form.plan || sel?.subscription.plan) === pl.key ? 'var(--color-primary-fixed)' : 'var(--color-outline-variant)'}` }}><span className="font-bold text-xs block">{L(pl.ar, pl.en)}</span><span className="text-[10px]" style={{ color: 'var(--color-on-surface-variant)' }}>{pl.custom ? L('مخصّص', 'Custom') : pl.priceMonthly ? `$${pl.priceMonthly}/mo` : L('مجاني', 'Free')}</span></button>)}
                </div>
              </div>}

              {STEPS[step].key === 'admin' && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block"><span style={lbl}>{L('اسم المدير', 'Admin name')}</span><input id="wiz_admin_name" style={inp} value={form.admin_name} onChange={e => set('admin_name', e.target.value)} placeholder="Sara Admin" /></label>
                <label className="block"><span style={lbl}>{L('هاتف المدير', 'Admin phone')}</span><input id="wiz_admin_phone" style={inp} dir="ltr" value={form.admin_phone} onChange={e => set('admin_phone', e.target.value)} placeholder="+9665…" /></label>
                <p className="text-[11px] sm:col-span-2" style={{ color: 'var(--color-on-surface-variant)' }}>{L('يُسجَّل حساب المدير على المستأجر؛ الوضع الحيّ ينشئ مستخدم المصادقة ويُسنِد الدور عبر RBAC.', 'The admin account is recorded on the tenant; live mode creates the Auth user + assigns the role via RBAC.')}</p>
              </div>}

              {STEPS[step].key === 'review' && sel && <div className="space-y-1.5 text-[13px]" id="wizard_review">
                <p className="font-bold text-sm mb-1">{L('مراجعة', 'Review')}</p>
                {[[L('القطاع', 'Industry'), form.vertical], [L('القالب', 'Template'), sel.name], [L('السمة', 'Theme'), (form.theme_preset_id || sel.theme_preset_id)], [L('العلامة', 'Brand'), form.brand_name], [L('النطاق', 'Domain'), form.custom_domain || (form.subdomain ? `${form.subdomain}.haatnow.app` : '—')], [L('الخطة', 'Plan'), (form.plan || sel.subscription.plan)], [L('المدير', 'Admin'), form.admin_name ? `${form.admin_name} · ${form.admin_phone}` : '—'], [L('الشعار', 'Logo'), form.logo_url ? '✓' : '—']].map(([k, v]) => <div key={k as string} className="flex justify-between"><span style={{ color: 'var(--color-on-surface-variant)' }}>{k}</span><span className="font-bold">{v || '—'}</span></div>)}
              </div>}

              {STEPS[step].key === 'provision' && <div className="py-6 text-center"><Rocket size={30} style={{ color: 'var(--color-primary-fixed)' }} className="mx-auto mb-3" /><p className="font-bold">{L('جاهز للتزويد', 'Ready to provision')}</p><p className="text-[12px] mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>{L('سيستدعي المعالج محرّك التزويد ثم يتحقّق من كل الأسطح تلقائيًا.', 'The wizard calls the Provisioning Engine, then auto-verifies every surface.')}</p></div>}
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
