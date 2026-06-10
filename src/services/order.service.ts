import { supabase } from '../lib/supabase';
import { Order, OrderItem, OrderStatusHistory } from './types';

export const orderService = {
  // Place enterprise order with custom shopping list items nested in Supabase transactional flow
  async createOrder(
    customerId: string,
    branchId: string,
    totalAmount: number,
    items: Array<{ variantId: string; quantity: number; price: number }>
  ): Promise<{ data: Order | null; error: any }> {
    // 1. Insert order metadata record
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId,
        branch_id: branchId,
        status: 'pending',
        total_amount: totalAmount,
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
      notes: 'تم استلام وتأكيد الطلب بنجاح.',
    });

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

    return { error: null };
  },

  // Cancel order (only if pending)
  async cancelOrder(orderId: string, reason: string): Promise<{ success: boolean; error: any }> {
    const { data: order } = await supabase
      .from('orders')
      .select('status')
      .eq('id', orderId)
      .single();

    if (!order || order.status !== 'pending') {
      return { success: false, error: new Error('Order is already in progress and cannot be cancelled.') };
    }

    const { error } = await this.updateOrderStatus(orderId, 'cancelled', `تم إلغاء الطلب: ${reason}`);
    return { success: !error, error };
  }
};
