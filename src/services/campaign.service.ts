import { supabase } from '../lib/supabase';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
const C_KEY = 'haat_sb_campaigns';
const E_KEY = 'haat_sb_campaign_events';

export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'expired' | 'archived';
export type CampaignType = 'banner' | 'sponsored_merchant' | 'sponsored_product' | 'promotion' | 'seasonal';
export type CampaignPlacement = 'hero' | 'featured_merchants' | 'featured_categories' | 'seasonal' | 'sponsored_products';

export interface Targeting {
  countries?: string[]; cities?: string[]; zones?: string[];
  merchants?: string[]; branches?: string[]; categories?: string[];
  products?: string[]; segments?: string[];
}
export interface Campaign {
  id: string; name: string; type: CampaignType; status: CampaignStatus; placement: CampaignPlacement;
  title: string | null; subtitle: string | null; image_url: string | null; cta_label: string | null; destination_url: string | null;
  priority: number; start_date: string | null; end_date: string | null; targeting: Targeting; created_at: string;
}

// PHASE D — seasonal templates (Talabat/Jahez-style).
export const SEASONAL_TEMPLATES: { key: string; name: string; title: string; subtitle: string; cta: string; placement: CampaignPlacement }[] = [
  { key: 'ramadan', name: 'حملة رمضان', title: 'رمضان كريم 🌙', subtitle: 'خصومات حصرية طوال الشهر الكريم', cta: 'اطلب الآن', placement: 'hero' },
  { key: 'eid', name: 'حملة العيد', title: 'عيد سعيد 🎉', subtitle: 'عروض العيد على كل الطلبات', cta: 'تسوّق العيد', placement: 'hero' },
  { key: 'worldcup', name: 'كأس العالم', title: 'أجواء كأس العالم ⚽', subtitle: 'وجبات المباريات بأفضل الأسعار', cta: 'اطلب وجبتك', placement: 'hero' },
  { key: 'national', name: 'اليوم الوطني', title: 'اليوم الوطني 🇸🇦', subtitle: 'احتفل معنا بخصومات وطنية', cta: 'اكتشف العروض', placement: 'hero' },
  { key: 'blackfriday', name: 'الجمعة السوداء', title: 'Black Friday 🖤', subtitle: 'أكبر تخفيضات السنة', cta: 'تسوّق الآن', placement: 'hero' },
  { key: 'whitefriday', name: 'الجمعة البيضاء', title: 'White Friday 🤍', subtitle: 'خصومات تصل إلى ٧٠٪', cta: 'تسوّق الآن', placement: 'hero' },
  { key: 'backtoschool', name: 'العودة للمدارس', title: 'العودة للمدارس 🎒', subtitle: 'كل ما تحتاجه لبداية موسم جديد', cta: 'تسوّق الآن', placement: 'hero' },
  { key: 'newyear', name: 'رأس السنة', title: 'سنة جديدة سعيدة 🎆', subtitle: 'ابدأ عامك بأفضل العروض', cta: 'اطلب الآن', placement: 'hero' },
];

const read = <T>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

// Resolved (display) status — schedule-aware.
export function effectiveStatus(c: Campaign): CampaignStatus {
  if (c.status === 'draft' || c.status === 'paused' || c.status === 'archived') return c.status;
  const now = Date.now();
  if (c.end_date && new Date(c.end_date).getTime() < now) return 'expired';
  if (c.start_date && new Date(c.start_date).getTime() > now) return 'scheduled';
  return 'active';
}

export const campaignService = {
  async list(): Promise<Campaign[]> {
    if (SANDBOX) return read<Campaign[]>(C_KEY, []);
    const { data } = await supabase.from('campaigns').select('*').order('priority', { ascending: false });
    return (data as Campaign[]) || [];
  },
  async save(c: Partial<Campaign> & { id?: string }): Promise<Campaign> {
    if (SANDBOX) {
      const all = read<Campaign[]>(C_KEY, []);
      if (c.id) { const i = all.findIndex(x => x.id === c.id); if (i >= 0) { all[i] = { ...all[i], ...c } as Campaign; write(C_KEY, all); return all[i]; } }
      const created: Campaign = {
        id: `cmp-${Date.now()}`, name: c.name || 'حملة', type: c.type || 'banner', status: c.status || 'draft', placement: c.placement || 'hero',
        title: c.title ?? null, subtitle: c.subtitle ?? null, image_url: c.image_url ?? null, cta_label: c.cta_label ?? null, destination_url: c.destination_url ?? null,
        priority: c.priority ?? 0, start_date: c.start_date ?? null, end_date: c.end_date ?? null, targeting: c.targeting ?? {}, created_at: new Date().toISOString(),
      };
      all.unshift(created); write(C_KEY, all); return created;
    }
    if (c.id) { const { data } = await supabase.from('campaigns').update({ ...c, updated_at: new Date().toISOString() }).eq('id', c.id).select().single(); return data as Campaign; }
    const { data } = await supabase.from('campaigns').insert(c).select().single(); return data as Campaign;
  },
  async setStatus(id: string, status: CampaignStatus) { return this.save({ id, status }); },
  async remove(id: string) {
    if (SANDBOX) { write(C_KEY, read<Campaign[]>(C_KEY, []).filter(c => c.id !== id)); return; }
    await supabase.from('campaigns').delete().eq('id', id);
  },
  async clone(id: string): Promise<Campaign | null> {
    const all = await this.list(); const src = all.find(c => c.id === id); if (!src) return null;
    const { id: _i, created_at: _c, ...rest } = src;
    return this.save({ ...rest, name: `${src.name} (نسخة)`, status: 'draft' });
  },
  // PHASE G — active campaigns for a homepage placement + country.
  async getActiveByPlacement(placement: CampaignPlacement, country: string): Promise<Campaign[]> {
    const all = await this.list();
    return all
      .filter(c => c.placement === placement && effectiveStatus(c) === 'active')
      .filter(c => { const ct = c.targeting?.countries; return !ct || ct.length === 0 || ct.includes(country); })
      .sort((a, b) => b.priority - a.priority);
  },
  // PHASE H — analytics.
  async track(campaignId: string, eventType: 'impression' | 'click' | 'conversion', extra?: { orderId?: string; revenue?: number }) {
    if (SANDBOX) { const all = read<any[]>(E_KEY, []); all.push({ id: `ev-${Date.now()}-${Math.round(performance.now())}`, campaign_id: campaignId, event_type: eventType, order_id: extra?.orderId, revenue: extra?.revenue, created_at: new Date().toISOString() }); write(E_KEY, all.slice(-5000)); return; }
    await supabase.from('campaign_events').insert({ campaign_id: campaignId, event_type: eventType, order_id: extra?.orderId, revenue: extra?.revenue });
  },
  async analytics(campaignId: string): Promise<{ impressions: number; clicks: number; ctr: number; conversions: number; revenue: number }> {
    let rows: any[] = [];
    if (SANDBOX) rows = read<any[]>(E_KEY, []).filter(e => e.campaign_id === campaignId);
    else { const { data } = await supabase.from('campaign_events').select('event_type, revenue').eq('campaign_id', campaignId); rows = data || []; }
    const impressions = rows.filter(r => r.event_type === 'impression').length;
    const clicks = rows.filter(r => r.event_type === 'click').length;
    const conversions = rows.filter(r => r.event_type === 'conversion').length;
    const revenue = rows.filter(r => r.event_type === 'conversion').reduce((s, r) => s + Number(r.revenue || 0), 0);
    return { impressions, clicks, ctr: impressions ? Math.round((clicks / impressions) * 1000) / 10 : 0, conversions, revenue };
  },
};
