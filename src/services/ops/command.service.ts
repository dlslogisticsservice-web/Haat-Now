import { supabase } from '../../lib/supabase';

export interface LiveDriver { id: string; full_name: string | null; lat: number; lng: number; status: string; is_online: boolean; }
export interface LiveOrder { id: string; status: string; lat: number; lng: number; driver_id: string | null; total_amount: number; }
export interface LiveMerchant { id: string; name: string; lat: number; lng: number; }
export interface OpsSummary {
  active_orders: number; unassigned_orders: number; in_transit: number;
  online_drivers: number; available_drivers: number; busy_drivers: number;
  pending_offers: number; delivered_today: number; revenue_today: number;
}
export interface ZoneAnalytics {
  zone_id: string; zone_name: string; is_active: boolean;
  active_orders: number; online_drivers: number; available_drivers: number; delivered_today: number; avg_eta: number;
}

const ACTIVE_ORDER = ['pending', 'accepted', 'preparing', 'on_the_way'];
// Demo runs entirely client-side — never touch the network in sandbox (avoids 403/401 + realtime errors).
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
const ls = <T,>(table: string): T[] => { try { return JSON.parse(localStorage.getItem(`haat_crud_${table}`) || '[]'); } catch { return []; } };

/** Operations Command Center — live map data, realtime, ops/zone analytics, batch dispatch. */
export const commandService = {
  async summary(): Promise<OpsSummary> {
    if (SANDBOX) {
      const orders = ls<any>('orders'), drivers = ls<any>('drivers');
      const active = orders.filter(o => ACTIVE_ORDER.includes(o.status));
      const delivered = orders.filter(o => o.status === 'delivered');
      return {
        active_orders: active.length, unassigned_orders: active.filter(o => !o.driver_id).length,
        in_transit: orders.filter(o => o.status === 'on_the_way').length,
        online_drivers: drivers.filter(d => d.is_online).length, available_drivers: drivers.filter(d => d.status === 'available').length,
        busy_drivers: drivers.filter(d => d.status === 'busy').length, pending_offers: 0,
        delivered_today: delivered.length, revenue_today: delivered.reduce((s, o) => s + (Number(o.total_amount) || 0), 0),
      };
    }
    const { data } = await supabase.rpc('ops_summary');
    return (data as OpsSummary) ?? {} as OpsSummary;
  },

  async zoneAnalytics(): Promise<{ data: ZoneAnalytics[]; error: any }> {
    if (SANDBOX) {
      const zones = ls<any>('zones'), orders = ls<any>('orders'), drivers = ls<any>('drivers');
      return {
        data: zones.slice(0, 12).map(z => ({
          zone_id: z.id, zone_name: z.name, is_active: z.is_active !== false,
          active_orders: orders.filter(o => ACTIVE_ORDER.includes(o.status)).length % 7,
          online_drivers: drivers.filter(d => d.is_online).length % 9,
          available_drivers: drivers.filter(d => d.status === 'available').length % 6,
          delivered_today: orders.filter(o => o.status === 'delivered').length % 11,
          avg_eta: 25 + ((z.name?.length || 5) % 15),
        })), error: null,
      };
    }
    const { data, error } = await supabase.rpc('ops_zone_analytics');
    return { data: (data as ZoneAnalytics[]) || [], error };
  },

  async batchDispatch(limit = 20): Promise<{ count: number; error: any }> {
    if (SANDBOX) {
      const unassigned = ls<any>('orders').filter(o => ACTIVE_ORDER.includes(o.status) && !o.driver_id);
      return { count: Math.min(limit, unassigned.length), error: null };
    }
    const { data, error } = await supabase.rpc('batch_auto_dispatch', { p_limit: limit, p_timeout_seconds: 30 });
    return { count: Number(data ?? 0), error };
  },

  async liveDrivers(): Promise<LiveDriver[]> {
    if (SANDBOX) {
      return ls<any>('drivers').filter(d => d.is_online && d.current_lat != null)
        .map(d => ({ id: d.id, full_name: d.full_name, lat: Number(d.current_lat), lng: Number(d.current_lng), status: d.status || 'available', is_online: !!d.is_online }));
    }
    const { data } = await supabase.from('drivers')
      .select('id, full_name, current_lat, current_lng, status, is_online')
      .not('current_lat', 'is', null).eq('is_online', true);
    return (data || []).map((d: any) => ({ id: d.id, full_name: d.full_name, lat: Number(d.current_lat), lng: Number(d.current_lng), status: d.status, is_online: d.is_online }));
  },

  async liveOrders(): Promise<LiveOrder[]> {
    if (SANDBOX) {
      return ls<any>('orders').filter(o => ACTIVE_ORDER.includes(o.status) && (o.delivery_lat != null || o.branch_lat_snapshot != null))
        .map(o => ({ id: o.id, status: o.status, lat: Number(o.delivery_lat ?? o.branch_lat_snapshot), lng: Number(o.delivery_lng ?? o.branch_lng_snapshot), driver_id: o.driver_id || null, total_amount: Number(o.total_amount) || 0 }))
        .filter(o => !Number.isNaN(o.lat) && !Number.isNaN(o.lng));
    }
    const { data } = await supabase.from('orders')
      .select('id, status, delivery_lat, delivery_lng, branch_lat_snapshot, branch_lng_snapshot, driver_id, total_amount')
      .in('status', ACTIVE_ORDER);
    return (data || []).map((o: any) => ({
      id: o.id, status: o.status,
      lat: Number(o.delivery_lat ?? o.branch_lat_snapshot), lng: Number(o.delivery_lng ?? o.branch_lng_snapshot),
      driver_id: o.driver_id, total_amount: Number(o.total_amount),
    })).filter(o => !Number.isNaN(o.lat) && !Number.isNaN(o.lng));
  },

  async liveMerchants(): Promise<LiveMerchant[]> {
    if (SANDBOX) {
      return ls<any>('merchant_branches').filter(m => m.is_active !== false && (m.latitude != null || m.lat != null))
        .map(m => ({ id: m.id, name: m.name, lat: Number(m.latitude ?? m.lat), lng: Number(m.longitude ?? m.lng) }))
        .filter(m => !Number.isNaN(m.lat) && !Number.isNaN(m.lng));
    }
    const { data } = await supabase.from('merchant_branches')
      .select('id, name, latitude, longitude').eq('is_active', true).not('latitude', 'is', null);
    return (data || []).map((m: any) => ({ id: m.id, name: m.name, lat: Number(m.latitude), lng: Number(m.longitude) }));
  },

  /** Subscribe to live driver-location + order changes. Returns an unsubscribe fn. No-op in sandbox. */
  subscribeLive(onChange: () => void): () => void {
    if (SANDBOX) return () => {};
    const ch = supabase
      .channel('ops-command-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },
};
