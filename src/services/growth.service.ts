import { supabase } from '../lib/supabase';

export interface ReferralCode { id: string; code: string; reward_referrer: number; reward_referee: number; used_count: number; }
export interface LoyaltyTier { id: string; name: string; level: number; min_points: number; points_multiplier: number; perks: any; }
export interface Affiliate { id: string; name: string; commission_rate: number; total_referred: number; total_earned: number; status: string; }
export interface Influencer extends Affiliate { handle: string | null; platform: string | null; reach: number; }
export interface AudienceSegment { id: string; name: string; definition: any; estimated_size: number; created_at: string; }
export interface MessageCampaign { id: string; name: string; channel: 'push' | 'sms' | 'email'; status: string; recipient_count: number; sent_at: string | null; body: string | null; }

/** Growth engine: referrals, cashback, loyalty tiers, affiliates/influencers, marketing. */
export const growthService = {
  // ── customer ────────────────────────────────────────────────────────────────
  async myReferralCode(customerId: string): Promise<{ data: ReferralCode | null; error: any }> {
    const { data, error } = await supabase.rpc('generate_referral_code', { p_owner_type: 'customer', p_owner_id: customerId, p_reward_referrer: 15, p_reward_referee: 10 });
    return { data: (data as ReferralCode) ?? null, error };
  },
  async applyReferralCode(code: string, customerId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('apply_referral_code', { p_code: code, p_referee: customerId });
    return { error };
  },
  async myReferrals(customerId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('referrals').select('*').eq('referrer_id', customerId).order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async cashbackBalance(customerId: string): Promise<number> {
    const { data } = await supabase.rpc('cashback_balance', { p_customer: customerId });
    return Number(data ?? 0);
  },
  async tiers(): Promise<{ data: LoyaltyTier[]; error: any }> {
    const { data, error } = await supabase.from('loyalty_tiers').select('*').order('level', { ascending: true });
    return { data: (data as LoyaltyTier[]) || [], error };
  },

  // ── cashback campaigns (admin) ──────────────────────────────────────────────
  async cashbackCampaigns(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('cashback_campaigns').select('*').order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async createCashbackCampaign(c: any): Promise<{ error: any }> {
    const { error } = await supabase.from('cashback_campaigns').insert(c);
    return { error };
  },
  async toggleCashbackCampaign(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('cashback_campaigns').update({ is_active: isActive }).eq('id', id);
    return { error };
  },

  // ── affiliates / influencers (admin) ────────────────────────────────────────
  async affiliates(): Promise<{ data: Affiliate[]; error: any }> {
    const { data, error } = await supabase.from('affiliates').select('*, referral_codes(code)').order('total_earned', { ascending: false });
    return { data: (data as any) || [], error };
  },
  async createAffiliate(name: string, commission: number, reward: number): Promise<{ error: any }> {
    const { error } = await supabase.rpc('create_affiliate', { p_name: name, p_user: null, p_commission: commission, p_reward: reward });
    return { error };
  },
  async influencers(): Promise<{ data: Influencer[]; error: any }> {
    const { data, error } = await supabase.from('influencers').select('*, referral_codes(code)').order('total_earned', { ascending: false });
    return { data: (data as any) || [], error };
  },
  async createInfluencer(name: string, handle: string, platform: string, reach: number, commission: number, reward: number): Promise<{ error: any }> {
    const { error } = await supabase.rpc('create_influencer', { p_name: name, p_handle: handle, p_platform: platform, p_reach: reach, p_commission: commission, p_reward: reward });
    return { error };
  },

  // ── audience segmentation + marketing (admin) ───────────────────────────────
  async estimateSegment(definition: any): Promise<number> {
    const { data } = await supabase.rpc('estimate_segment', { p_definition: definition });
    return Number(data ?? 0);
  },
  async createSegment(name: string, definition: any): Promise<{ error: any }> {
    const { error } = await supabase.rpc('create_audience_segment', { p_name: name, p_definition: definition });
    return { error };
  },
  async segments(): Promise<{ data: AudienceSegment[]; error: any }> {
    const { data, error } = await supabase.from('audience_segments').select('*').order('created_at', { ascending: false });
    return { data: (data as AudienceSegment[]) || [], error };
  },
  async campaigns(): Promise<{ data: MessageCampaign[]; error: any }> {
    const { data, error } = await supabase.from('message_campaigns').select('*, audience_segments(name)').order('created_at', { ascending: false });
    return { data: (data as any) || [], error };
  },
  async createCampaign(c: { name: string; channel: string; segment_id?: string | null; body: string }): Promise<{ error: any }> {
    const { error } = await supabase.from('message_campaigns').insert(c);
    return { error };
  },
  async sendCampaign(id: string): Promise<{ recipients: number; error: any }> {
    const { data, error } = await supabase.rpc('send_message_campaign', { p_id: id });
    return { recipients: Number(data ?? 0), error };
  },
};
