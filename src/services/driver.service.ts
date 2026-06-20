import { supabase } from '../lib/supabase';
import { Driver, Order, DriverEarning, ORDER_STATUSES, DRIVER_ACTIVE_STATUSES } from './types';

export const driverService = {
  // Update offline/online delivery status of a courier
  async toggleOnline(driverId: string, isOnline: boolean): Promise<{ error: any }> {
    const { error } = await supabase
      .from('drivers')
      .update({ is_online: isOnline })
      .eq('id', driverId);
    return { error };
  },

  // Get list of active orders waiting for drivers within a specific zone ID
  async getZoneDeliveries(zoneId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_branches(*, zones(*))')
      .eq('status', 'accepted') // Only orders accepted by restaurant but pending courier pickup
      .filter('merchant_branches.zone_id', 'eq', zoneId);
    return { data: data || [], error };
  },

  // Assign order delivery package to a courier.
  // Uses a single atomic UPDATE with a WHERE guard (driver_id IS NULL AND status='accepted')
  // to eliminate the TOCTOU race where two drivers could both read driver_id=null
  // and then both win the subsequent update. Zero affected rows means the job was already taken.
  async acceptDelivery(orderId: string, driverId: string): Promise<{ success: boolean; error: any }> {
    const { data: updated, error } = await supabase
      .from('orders')
      .update({ driver_id: driverId, status: ORDER_STATUSES.PREPARING })
      .eq('id', orderId)
      .is('driver_id', null)
      .eq('status', ORDER_STATUSES.ACCEPTED)
      .select('id');

    if (error) return { success: false, error };
    if (!updated || updated.length === 0) {
      return { success: false, error: new Error('لقد تم قبول هذا الطلب بالفعل من قبل مندوب آخر.') };
    }

    // Log tracking update
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'preparing',
      notes: 'تم قبول طلب التوصيل وهو في مرحلة التجهيز الآن.',
    });

    return { success: true, error: null };
  },

  // Get active driver's assigned orders
  async getActiveJobs(driverId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await supabase
      .from('orders')
      .select('*, merchant_branches(*), customers(*)')
      .eq('driver_id', driverId)
      .in('status', [...DRIVER_ACTIVE_STATUSES]);
    
    return { data: data || [], error };
  },

  // View accrued payout and tips balance report
  async getEarnings(driverId: string): Promise<{ data: DriverEarning[]; error: any }> {
    const { data, error } = await supabase
      .from('driver_earnings')
      .select('*')
      .eq('driver_id', driverId);
    return { data: data || [], error };
  }
};
