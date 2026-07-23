import { ordersRepository } from '../repositories/orders.repository';
import { Order } from './types';
import { notificationService } from './notification.service';
import { sandboxStore } from './sandboxStore';

const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';

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
    idempotencyKey?: string,
    // Server applies these itself (bounded fee / validated coupon) so total_amount stays
    // server-authoritative — the client never dictates the money it pays.
    pricing?: { serviceFee?: number | null; couponCode?: string | null },
  ): Promise<{ data: Order | null; error: any }> {
    // ── Phase 9 · P0-3: atomic, idempotent, server-priced path (live mode) ──────
    // One transaction (order + items + status history), totals computed server-side,
    // and a repeat idempotencyKey returns the original order instead of a duplicate.
    // Falls back to the legacy multi-insert path only if the RPC is unavailable
    // (migration not yet applied) — preserving backward compatibility.
    if (!SANDBOX) {
      const rpc = await ordersRepository.createOrderRpc({
        customerId,
        branchId,
        items: items.map(i => ({ variant_id: i.variantId, quantity: i.quantity })),
        deliveryFee: locationSnapshot?.deliveryFee ?? null,
        location: locationSnapshot ? {
          address_id:          locationSnapshot.addressId          ?? null,
          delivery_lat:        locationSnapshot.deliveryLat        ?? null,
          delivery_lng:        locationSnapshot.deliveryLng        ?? null,
          branch_lat_snapshot: locationSnapshot.branchLatSnapshot  ?? null,
          branch_lng_snapshot: locationSnapshot.branchLngSnapshot  ?? null,
        } : null,
        idempotencyKey: idempotencyKey ?? null,
        serviceFee: pricing?.serviceFee ?? null,
        couponCode: pricing?.couponCode ?? null,
      });

      // If the RPC is missing (PostgREST PGRST202 / 404), fall through to the legacy path.
      const rpcMissing = rpc.error && /PGRST202|not exist|not find|404/i.test(rpc.error.message || rpc.error.code || '');
      if (!rpcMissing) {
        if (rpc.error || !rpc.data) return { data: null, error: rpc.error };
        const orderData = rpc.data as Order;
        // Notify merchant (best-effort; identical to the legacy path).
        const { data: branch } = await ordersRepository.getBranchMerchant(branchId);
        if (branch?.merchant_id) {
          await notificationService.sendNotification(branch.merchant_id, 'طلب جديد! تحقق من لوحة الطلبات.', 'order');
        }
        return { data: orderData, error: null };
      }
      // else: legacy fallback below (RPC not deployed yet)
    }

    // 1. Insert order metadata record (legacy fallback / sandbox is handled by caller)
    const { data: orderData, error: orderError } = await ordersRepository.insertOrder({
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
    });

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

    const { error: itemsError } = await ordersRepository.insertOrderItems(orderItemsPayload);

    if (itemsError) {
      // Cleanup orphan metadata on failure to ensure data integrity
      await ordersRepository.deleteOrder(orderData.id);
      return { data: null, error: itemsError };
    }

    // 3. Log initial status history record
    await ordersRepository.insertStatusHistory({
      order_id: orderData.id,
      status: 'pending',
      notes: 'تم إنشاء الطلب.',
    });

    // 4. Notify merchant about new order
    const { data: branch } = await ordersRepository.getBranchMerchant(branchId);
    if (branch?.merchant_id) {
      await notificationService.sendNotification(branch.merchant_id, 'طلب جديد! تحقق من لوحة الطلبات.', 'order');
    }

    return { data: orderData, error: null };
  },

  // Retrieve details of specific order including item variants list
  async getOrderDetails(orderId: string): Promise<{ data: Order | null; error: any }> {
    const { data, error } = await ordersRepository.getOrderDetails(orderId);
    return { data, error };
  },

  // Retrieve customer delivery history list
  async getCustomerOrders(customerId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await ordersRepository.getCustomerOrders(customerId);
    return { data: data || [], error };
  },

  // Update order status workflow
  async updateOrderStatus(orderId: string, status: string, notes?: string): Promise<{ error: any }> {
    // Fetch current order state for status guard + notification targets
    const { data: orderRow } = await ordersRepository.getOrderStateForUpdate(orderId);

    // Guard: skip if already at the target status (prevents duplicate history + notifications)
    if (orderRow?.status === status) return { error: null };

    const { error: updateError } = await ordersRepository.updateStatus(orderId, status);

    if (updateError) return { error: updateError };

    // Record state change log
    await ordersRepository.insertStatusHistory({
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
    const { data: order } = await ordersRepository.getStatus(orderId);

    if (!order || order.status !== 'pending') {
      return { success: false, error: new Error('Order is already in progress and cannot be cancelled.') };
    }

    const notes = reason ? `تم إلغاء الطلب: ${reason}` : 'تم إلغاء الطلب.';
    const { error } = await this.updateOrderStatus(orderId, 'cancelled', notes);
    return { success: !error, error };
  }
};
