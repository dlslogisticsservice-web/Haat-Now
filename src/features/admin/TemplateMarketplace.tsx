import React, { useState } from 'react';
import { LayoutGrid, Rocket, Copy, Upload, Trash2, Eye, CheckCircle2, Star } from 'lucide-react';
import { WorkspaceHeader } from '../../components/admin/EnterpriseUI';
import { toast, inputDialog } from '../../components/ui/feedback';
import { templatesService, type TemplateManifest } from '../../services/templates.service';
import { themePresetsService } from '../../services/themePresets.service';
import { provisioningService } from '../../services/provisioning.service';
import { Can } from '../../hooks/useRbac';

const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const swatch = (id: string) => themePresetsService.getConfig(id).colors.primary;

/** Template Marketplace — declarative manifests. CRUD · preview · versioning · import/export · validate ·
 *  assignment · provision. The generic Provisioning Engine only receives a derived spec (toSpec). */
export const TemplateMarketplace: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [items, setItems] = useState<TemplateManifest[]>(() => templatesService.list());
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = () => setItems(templatesService.list().slice());

  const newTemplate = async () => { const name = await inputDialog({ title: L('اسم القالب', 'Template name'), placeholder: L('مثال: مقهى', 'e.g. Coffee Shop') }); if (!name?.trim()) return; templatesService.create(name.trim()); refresh(); toast.success(L('تم إنشاء القالب', 'Template created')); };
  const importT = async () => { const json = await inputDialog({ title: L('استيراد قالب (JSON)', 'Import template (JSON)'), placeholder: '{ "vertical": "...", ... }' }); if (!json?.trim()) return; const t = templatesService.importTemplate(json.trim()); if (!t) return toast.error(L('JSON غير صالح', 'Invalid JSON')); refresh(); toast.success(L('تم الاستيراد', 'Imported')); };
  const dup = (t: TemplateManifest) => { templatesService.duplicate(t.id); refresh(); toast.success(L('تم التكرار', 'Duplicated')); };
  const exportT = async (t: TemplateManifest) => { try { await navigator.clipboard.writeText(templatesService.exportTemplate(t.id)); toast.success(L('تم نسخ JSON', 'JSON copied')); } catch { toast.success(L('JSON جاهز', 'JSON ready')); } };
  const del = (t: TemplateManifest) => { templatesService.remove(t.id); refresh(); toast.success(L('تم الحذف', 'Deleted')); };
  const validate = (t: TemplateManifest) => { const v = templatesService.validate(t); v.valid ? toast.success(L('القالب صالح ✓', 'Template valid ✓')) : toast.error(v.errors.join(' · ')); };
  const provision = async (t: TemplateManifest) => {
    const v = templatesService.validate(t); if (!v.valid) return toast.error(L('القالب غير صالح: ', 'Invalid template: ') + v.errors.join(', '));
    const brand = await inputDialog({ title: L('اسم علامة المستأجر', 'Tenant brand name'), placeholder: t.name + ' Co.' }); if (!brand?.trim()) return;
    setBusy(true);
    const run = await provisioningService.provision(templatesService.toSpec(t, { brand_name: brand.trim() }));
    if (run.tenantId) templatesService.assignToTenant(run.tenantId, t.id);
    setBusy(false);
    run.status === 'completed' ? toast.success(L(`تم تزويد مستأجر من قالب ${t.name}`, `Provisioned a tenant from ${t.name}`)) : toast.error(L('توقف التزويد', 'Provisioning stopped'));
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="template_marketplace">
      <WorkspaceHeader Icon={LayoutGrid} title={L('سوق القوالب', 'Template Marketplace')} subtitle={L('بيانات إعلانية فقط — يزوّد المحرّك العام منها دون منطق قطاعي', 'Declarative manifests only — the generic engine provisions from them, no vertical logic')} />
      <Can perm="platform.tenants.manage" fallback={<div className="p-4 rounded-2xl text-sm" style={surface}>{L('لا تملك صلاحية إدارة القوالب.', 'You lack template management permission.')}</div>}>
        <div className="flex gap-2 mb-3">
          <button onClick={newTemplate} id="tpl_new" className="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('قالب جديد', 'New template')}</button>
          <button onClick={importT} id="tpl_import" className="text-xs font-bold px-3 py-2 rounded-lg cursor-pointer flex items-center gap-1" style={{ ...surface, color: 'var(--color-on-surface)' }}><Upload size={13} />{L('استيراد', 'Import')}</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {items.map(t => {
            const pv = templatesService.preview(t);
            return (
              <div key={t.id} id={`tpl_${t.id}`} className="rounded-2xl p-3" style={surface}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-sm flex items-center gap-1.5">{t.system && <Star size={11} style={{ color: '#fbbf24' }} />}{t.name}</span>
                  <span className="w-4 h-4 rounded" style={{ background: swatch(t.theme_preset_id), border: '1px solid rgba(255,255,255,0.15)' }} />
                </div>
                <div className="flex flex-wrap gap-1 text-[10px] mb-2" style={{ color: 'var(--color-on-surface-variant)' }}>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-lowest)' }}>{t.vertical}</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-lowest)' }}>{t.subscription.plan}</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-lowest)' }}>v{t.version}</span>
                  <span className="px-1.5 py-0.5 rounded" style={{ background: 'var(--color-surface-container-lowest)' }}>{pv.features.length} {L('ميزة', 'feat')}</span>
                </div>
                {open === t.id && (
                  <div className="text-[11px] mb-2 p-2 rounded-lg space-y-0.5" style={{ background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface-variant)' }}>
                    <div>{L('الصفحات', 'Pages')}: {pv.pages.join(', ')}</div>
                    <div>{L('التكاملات', 'Integrations')}: {pv.integrations.join(', ') || '—'}</div>
                    <div>{L('الأدوار', 'Roles')}: {pv.roles.join(', ')}</div>
                    <div>{L('الميزات', 'Features')}: {pv.features.join(', ')}</div>
                    <div>{L('بيانات تجريبية', 'Demo profile')}: {pv.demo}</div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => provision(t)} disabled={busy} id={`tpl_provision_${t.id}`} className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer flex items-center gap-1" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Rocket size={11} />{L('تزويد', 'Provision')}</button>
                  <button onClick={() => setOpen(open === t.id ? null : t.id)} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Eye size={11} className="inline" /> {L('معاينة', 'Preview')}</button>
                  <button onClick={() => validate(t)} id={`tpl_validate_${t.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><CheckCircle2 size={11} className="inline" /></button>
                  <button onClick={() => dup(t)} id={`tpl_dup_${t.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Copy size={11} className="inline" /></button>
                  <button onClick={() => exportT(t)} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}>{L('تصدير', 'Export')}</button>
                  {!t.system && <button onClick={() => del(t)} id={`tpl_del_${t.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={{ ...surface, color: '#f87171' }}><Trash2 size={11} className="inline" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      </Can>
    </div>
  );
};
