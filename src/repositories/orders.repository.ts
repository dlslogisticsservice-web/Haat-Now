import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// orders.repository (Phase-2 architecture stabilization).
// The only layer allowed to touch Supabase for order realtime streams. Thin data
// access — no business logic. Channels are returned opaque; callers unsubscribe here.
// ─────────────────────────────────────────────────────────────────────────────

export const ordersRepository = {
  /** Realtime: fire onChange whenever one of this customer's orders is updated. */
  subscribeCustomerOrders(customerId: string, onChange: () => void): any {
    return supabase
      .channel('orders-realtime-customer')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `customer_id=eq.${customerId}` }, () => onChange())
      .subscribe();
  },

  /** Realtime: driver GPS stream (INSERT + UPDATE on driver_locations) for live tracking. */
  subscribeDriverLocation(driverId: string, onLoc: (payload: any) => void): any {
    return supabase
      .channel(`driver-loc-${driverId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` }, onLoc)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'driver_locations', filter: `driver_id=eq.${driverId}` }, onLoc)
      .subscribe();
  },

  /** Remove a previously-created realtime channel (null-safe). */
  unsubscribe(channel: any): void {
    if (channel) supabase.removeChannel(channel);
  },
};
