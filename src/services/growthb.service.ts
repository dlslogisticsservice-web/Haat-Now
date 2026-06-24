import { supabase } from '../lib/supabase';

/** Enterprise-B growth/loyalty/retention service (advanced coupons, loyalty rules/rewards,
 *  segments, promotions, banners, merchant growth, retention, analytics, templates). */
export const growthbService = {
  // ── M1 advanced coupons ─────────────────────────────────────────────────────
  async redeemAdvancedCoupon(code: string, customerId: string, orderId: string, orderAmount: number, opts?: { country?: string; city?: string; merchant?: string }): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase.rpc('redeem_advanced_coupon', {
      p_code: code, p_customer: customerId, p_order_id: orderId, p_order_amount: orderAmount,
      p_country: opts?.country ?? null, p_city: opts?.city ?? null, p_merchant: opts?.merchant ?? null,
    });
    return { data, error };
  },
  async createCoupon(c: any): Promise<{ error: any }> {
    const { error } = await supabase.from('coupons').insert(c);
    return { error };
  },
  async listCoupons(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async toggleCoupon(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('coupons').update({ is_active: isActive }).eq('id', id);
    return { error };
  },
  async couponRedemptions(couponId?: string): Promise<{ data: any[]; error: any }> {
    let q = supabase.from('coupon_redemptions').select('*').order('redeemed_at', { ascending: false }).limit(100);
    if (couponId) q = q.eq('coupon_id', couponId);
    const { data, error } = await q;
    return { data: data || [], error };
  },

  // ── M3 loyalty rules + rewards ──────────────────────────────────────────────
  async awardPoints(customerId: string, event: 'order' | 'campaign' | 'referral' | 'signup', amount = 0, ref?: string): Promise<number> {
    const { data } = await supabase.rpc('award_points_for_event', { p_customer: customerId, p_event: event, p_amount: amount, p_ref: ref ?? null });
    return Number(data ?? 0);
  },
  async rewards(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('loyalty_rewards').select('*').eq('is_active', true).order('points_cost', { ascending: true });
    return { data: data || [], error };
  },
  async redeemReward(customerId: string, rewardId: string): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase.rpc('redeem_loyalty_reward', { p_customer: customerId, p_reward_id: rewardId });
    return { data, error };
  },
  async loyaltyRules(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('loyalty_rules').select('*').order('event_type', { ascending: true });
    return { data: data || [], error };
  },

  // ── M4 segments ─────────────────────────────────────────────────────────────
  async recomputeSegments(): Promise<{ rows: number; error: any }> {
    const { data, error } = await supabase.rpc('recompute_customer_segments');
    return { rows: Number(data ?? 0), error };
  },
  async mySegment(customerId: string): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase.from('customer_segments').select('*').eq('customer_id', customerId).maybeSingle();
    return { data, error };
  },

  // ── M6 banners ──────────────────────────────────────────────────────────────
  async banners(placement: string): Promise<{ data: any[]; error: any }> {
    const today = new Date().toISOString().slice(0, 10);
    const { data, error } = await supabase.from('banners').select('*').eq('placement', placement).eq('is_active', true)
      .or(`start_date.is.null,start_date.lte.${today}`).order('priority', { ascending: false });
    return { data: data || [], error };
  },
  async trackBanner(id: string, event: 'impression' | 'click'): Promise<void> {
    await supabase.rpc('track_banner', { p_banner: id, p_event: event });
  },

  // ── M7 promotions ───────────────────────────────────────────────────────────
  async activePromotions(merchantId?: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.rpc('active_promotions', { p_merchant: merchantId ?? null });
    return { data: data || [], error };
  },
  async createPromotion(p: any): Promise<{ error: any }> {
    const { error } = await supabase.from('promotions').insert(p);
    return { error };
  },
  async listPromotions(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  // ── M8 merchant growth ──────────────────────────────────────────────────────
  async merchantGrowth(merchantId: string): Promise<any> {
    const { data } = await supabase.rpc('merchant_growth_stats', { p_merchant: merchantId });
    return data ?? {};
  },

  // ── M9 retention ────────────────────────────────────────────────────────────
  async retentionTargets(): Promise<any> {
    const { data } = await supabase.rpc('retention_targets');
    return data ?? {};
  },

  // ── M10 analytics ───────────────────────────────────────────────────────────
  async analytics(): Promise<any> {
    const { data } = await supabase.rpc('growth_analytics');
    return data ?? {};
  },

  // ── M11 notification templates ──────────────────────────────────────────────
  async templates(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('notification_templates').select('*').order('type', { ascending: true });
    return { data: data || [], error };
  },
  /** Resolve a localized template into a {title, body} for the given language. */
  async renderTemplate(key: string, lang: 'ar' | 'en'): Promise<{ title: string; body: string } | null> {
    const { data } = await supabase.from('notification_templates').select('*').eq('key', key).maybeSingle();
    if (!data) return null;
    return { title: lang === 'ar' ? data.title_ar : data.title_en, body: lang === 'ar' ? data.body_ar : data.body_en };
  },

  // ── UI helper reads/CRUD (Supabase only — no schema change) ──────────────────
  async deleteCoupon(id: string): Promise<{ error: any }> {
    const { error } = await supabase.from('coupons').delete().eq('id', id); return { error };
  },
  async updateCoupon(id: string, patch: any): Promise<{ error: any }> {
    const { error } = await supabase.from('coupons').update(patch).eq('id', id); return { error };
  },
  async tiers(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('loyalty_tiers').select('*').order('level', { ascending: true });
    return { data: data || [], error };
  },
  async createReward(r: any): Promise<{ error: any }> {
    const { error } = await supabase.from('loyalty_rewards').insert(r); return { error };
  },
  async toggleReward(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('loyalty_rewards').update({ is_active: isActive }).eq('id', id); return { error };
  },
  async allRewards(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('loyalty_rewards').select('*').order('points_cost', { ascending: true });
    return { data: data || [], error };
  },
  async listBanners(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('banners').select('*').order('priority', { ascending: false });
    return { data: data || [], error };
  },
  async createBanner(b: any): Promise<{ error: any }> {
    const { error } = await supabase.from('banners').insert(b); return { error };
  },
  async toggleBanner(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('banners').update({ is_active: isActive }).eq('id', id); return { error };
  },
  async togglePromotion(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('promotions').update({ is_active: isActive }).eq('id', id); return { error };
  },
  async listCampaigns(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('message_campaigns').select('*').order('created_at', { ascending: false }).limit(50);
    return { data: data || [], error };
  },
  async segmentCounts(): Promise<Record<string, number>> {
    const a = await this.analytics();
    return (a?.segments as Record<string, number>) ?? {};
  },

  // ── customer self-view ──────────────────────────────────────────────────────
  async myPoints(customerId: string): Promise<number> {
    const { data } = await supabase.rpc('loyalty_balance', { p_customer_id: customerId });
    return Number(data ?? 0);
  },
  async myTier(customerId: string): Promise<any> {
    const { data } = await supabase.rpc('resolve_loyalty_tier', { p_customer: customerId });
    return Array.isArray(data) ? data[0] : data;
  },
};
