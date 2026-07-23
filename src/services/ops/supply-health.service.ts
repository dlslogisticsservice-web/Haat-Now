// ─────────────────────────────────────────────────────────────────────────────
// Supply health — merchant operational health + document expiry.
//
// Two gaps the operations audit found, both on the supply side:
//
//  1. MERCHANT HEALTH. `driver_performance` has existed since 20260614000028, but
//     merchants had no counterpart. Nothing measured a merchant's ACTUAL behaviour
//     (acceptance, prep time, cancellations) against what they DECLARE in
//     merchant_branches.settings. A merchant who promises 15-minute prep and
//     consistently takes 40 was invisible to operations.
//
//  2. DOCUMENT EXPIRY. Licence and insurance expiry dates existed on drivers and
//     vehicles as display-only text. Nothing could answer "what lapses this month",
//     so nothing ever did — and an expired licence is a legal problem, not a UI one.
//
// Both read from the tables/RPCs added in 20260720000001_operations_readiness.sql.
// KYC compliance is NOT duplicated here — that lives in onboarding.service and is
// complete; this is the operational layer that sits alongside it.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../../lib/supabase';
// Banding rules live in the pure module so they are testable and shared.
import { healthBand, summariseHealth, type HealthBand } from './golive-rules';

export { healthBand };
export type { HealthBand };

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

export interface MerchantHealth {
  merchant_id: string;
  branch_id: string | null;
  orders_total: number;
  orders_accepted: number;
  orders_rejected: number;
  orders_cancelled: number;
  orders_delivered: number;
  avg_accept_seconds: number | null;
  avg_prep_minutes: number | null;
  declared_prep_minutes: number | null;
  acceptance_rate: number | null;
  cancellation_rate: number | null;
  health_score: number | null;
  last_order_at: string | null;
  computed_at: string;
  /** Joined for display. */
  business_name?: string;
}


export const BAND_LABEL: Record<HealthBand, { ar: string; en: string; color: string }> = {
  healthy: { ar: 'سليم', en: 'Healthy', color: '#4ade80' },
  watch:   { ar: 'مراقبة', en: 'Watch', color: '#eab308' },
  at_risk: { ar: 'في خطر', en: 'At risk', color: '#f87171' },
  no_data: { ar: 'لا بيانات', en: 'No data', color: '#64748b' },
};

export interface ExpiringDocument {
  entity_type: 'driver' | 'merchant';
  entity_id: string;
  entity_name: string | null;
  document_id: string;
  doc_type: string;
  expires_at: string;
  days_remaining: number;
  status: 'expired' | 'expiring';
}

export const supplyHealthService = {
  /** Merchant scorecards, worst first — the order an operator wants to work through. */
  async merchantHealth(): Promise<{ data: MerchantHealth[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    // A missing client in a live build is a configuration FAILURE, not an empty
    // result — surfacing it as "no merchants" would hide a broken deploy.
    if (!supabase) return { data: [], error: { message: 'backend_not_configured' } };
    const { data, error } = await supabase
      .from('merchant_performance')
      .select('*, merchants(business_name)')
      .order('health_score', { ascending: true, nullsFirst: false });
    const rows = ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
      ...(r as unknown as MerchantHealth),
      business_name: (r.merchants as { business_name?: string } | null)?.business_name,
    }));
    return { data: rows, error };
  },

  /** Recompute every merchant's scorecard from real orders. Ops-admin gated server-side. */
  async recalcAll(): Promise<{ count: number; error: any }> {
    if (SANDBOX) return { count: 0, error: null };
    if (!supabase) return { count: 0, error: { message: 'backend_not_configured' } };
    const { data, error } = await supabase.rpc('recalc_all_merchant_performance');
    return { count: Number(data ?? 0), error };
  },

  /** Documents already expired or lapsing within `withinDays`. Most urgent first. */
  async expiringDocuments(withinDays = 30): Promise<{ data: ExpiringDocument[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    if (!supabase) return { data: [], error: { message: 'backend_not_configured' } };
    const { data, error } = await supabase.rpc('expiring_documents', { p_within_days: withinDays });
    return { data: (data as ExpiringDocument[]) ?? [], error };
  },

  /**
   * Counts for the command centre. Kept here rather than in the UI so the
   * definition of "at risk" exists in exactly one place.
   */
  summarise(rows: MerchantHealth[]): { healthy: number; watch: number; atRisk: number; noData: number } {
    return summariseHealth(rows.map(r => r.health_score));
  },
};
