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

  // ── Order data access (order.service) ──────────────────────────────────────
  insertOrder(row: Record<string, any>) {
    return supabase.from('orders').insert(row).select().single();
  },

  insertOrderItems(rows: Array<Record<string, any>>) {
    return supabase.from('order_items').insert(rows);
  },

  deleteOrder(id: string) {
    return supabase.from('orders').delete().eq('id', id);
  },

  insertStatusHistory(row: { order_id: string; status: string; notes: string }) {
    return supabase.from('order_status_history').insert(row);
  },

  getBranchMerchant(branchId: string) {
    return supabase.from('merchant_branches').select('merchant_id').eq('id', branchId).single();
  },

  getOrderDetails(orderId: string) {
    return supabase.from('orders').select(`
        *,
        order_items(*, product_variants(*, products(*))),
        merchant_branches(*, merchants(*)),
        drivers(*),
        order_status_history(*)
      `).eq('id', orderId).single();
  },

  getCustomerOrders(customerId: string) {
    return supabase.from('orders').select('*, merchant_branches(name, merchants(business_name))').eq('customer_id', customerId).order('created_at', { ascending: false });
  },

  getOrderStateForUpdate(orderId: string) {
    return supabase.from('orders').select('status, customer_id, driver_id').eq('id', orderId).single();
  },

  updateStatus(orderId: string, status: string) {
    return supabase.from('orders').update({ status }).eq('id', orderId);
  },

  getStatus(orderId: string) {
    return supabase.from('orders').select('status').eq('id', orderId).single();
  },
};
