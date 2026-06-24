import { supabase } from '../lib/supabase';

export interface CommissionRow { id: string; order_id: string; merchant_id: string; gross_amount: number; commission_amount: number; net_to_merchant: number; settled: boolean; created_at: string; }
export interface SettlementRun { id: string; run_type: 'merchant' | 'driver'; period_start: string; period_end: string; status: string; entity_count: number; total_amount: number; created_at: string; }
export interface MerchantSettlement { id: string; settlement_id: string; merchant_id: string; gross_sales: number; total_commission: number; net_payable: number; status: 'pending' | 'paid'; paid_at: string | null; merchants?: any; }
export interface DriverSettlement { id: string; driver_id: string; total_earnings: number; total_incentives: number; total_bonuses: number; total_penalties: number; net_payable: number; status: 'pending' | 'paid'; paid_at: string | null; drivers?: any; }
export interface Compensation { id: string; entity_type: string; entity_id: string; amount: number; reason: string | null; status: string; created_at: string; }
export interface RevenueDashboard { platform_revenue: number; platform_cash: number; merchant_payable: number; driver_payable: number; commission_total: number; order_count: number; }

/** Enterprise finance: double-entry ledger reads, commission, settlement engine, adjustments, compensation, exports. */
export const financeService = {
  // ── dashboards ─────────────────────────────────────────────────────────────
  async balance(accountType: string, ownerId?: string): Promise<number> {
    const { data } = await supabase.rpc('fin_balance', { p_account_type: accountType, p_owner_id: ownerId ?? null });
    return Number(data ?? 0);
  },

  async revenueDashboard(): Promise<{ data: RevenueDashboard; error: any }> {
    const [rev, cash, mp, dp, comm] = await Promise.all([
      this.balance('platform_revenue'), this.balance('platform_cash'),
      this.balance('merchant_payable'), this.balance('driver_payable'),
      supabase.from('commissions').select('commission_amount'),
    ]);
    const rows = comm.data || [];
    return {
      data: {
        platform_revenue: rev, platform_cash: cash, merchant_payable: mp, driver_payable: dp,
        commission_total: rows.reduce((s: number, r: any) => s + Number(r.commission_amount), 0),
        order_count: rows.length,
      }, error: comm.error,
    };
  },

  // ── commission ──────────────────────────────────────────────────────────────
  async captureCommission(orderId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('capture_order_commission', { p_order_id: orderId });
    return { error };
  },
  async listCommissionRules(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('commission_rules').select('*').order('priority', { ascending: false });
    return { data: data || [], error };
  },
  async upsertCommissionRule(rule: any): Promise<{ error: any }> {
    const { error } = rule.id
      ? await supabase.from('commission_rules').update(rule).eq('id', rule.id)
      : await supabase.from('commission_rules').insert(rule);
    return { error };
  },

  // ── settlement engine ─────────────────────────────────────────────────────
  async settlementRuns(): Promise<{ data: SettlementRun[]; error: any }> {
    const { data, error } = await supabase.from('settlements').select('*').order('created_at', { ascending: false }).limit(50);
    return { data: (data as SettlementRun[]) || [], error };
  },
  async generateMerchantSettlement(start: string, end: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('generate_merchant_settlement', { p_start: start, p_end: end });
    return { error };
  },
  async generateDriverSettlement(start: string, end: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('generate_driver_settlement', { p_start: start, p_end: end });
    return { error };
  },
  async payMerchantSettlement(id: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('pay_merchant_settlement', { p_ms_id: id });
    return { error };
  },
  async payDriverSettlement(id: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('pay_driver_settlement', { p_ds_id: id });
    return { error };
  },
  async merchantSettlements(status?: 'pending' | 'paid'): Promise<{ data: MerchantSettlement[]; error: any }> {
    let q = supabase.from('merchant_settlements').select('*, merchants(business_name)').order('id', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    return { data: (data as any) || [], error };
  },
  async driverSettlements(status?: 'pending' | 'paid'): Promise<{ data: DriverSettlement[]; error: any }> {
    let q = supabase.from('driver_settlements').select('*, drivers(full_name)').order('id', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    return { data: (data as any) || [], error };
  },

  // ── driver adjustments ──────────────────────────────────────────────────────
  async addDriverAdjustment(driverId: string, type: 'incentive' | 'bonus' | 'penalty', amount: number, reason: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('add_driver_adjustment', { p_driver: driverId, p_type: type, p_amount: amount, p_reason: reason, p_order: null });
    return { error };
  },

  // ── compensation ────────────────────────────────────────────────────────────
  async issueCompensation(entityType: 'merchant' | 'driver' | 'customer', entityId: string, amount: number, reason: string, orderId?: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('issue_compensation', { p_entity_type: entityType, p_entity_id: entityId, p_amount: amount, p_reason: reason, p_order: orderId ?? null });
    return { error };
  },
  async listCompensations(): Promise<{ data: Compensation[]; error: any }> {
    const { data, error } = await supabase.from('compensations').select('*').order('created_at', { ascending: false }).limit(50);
    return { data: (data as Compensation[]) || [], error };
  },

  // ── refunds (existing table) ──────────────────────────────────────────────
  async listRefunds(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('refunds').select('*').order('created_at', { ascending: false }).limit(50);
    return { data: data || [], error };
  },

  // ── accounting exports ──────────────────────────────────────────────────────
  async generateExport(type: 'revenue' | 'commission' | 'settlement' | 'ledger', start: string, end: string): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase.rpc('generate_accounting_export', { p_type: type, p_start: start, p_end: end });
    return { data, error };
  },
  async listExports(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('accounting_exports').select('*').order('generated_at', { ascending: false }).limit(50);
    return { data: data || [], error };
  },

  // ── merchant / driver self-views ──────────────────────────────────────────
  async myMerchantStatements(merchantId: string): Promise<{ data: MerchantSettlement[]; error: any }> {
    const { data, error } = await supabase.from('merchant_settlements').select('*').eq('merchant_id', merchantId).order('id', { ascending: false });
    return { data: (data as any) || [], error };
  },
  async myDriverStatements(driverId: string): Promise<{ data: DriverSettlement[]; error: any }> {
    const { data, error } = await supabase.from('driver_settlements').select('*').eq('driver_id', driverId).order('id', { ascending: false });
    return { data: (data as any) || [], error };
  },
};
