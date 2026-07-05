import { supabase } from '../lib/supabase';
import { ORDER_STATUSES, DRIVER_ACTIVE_STATUSES } from '../services/types';

// ─────────────────────────────────────────────────────────────────────────────
// driver.repository (Phase-2 architecture stabilization).
// Supabase data access for the driver app + ops driver lookups: the driver record,
// the available-orders feed, the order-feed realtime stream, and driver-name lookups.
// No business logic. (Active jobs / shifts / earnings use their ops services.)
// ─────────────────────────────────────────────────────────────────────────────

export const driverRepository = {
  /** Realtime: re-fetch driver state on any order update. */
  subscribeOrderFeed(driverId: string, onChange: () => void): any {
    return supabase
      .channel(`driver-orders-feed-${driverId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => onChange())
      .subscribe();
  },

  unsubscribe(channel: any): void {
    if (channel) supabase.removeChannel(channel);
  },

  getDriver(driverId: string) {
    return supabase.from('drivers').select('*').eq('id', driverId).maybeSingle();
  },

  /** Unassigned, accepted orders available for a driver to pick up. */
  listAvailableFeed() {
    return supabase.from('orders').select('*, merchant_branches(*, zones(*))').eq('status', 'accepted').is('driver_id', null);
  },

  /** Resolve driver display names for a set of ids (ops dispatch board). */
  getDriverNames(ids: string[]) {
    return supabase.from('drivers').select('id, full_name').in('id', ids);
  },

  setOnline(driverId: string, isOnline: boolean) {
    return supabase.from('drivers').update({ is_online: isOnline }).eq('id', driverId);
  },

  getZoneDeliveries(zoneId: string) {
    return supabase.from('orders').select('*, merchant_branches(*, zones(*))').eq('status', 'accepted').filter('merchant_branches.zone_id', 'eq', zoneId);
  },

  /** Atomic claim: only succeeds while the order is unassigned + accepted (TOCTOU-safe). */
  acceptDeliveryAtomic(orderId: string, driverId: string) {
    return supabase.from('orders')
      .update({ driver_id: driverId, status: ORDER_STATUSES.PREPARING })
      .eq('id', orderId).is('driver_id', null).eq('status', ORDER_STATUSES.ACCEPTED)
      .select('id');
  },

  insertStatusHistory(row: { order_id: string; status: string; notes: string }) {
    return supabase.from('order_status_history').insert(row);
  },

  getActiveJobs(driverId: string) {
    return supabase.from('orders').select('*, merchant_branches(*), customers(*)').eq('driver_id', driverId).in('status', [...DRIVER_ACTIVE_STATUSES]);
  },

  getEarnings(driverId: string) {
    return supabase.from('driver_earnings').select('*').eq('driver_id', driverId);
  },
};
