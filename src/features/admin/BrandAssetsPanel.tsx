import React, { useState } from 'react';
import { ImagePlus, Upload, X, ImageIcon } from 'lucide-react';
import { assetsService, BRAND_SLOTS, type BrandSlot } from '../../experience/assets.service';
import { tenantService } from '../../services/tenant.service';
import { toast } from '../../components/ui/feedback';
import { Can } from '../../hooks/useRbac';

// Brand Asset Manager (Phase 0.3) — the BRAND domain only. Reuses assetsService (the ONE upload/storage/asset
// pipeline) + tenant.service (persist to tenant brand fields). Deliberately imports NO theme/preset code —
// Brand and Theme stay loosely coupled: brand assets never depend on Theme Presets.
const surface: React.CSSProperties = { background: 'var(--color-surface-container-high)', border: '1px solid var(--color-outline-variant)' };
const inp: React.CSSProperties = { width: '100%', height: 32, padding: '0 10px', borderRadius: 8, background: 'var(--color-surface-container-lowest)', color: 'var(--color-on-surface)', border: '1px solid var(--color-outline-variant)', fontSize: 11, outline: 'none' };

export const BrandAssetsPanel: React.FC<{ tenant: any; lang: 'ar' | 'en'; onChanged?: () => void }> = ({ tenant, lang, onChanged }) => {
  const L = (ar: string, en: string) => (lang === 'ar' ? ar : en);
  const [form, setForm] = useState<Record<string, string>>(() => { const f: Record<string, string> = {}; BRAND_SLOTS.forEach(s => { f[s.field] = tenant[s.field] || ''; }); return f; });
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const setField = (field: string, url: string) => setForm(f => ({ ...f, [field]: url }));

  const uploadInto = async (slot: BrandSlot, file?: File) => {
    if (!file) return;
    setBusy(slot.key);
    try { const item = await assetsService.upload(file, slot.category); setField(slot.field, item.url); toast.success(L('تم رفع الأصل', 'Asset uploaded')); }
    catch { toast.error(L('تعذّر الرفع', 'Upload failed')); }
    setBusy(null);
  };
  const save = async () => {
    setSaving(true);
    const patch: Record<string, any> = {}; BRAND_SLOTS.forEach(s => { patch[s.field] = form[s.field]; });
    const { error } = await tenantService.saveBranding(tenant.id, patch);
    setSaving(false);
    if (error) return toast.error(L('تعذّر حفظ الأصول', 'Could not save assets'));
    toast.success(L('تم حفظ أصول العلامة', 'Brand assets saved')); onChanged?.();
  };

  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} id="brand_assets_panel">
      <h3 className="font-bold text-sm flex items-center gap-2 mb-1"><ImagePlus size={16} style={{ color: 'var(--color-primary-fixed)' }} />{L('مدير أصول العلامة', 'Brand Asset Manager')}</h3>
      <p className="text-[11px] mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>{L('يُعاد استخدام خط الرفع/التخزين الحالي (assets.service). الأصول مستقلة تمامًا عن قوالب السمات.', 'Reuses the existing upload/storage pipeline (assets.service). Assets are fully independent of Theme Presets.')}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {BRAND_SLOTS.map(slot => {
          const url = form[slot.field] || '';
          return (
            <div key={slot.key} id={`brandslot_${slot.key}`} className="rounded-xl p-2.5" style={surface}>
              <div className="flex items-center gap-2.5">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden" style={{ background: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)' }}>
                  {url ? <img src={url} alt={slot.en} className="w-full h-full object-contain" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} /> : <ImageIcon size={16} style={{ color: 'var(--color-on-surface-variant)' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold mb-1">{L(slot.ar, slot.en)}</p>
                  <div className="flex items-center gap-1.5">
                    <Can perm="platform.whitelabel.manage">
                      <label className="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg cursor-pointer shrink-0" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>
                        <Upload size={11} />{busy === slot.key ? L('جارٍ…', '…') : L('رفع', 'Upload')}
                        <input type="file" accept="image/*" hidden onChange={e => uploadInto(slot, e.target.files?.[0])} />
                      </label>
                    </Can>
                    <input id={`brandurl_${slot.key}`} value={url} dir="ltr" placeholder="https://…" style={inp} onChange={e => setField(slot.field, e.target.value)} />
                    {url && <button onClick={() => setField(slot.field, '')} className="p-1 rounded-lg cursor-pointer shrink-0" style={{ color: '#f87171' }} title={L('مسح', 'Clear')}><X size={13} /></button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Can perm="platform.whitelabel.manage">
        <button onClick={save} disabled={saving} id="brand_assets_save" className="mt-3 h-10 px-5 rounded-xl text-sm font-bold cursor-pointer" style={{ background: 'var(--color-primary-fixed)', color: 'var(--color-on-primary-fixed)' }}>{saving ? L('جارٍ الحفظ…', 'Saving…') : L('حفظ أصول العلامة', 'Save brand assets')}</button>
      </Can>
    </div>
  );
};
