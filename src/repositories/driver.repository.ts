import { supabase } from '../lib/supabase';

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
};
