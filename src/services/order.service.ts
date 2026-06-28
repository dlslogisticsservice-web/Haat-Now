import { supabase } from '../lib/supabase';
import { Order, OrderItem, OrderStatusHistory } from './types';
import { notificationService } from './notification.service';
import { sandboxStore } from './sandboxStore';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox' || !supabase;

export const orderService = {
  // Place enterprise order with custom shopping list items nested in Supabase transactional flow
  async createOrder(
    customerId: string,
    branchId: string,
    totalAmount: number,
    items: Array<{ variantId: string; quantity: number; price: number }>,
    locationSnapshot?: {
      addressId?: string | null;
      deliveryLat?: number | null;
      deliveryLng?: number | null;
      branchLatSnapshot?: number | null;
      branchLngSnapshot?: number | null;
      deliveryFee?: number | null;
    },
  ): Promise<{ data: Order | null; error: any }> {
    // 1. Insert order metadata record
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        branch_id: branchId,
        status: 'pending',
        total_amount: totalAmount,
        ...(locationSnapshot ? {
          address_id:          locationSnapshot.addressId          ?? null,
          delivery_lat:        locationSnapshot.deliveryLat        ?? null,
          delivery_lng:        locationSnapshot.deliveryLng        ?? null,
          branch_lat_snapshot: locationSnapshot.branchLatSnapshot  ?? null,
          branch_lng_snapshot: locationSnapshot.branchLngSnapshot  ?? null,
          // Persist the configured fee so complete_delivery() reads the actual value,
          // not the DB column default of 10.00.
          ...(locationSnapshot.deliveryFee != null
            ? { delivery_fee: locationSnapshot.deliveryFee }
            : {}),
        } : {}),
      })
      .select()
      .single();

    if (orderError || !orderData) {
      return { data: null, error: orderError };
    }

    // 2. Insert order items array
    const orderItemsPayload = items.map(item => ({
      order_id: orderData.id,
      variant_id: item.variantId,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItemsPayload);

    if (itemsError) {
      // Cleanup orphan metadata on failure to ensure data integrity
      await supabase.from('orders').delete().eq('id', orderData.id);
      return { data: null, error: itemsError };
    }

    // 3. Log initial status history record
    await supabase.from('order_status_history').insert({
      order_id: orderData.id,
      status: 'pending',
      notes: 'تم إنشاء الطلب.',
    });

    // 4. Notify merchant about new order
    const { data: branch } = await supabase
      .from('merchant_branches')
      .select('merchant_id')
      .eq('id', branchId)
      .single();
    if (branch?.merchant_id) {
      await notificationService.sendNotification(branch.merchant_id, 'طلب جديد! تحقق من لوحة الطلبات.', 'order');
    }

    return { data: orderData, error: null };
  },

  // Retrieve details of specific order including item variants list
  async getOrderDetails(orderId: string): Promise<{ data: Order | null; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*, product_variants(*, products(*))),
        merchant_branches(*, merchants(*)),
        drivers(*),
        order_status_history(*)
      `)
      .eq('id', orderId)
      .single();
    
    return { data, error };
  },

  // Retrieve customer delivery history list
  async getCustomerOrders(customerId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_branches(name, merchants(business_name))')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Update order status workflow
  async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<{ error: any }> {
    // Fetch current order state for status guard + notification targets
    const { data: orderRow } = await supabase
      .from('orders')
      .select('status, customer_id, driver_id')
      .eq('id', orderId)
      .single();

    // Guard: skip if already at the target status (prevents duplicate history + notifications)
    if (orderRow?.status === status) return { error: null };

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);

    if (updateError) return { error: updateError };

    // Record state change log
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status,
      notes: notes || `تغير حالة الطلب إلى ${status}`,
    });

    // Customer notification per status
    // 'delivered' is intentionally absent: the complete_delivery() RPC handles
    // both the status transition and the customer notification atomically (Phase 15).
    const customerMessages: Record<string, string> = {
      accepted:   'تم قبول طلبك! جاري التحضير.',
      preparing:  'طلبك قيد التحضير الآن.',
      on_the_way: 'طلبك في الطريق إليك!',
      cancelled:  'تم إلغاء طلبك.',
    };
    if (orderRow?.customer_id && customerMessages[status]) {
      await notificationService.sendNotification(orderRow.customer_id, customerMessages[status], 'order');
    }

    // Broadcast available-jobs notification to all drivers when merchant accepts
    if (status === 'accepted') {
      await notificationService.sendNotification(null, 'طلب جديد متاح للاستلام. تحقق من لوحة الوظائف.', 'order');
    }

    return { error: null };
  },

  // Cancel order (only if pending). reason is optional — defaults to generic Arabic note.
  async cancelOrder(orderId: string, reason?: string): Promise<{ success: boolean; error: any }> {
    // Sandbox: mirror the createOrder sandbox path — only a pending order may be cancelled.
    if (SANDBOX) {
      const o = sandboxStore.getById(orderId);
      if (!o || o.status !== 'pending') {
        return { success: false, error: new Error('Order is already in progress and cannot be cancelled.') };
      }
      sandboxStore.setStatus(orderId, 'cancelled');
      return { success: true, error: null };
    }
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (!order || order.status !== 'pending') {
      return { success: false, error: new Error('Order is already in progress and cannot be cancelled.') };
    }

    const notes = reason ? `تم إلغاء الطلب: ${reason}` : 'تم إلغاء الطلب.';
    const { error } = await this.updateOrderStatus(orderId, 'cancelled', notes);
    return { success: !error, error };
  }
};
