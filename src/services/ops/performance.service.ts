import { supabase } from '../../lib/supabase';

// Demo is client-side — never hit Supabase in sandbox. Matches the guard every other
// ops service already carries (dispatch/payout/shift); its absence here meant the
// Zones, Vehicles and Performance tabs fired real network calls in the demo build
// and failed with 401/403 instead of degrading cleanly.
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';


export interface DriverPerformanceRow {
  driver_id: string;
  orders_offered: number;
  orders_accepted: number;
  orders_completed: number;
  orders_cancelled: number;
  orders_timeout: number;
  total_delivery_minutes: number;
  rating_sum: number;
  rating_count: number;
  total_earnings: number;
  updated_at: string;
}

export interface DriverPerformance extends DriverPerformanceRow {
  acceptance_rate: number;    // accepted / offered
  completion_rate: number;    // completed / accepted
  cancellation_rate: number;  // cancelled / (completed + cancelled)
  avg_delivery_minutes: number;
  rating: number;
}

function derive(row: DriverPerformanceRow, rating: number): DriverPerformance {
  const completedPlusCancelled = row.orders_completed + row.orders_cancelled;
  return {
    ...row,
    acceptance_rate: row.orders_offered ? row.orders_accepted / row.orders_offered : 0,
    completion_rate: row.orders_accepted ? row.orders_completed / row.orders_accepted : 0,
    cancellation_rate: completedPlusCancelled ? row.orders_cancelled / completedPlusCancelled : 0,
    avg_delivery_minutes: row.orders_completed ? row.total_delivery_minutes / row.orders_completed : 0,
    rating,
  };
}

/** Driver performance engine: acceptance/completion/cancellation rates, avg time, rating, earnings. */
export const performanceService = {
  async get(driverId: string): Promise<{ data: DriverPerformance | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const [{ data: perf, error }, { data: drv }] = await Promise.all([
      supabase.from('driver_performance').select('*').eq('driver_id', driverId).maybeSingle(),
      supabase.from('drivers').select('rating').eq('id', driverId).maybeSingle(),
    ]);
    if (!perf) return { data: null, error };
    return { data: derive(perf as DriverPerformanceRow, Number(drv?.rating ?? 5)), error };
  },

  /** Recompute a driver's counters + priority from source rows. */
  async recalc(driverId: string): Promise<{ error: any }> {
    if (SANDBOX) return { error: null };
    const { error } = await supabase.rpc('recalc_driver_performance', { p_driver_id: driverId });
    return { error };
  },

  /** Leaderboard by completed deliveries (with derived rates). */
  async leaderboard(limit = 20): Promise<{ data: (DriverPerformance & { full_name: string })[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('driver_performance')
      .select('*, drivers(full_name, rating)')
      .order('orders_completed', { ascending: false })
      .limit(limit);
    const rows = (data || []).map((r: any) =>
      ({ ...derive(r as DriverPerformanceRow, Number(r.drivers?.rating ?? 5)), full_name: r.drivers?.full_name ?? '—' }));
    return { data: rows, error };
  },
};
