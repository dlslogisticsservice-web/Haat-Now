import React, { useEffect, useState } from 'react';
import { Palette, Save, Copy, Upload, Trash2, Check, Eye, Users, Star } from 'lucide-react';
import { useDesign } from '../../design/DesignContext';
import { themePresetsService, type ThemePreset } from '../../services/themePresets.service';
import { tenantService } from '../../services/tenant.service';
import { adminCrud } from '../../services/admin-crud.service';
import { toast, inputDialog } from '../../components/ui/feedback';
import { Can } from '../../hooks/useRbac';

const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const Sw: React.FC<{ c: string }> = ({ c }) => <span className="w-4 h-4 rounded" style={{ background: c, border: '1px solid rgba(255,255,255,0.15)' }} />;

/** Theme Presets panel — lives inside Design Center. Reuses designSystem + DesignContext (apply→publish→
 *  applyDesign propagates :root to every surface) + themePresets.service + tenant.service (assign). */
export const ThemePresetsPanel: React.FC<{ lang: 'ar' | 'en' }> = ({ lang }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const d = useDesign();
  const [presets, setPresets] = useState<ThemePreset[]>(() => themePresetsService.list());
  const [tenants, setTenants] = useState<any[]>([]);
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const refresh = () => setPresets(themePresetsService.list().slice());

  useEffect(() => { adminCrud('tenants').list().then((r: any) => setTenants(r.data || [])).catch(() => setTenants([])); }, []);

  const saveCurrent = async () => {
    const name = await inputDialog({ title: L('اسم القالب الجديد', 'New preset name'), placeholder: L('مثال: هوية الصيف', 'e.g. Summer brand') });
    if (!name?.trim()) return;
    themePresetsService.create(name.trim(), d.draftConfig); refresh(); toast.success(L('تم حفظ التصميم الحالي كقالب', 'Saved current design as preset'));
  };
  const importPreset = async () => {
    const json = await inputDialog({ title: L('استيراد قالب (JSON)', 'Import preset (JSON)'), placeholder: '{ "name": "...", "config": {...} }' });
    if (!json?.trim()) return;
    const p = themePresetsService.importPreset(json.trim()); if (!p) return toast.error(L('JSON غير صالح', 'Invalid JSON'));
    refresh(); toast.success(L('تم استيراد القالب', 'Preset imported'));
  };
  const apply = (p: ThemePreset) => { d.applyPreset(p.config); toast.success(L('تم تطبيق القالب ونشره على كل الواجهات', 'Preset applied + published across all surfaces')); };
  const preview = (p: ThemePreset) => { themePresetsService.applyConfig(p.config); toast.success(L('معاينة حيّة (غير منشورة)', 'Live preview (unpublished)')); };
  const duplicate = (p: ThemePreset) => { themePresetsService.duplicate(p.id); refresh(); toast.success(L('تم تكرار القالب', 'Preset duplicated')); };
  const exportP = async (p: ThemePreset) => { const json = themePresetsService.exportPreset(p.id); try { await navigator.clipboard.writeText(json); toast.success(L('تم نسخ JSON القالب', 'Preset JSON copied')); } catch { toast.success(L('JSON جاهز', 'JSON ready')); } };
  const del = (p: ThemePreset) => { themePresetsService.remove(p.id); refresh(); toast.success(L('تم حذف القالب', 'Preset deleted')); };
  const assign = async (presetId: string) => {
    const ids = Object.keys(picked).filter(k => picked[k]);
    if (!ids.length) return toast.error(L('اختر مستأجرًا واحدًا على الأقل', 'Pick at least one tenant'));
    for (const id of ids) await tenantService.update(id, { theme_preset_id: presetId });
    setAssignFor(null); setPicked({}); toast.success(L(`تم تعيين القالب لـ ${ids.length} مستأجر`, `Preset assigned to ${ids.length} tenant(s)`));
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="theme_presets_panel">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-bold text-sm flex items-center gap-2"><Palette size={16} style={{ color: 'var(--color-primary-fixed)' }} />{L('قوالب السمات', 'Theme Presets')}</h3>
        <Can perm="platform.design.manage">
          <div className="flex gap-2">
            <button onClick={saveCurrent} id="preset_save_current" className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Save size={14} />{L('حفظ التصميم الحالي', 'Save current')}</button>
            <button onClick={importPreset} id="preset_import" className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg cursor-pointer" style={{ ...surface, color: 'var(--color-on-surface)' }}><Upload size={14} />{L('استيراد', 'Import')}</button>
          </div>
        </Can>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {presets.map(p => (
          <div key={p.id} id={`preset_${p.id}`} className="rounded-2xl p-3" style={surface}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm flex items-center gap-1.5">{p.system && <Star size={12} style={{ color: '#fbbf24' }} />}{p.name}</span>
              <span className="flex items-center gap-1"><Sw c={p.config.colors.primary} /><Sw c={p.config.colors.secondary} /><Sw c={p.config.colors.accent} /></span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Can perm="platform.design.manage" fallback={<button onClick={() => preview(p)} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Eye size={11} className="inline" /> {L('معاينة', 'Preview')}</button>}>
                <button onClick={() => apply(p)} id={`apply_${p.id}`} className="text-[11px] font-bold px-2.5 py-1 rounded-lg cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}><Check size={11} className="inline" /> {L('تطبيق', 'Apply')}</button>
                <button onClick={() => preview(p)} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Eye size={11} className="inline" /> {L('معاينة', 'Preview')}</button>
                <button onClick={() => duplicate(p)} id={`dup_${p.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Copy size={11} className="inline" /> {L('تكرار', 'Duplicate')}</button>
                <button onClick={() => exportP(p)} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}>{L('تصدير', 'Export')}</button>
                <button onClick={() => setAssignFor(assignFor === p.id ? null : p.id)} id={`assign_${p.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={surface}><Users size={11} className="inline" /> {L('تعيين', 'Assign')}</button>
                {!p.system && <button onClick={() => del(p)} id={`del_${p.id}`} className="text-[11px] px-2 py-1 rounded-lg cursor-pointer" style={{ ...surface, color: '#f87171' }}><Trash2 size={11} className="inline" /></button>}
              </Can>
            </div>
            {assignFor === p.id && (
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid var(--color-outline-variant)' }}>
                <p className="text-[11px] mb-1.5" style={{ color: 'var(--color-on-surface-variant)' }}>{L('عيّن هذا القالب لمستأجر أو أكثر:', 'Assign this preset to one or more tenants:')}</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {tenants.length === 0 ? <p className="text-[11px]" style={{ color: 'var(--color-on-surface-variant)' }}>{L('لا مستأجرون', 'No tenants')}</p> : tenants.slice(0, 30).map(t => (
                    <label key={t.id} className="flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={!!picked[t.id]} onChange={e => setPicked(s => ({ ...s, [t.id]: e.target.checked }))} />
                      {t.brand_name || t.slug || t.id}
                    </label>
                  ))}
                </div>
                <button onClick={() => assign(p.id)} id={`assign_confirm_${p.id}`} className="mt-2 text-[11px] font-bold px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{L('تأكيد التعيين', 'Confirm assign')}</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <p className="text-[11px] mt-3" style={{ color: 'var(--color-on-surface-variant)' }}>{L('«تطبيق» ينشر القالب عبر محرّك التصميم (applyDesign) فيسري على العميل والكابتن والتاجر والإدارة والموقع. يخزّن المستأجر معرّف القالب فقط + تعديلاته.', 'Apply publishes via the design engine (applyDesign) → propagates to Customer/Driver/Merchant/Admin/Website. A tenant stores only the preset id + its overrides.')}</p>
    </div>
  );
};
