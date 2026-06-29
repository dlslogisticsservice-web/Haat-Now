import { supabase } from '../../lib/supabase';

export interface DispatchAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: 'offered' | 'accepted' | 'rejected' | 'timeout' | 'reassigned' | 'lost' | 'cancelled';
  method: 'auto' | 'manual';
  attempt: number;
  distance_km: number | null;
  assigned_at: string;
  responded_at: string | null;
  timeout_at: string | null;
}

export interface NearestDriver {
  driver_id: string;
  distance_km: number;
  priority_score: number;
  active_orders: number;
  score: number;
}

// Demo is client-side — never hit Supabase in sandbox (avoids dispatch_assignments 403s).
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

/**
 * Dispatch Center service — auto/manual assignment, driver offers, timeout sweep,
 * reassignment. All mutations go through SECURITY DEFINER RPCs (race-safe).
 */
export const dispatchService = {
  /** Orders awaiting a driver (the dispatch queue). */
  async unassignedOrders(): Promise<{ data: any[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('orders')
      .select('id, status, total_amount, delivery_fee, delivery_lat, delivery_lng, branch_lat_snapshot, branch_lng_snapshot, created_at, merchant_branches(name, zone_id, zones(name))')
      .is('driver_id', null)
      .in('status', ['accepted', 'preparing'])
      .order('created_at', { ascending: true });
    return { data: data || [], error };
  },

  /** Best available drivers for a point, scored (distance + workload − priority). */
  async findNearestDrivers(lat: number, lng: number, limit = 5, excludeOrder?: string): Promise<{ data: NearestDriver[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase.rpc('find_nearest_drivers', {
      p_lat: lat, p_lng: lng, p_limit: limit, p_exclude_order: excludeOrder ?? null,
    });
    return { data: (data as NearestDriver[]) || [], error };
  },

  /** Auto-dispatch: offer to the single best driver. Returns null if none available. */
  async autoDispatch(orderId: string, timeoutSeconds = 30): Promise<{ data: DispatchAssignment | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.rpc('auto_dispatch_order', {
      p_order_id: orderId, p_timeout_seconds: timeoutSeconds,
    });
    return { data: (data as DispatchAssignment) ?? null, error };
  },

  /** Manual dispatch: admin assigns a specific driver directly. */
  async manualDispatch(orderId: string, driverId: string): Promise<{ data: DispatchAssignment | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.rpc('manual_dispatch_order', {
      p_order_id: orderId, p_driver_id: driverId,
    });
    return { data: (data as DispatchAssignment) ?? null, error };
  },

  /** Driver responds to an offer. Returns final status: accepted/rejected/lost. */
  async respond(assignmentId: string, accept: boolean): Promise<{ data: string | null; error: any }> {
    if (SANDBOX) return { data: accept ? 'accepted' : 'rejected', error: null };
    const { data, error } = await supabase.rpc('respond_dispatch', {
      p_assignment_id: assignmentId, p_accept: accept,
    });
    return { data: (data as string) ?? null, error };
  },

  /** Re-dispatch an order to the next best driver. */
  async reassign(orderId: string, timeoutSeconds = 30): Promise<{ data: DispatchAssignment | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.rpc('reassign_order', {
      p_order_id: orderId, p_timeout_seconds: timeoutSeconds,
    });
    return { data: (data as DispatchAssignment) ?? null, error };
  },

  /** Expire stale offers past their timeout (returns count expired). */
  async expireOffers(): Promise<{ data: number; error: any }> {
    if (SANDBOX) return { data: 0, error: null };
    const { data, error } = await supabase.rpc('expire_dispatch_offers');
    return { data: (data as number) ?? 0, error };
  },

  /** Free workload + refresh performance after delivery completion. */
  async finalizeDelivery(orderId: string, driverId: string): Promise<{ error: any }> {
    if (SANDBOX) return { error: null };
    const { error } = await supabase.rpc('finalize_driver_delivery', {
      p_order_id: orderId, p_driver_id: driverId,
    });
    return { error };
  },

  /** Pending offers for a driver (the driver's incoming-jobs queue). */
  async driverOffers(driverId: string): Promise<{ data: any[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('dispatch_assignments')
      .select('*, orders(id, total_amount, delivery_fee, status, merchant_branches(name, zones(name)))')
      .eq('driver_id', driverId)
      .eq('status', 'offered')
      .order('assigned_at', { ascending: false });
    return { data: data || [], error };
  },

  /** Recent dispatch activity for the dispatch board. */
  async recentAssignments(limit = 50): Promise<{ data: any[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('dispatch_assignments')
      .select('*, drivers(full_name, phone_number), orders(total_amount, status)')
      .order('assigned_at', { ascending: false })
      .limit(limit);
    return { data: data || [], error };
  },
};
