import { useEffect, useState } from 'react';
import { campaignService, Campaign, CampaignStatus, CampaignType, CampaignPlacement, SEASONAL_TEMPLATES, effectiveStatus } from '../../services/campaign.service';
import { COUNTRIES } from '../../config/countries';
import { Plus, Pencil, Trash2, Copy, Pause, Play, Archive, BarChart3, X as XIcon, Megaphone } from 'lucide-react';

const ACCENT = 'var(--color-primary-fixed)';
const card: React.CSSProperties = { background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '0.85rem', padding: '14px' };
const lbl: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: 'var(--color-on-surface-variant)', display: 'block', marginBottom: '5px' };
const inp: React.CSSProperties = { width: '100%', height: '36px', borderRadius: '8px', padding: '0 9px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'white', fontSize: '13px' };
const STATUS_COLOR: Record<CampaignStatus, string> = { draft: '#9aa0a6', scheduled: '#fbbf24', active: '#4ade80', paused: '#fb923c', expired: '#f87171', archived: '#6b7280' };
const STATUS_AR: Record<CampaignStatus, string> = { draft: 'مسودة', scheduled: 'مجدولة', active: 'نشطة', paused: 'متوقفة', expired: 'منتهية', archived: 'مؤرشفة' };
const TYPES: { v: CampaignType; l: string }[] = [{ v: 'banner', l: 'بانر' }, { v: 'sponsored_merchant', l: 'متجر مموَّل' }, { v: 'sponsored_product', l: 'منتج مموَّل' }, { v: 'promotion', l: 'عرض ترويجي' }, { v: 'seasonal', l: 'موسمية' }];
const PLACEMENTS: { v: CampaignPlacement; l: string }[] = [{ v: 'hero', l: 'البانر الرئيسي' }, { v: 'featured_merchants', l: 'متاجر مميزة' }, { v: 'featured_categories', l: 'فئات مميزة' }, { v: 'seasonal', l: 'عروض موسمية' }, { v: 'sponsored_products', l: 'منتجات مموَّلة' }];

const empty = (): Partial<Campaign> => ({ name: '', type: 'banner', placement: 'hero', status: 'draft', priority: 0, targeting: {}, title: '', subtitle: '', image_url: '', cta_label: 'اطلب الآن', destination_url: '' });

export function CampaignCenter() {
  const [list, setList] = useState<Campaign[]>([]);
  const [editing, setEditing] = useState<Partial<Campaign> | null>(null);
  const [stats, setStats] = useState<Record<string, { impressions: number; clicks: number; ctr: number; conversions: number; revenue: number }>>({});

  const refresh = async () => {
    const cs = await campaignService.list(); setList(cs);
    const s: typeof stats = {}; for (const c of cs) s[c.id] = await campaignService.analytics(c.id); setStats(s);
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => { if (!editing?.name?.trim()) return; await campaignService.save(editing); setEditing(null); refresh(); };
  const fromTemplate = (t: typeof SEASONAL_TEMPLATES[number]) => setEditing({ ...empty(), name: t.name, type: 'seasonal', placement: t.placement, title: t.title, subtitle: t.subtitle, cta_label: t.cta, status: 'draft' });
  const toggleCountry = (code: string) => setEditing(e => { const cur = e!.targeting?.countries || []; const next = cur.includes(code) ? cur.filter(x => x !== code) : [...cur, code]; return { ...e!, targeting: { ...e!.targeting, countries: next } }; });

  return (
    <div id="admin_campaigns_tab" className="space-y-4">
      {/* Seasonal templates + new */}
      <div style={card}>
        <div className="flex items-center justify-between mb-3">
          <button id="campaign_new_btn" onClick={() => setEditing(empty())} className="flex items-center gap-1.5 cursor-pointer" style={{ height: '36px', padding: '0 14px', borderRadius: '0.7rem', background: ACCENT, color: 'var(--color-on-primary-fixed)', fontWeight: 800, fontSize: '13px', border: 'none' }}><Plus size={15} /> حملة جديدة</button>
          <h3 className="text-title-md font-bold text-white flex items-center gap-2"><Megaphone size={18} color={ACCENT} /> مركز الحملات</h3>
        </div>
        <span style={lbl}>قوالب موسمية جاهزة</span>
        <div className="flex flex-wrap gap-2">
          {SEASONAL_TEMPLATES.map(t => (
            <button key={t.key} onClick={() => fromTemplate(t)} className="cursor-pointer" style={{ fontSize: '12px', fontWeight: 600, padding: '6px 11px', borderRadius: '999px', background: 'rgba(163,249,91,0.06)', border: '1px solid rgba(163,249,91,0.18)', color: ACCENT }}>{t.name}</button>
          ))}
        </div>
      </div>

      {/* Editor */}
      {editing && (
        <div style={card} id="campaign_editor">
          <div className="flex items-center justify-between mb-3"><button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><XIcon size={18} /></button><h4 className="font-bold text-white">{editing.id ? 'تعديل الحملة' : 'حملة جديدة'}</h4></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><span style={lbl}>اسم الحملة</span><input id="campaign_name" value={editing.name || ''} onChange={e => setEditing({ ...editing, name: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>النوع</span><select value={editing.type} onChange={e => setEditing({ ...editing, type: e.target.value as CampaignType })} style={inp}>{TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            <div><span style={lbl}>المكان</span><select value={editing.placement} onChange={e => setEditing({ ...editing, placement: e.target.value as CampaignPlacement })} style={inp}>{PLACEMENTS.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select></div>
            <div className="col-span-2"><span style={lbl}>العنوان</span><input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} style={inp} /></div>
            <div className="col-span-2"><span style={lbl}>الوصف</span><input value={editing.subtitle || ''} onChange={e => setEditing({ ...editing, subtitle: e.target.value })} style={inp} /></div>
            <div className="col-span-2"><span style={lbl}>رابط الصورة</span><input value={editing.image_url || ''} onChange={e => setEditing({ ...editing, image_url: e.target.value })} dir="ltr" style={inp} placeholder="https://…" /></div>
            <div><span style={lbl}>زر الإجراء (CTA)</span><input value={editing.cta_label || ''} onChange={e => setEditing({ ...editing, cta_label: e.target.value })} style={inp} /></div>
            <div><span style={lbl}>رابط الوجهة</span><input value={editing.destination_url || ''} onChange={e => setEditing({ ...editing, destination_url: e.target.value })} dir="ltr" style={inp} /></div>
            <div><span style={lbl}>الأولوية</span><input type="number" value={editing.priority ?? 0} onChange={e => setEditing({ ...editing, priority: parseInt(e.target.value) || 0 })} style={inp} /></div>
            <div><span style={lbl}>الحالة</span><select value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value as CampaignStatus })} style={inp}>{(['draft', 'scheduled', 'active', 'paused', 'archived'] as CampaignStatus[]).map(s => <option key={s} value={s}>{STATUS_AR[s]}</option>)}</select></div>
            <div><span style={lbl}>تبدأ</span><input type="date" value={(editing.start_date || '').slice(0, 10)} onChange={e => setEditing({ ...editing, start_date: e.target.value || null })} style={inp} /></div>
            <div><span style={lbl}>تنتهي</span><input type="date" value={(editing.end_date || '').slice(0, 10)} onChange={e => setEditing({ ...editing, end_date: e.target.value || null })} style={inp} /></div>
            <div className="col-span-2">
              <span style={lbl}>الاستهداف — الدول (فارغ = كل الدول)</span>
              <div className="flex flex-wrap gap-1.5">
                {Object.values(COUNTRIES).map(c => { const on = (editing.targeting?.countries || []).includes(c.code); return (
                  <button key={c.code} onClick={() => toggleCountry(c.code)} className="cursor-pointer" style={{ fontSize: '12px', padding: '4px 9px', borderRadius: '999px', background: on ? 'rgba(163,249,91,0.12)' : 'rgba(255,255,255,0.03)', border: on ? '1px solid rgba(163,249,91,0.4)' : '1px solid rgba(255,255,255,0.08)', color: on ? ACCENT : 'white' }}>{c.flag} {c.nameAr}</button>
                ); })}
              </div>
            </div>
            <div className="col-span-2"><span style={lbl}>الفئات/المتاجر المستهدفة (مفصولة بفاصلة)</span><input value={(editing.targeting?.categories || []).join(',')} onChange={e => setEditing({ ...editing, targeting: { ...editing.targeting, categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } })} style={inp} placeholder="مطاعm, صيدليات…" /></div>
          </div>
          <button id="campaign_save_btn" onClick={save} className="w-full mt-3 cursor-pointer" style={{ height: '40px', borderRadius: '0.7rem', background: ACCENT, color: 'var(--color-on-primary-fixed)', fontWeight: 800, border: 'none' }}>حفظ الحملة</button>
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {list.length === 0 && <div style={card}><p className="text-center text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>لا توجد حملات. أنشئ واحدة أو ابدأ من قالب موسمي.</p></div>}
        {list.map(c => {
          const es = effectiveStatus(c); const a = stats[c.id];
          return (
            <div key={c.id} style={card} id={`campaign_row_${c.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing(c)} aria-label="edit" style={{ background: 'none', border: 'none', color: ACCENT, cursor: 'pointer' }}><Pencil size={15} /></button>
                  <button onClick={async () => { await campaignService.clone(c.id); refresh(); }} aria-label="clone" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Copy size={15} /></button>
                  {es === 'active' || c.status === 'active' ? <button onClick={async () => { await campaignService.setStatus(c.id, 'paused'); refresh(); }} aria-label="pause" style={{ background: 'none', border: 'none', color: '#fb923c', cursor: 'pointer' }}><Pause size={15} /></button>
                    : <button onClick={async () => { await campaignService.setStatus(c.id, 'active'); refresh(); }} aria-label="resume" style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer' }}><Play size={15} /></button>}
                  <button onClick={async () => { await campaignService.setStatus(c.id, 'archived'); refresh(); }} aria-label="archive" style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}><Archive size={15} /></button>
                  <button id={`campaign_del_${c.id}`} onClick={async () => { await campaignService.remove(c.id); refresh(); }} aria-label="delete" style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}><Trash2 size={15} /></button>
                </div>
                <div className="text-end min-w-0">
                  <p className="font-bold text-white truncate">{c.name}</p>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: STATUS_COLOR[es] }}>{STATUS_AR[es]}</span>
                  <span style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)' }}> · {PLACEMENTS.find(x => x.v === c.placement)?.l}</span>
                </div>
              </div>
              {a && (
                <div className="flex items-center gap-4 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: '11px', color: 'var(--color-on-surface-variant)' }}>
                  <BarChart3 size={13} color={ACCENT} />
                  <span>مشاهدات: {a.impressions}</span><span>نقرات: {a.clicks}</span><span>CTR: {a.ctr}%</span><span>تحويلات: {a.conversions}</span><span>إيراد: {a.revenue}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
