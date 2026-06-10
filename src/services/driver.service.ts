import { supabase } from '../lib/supabase';
import { Driver, Order, DriverEarning } from './types';

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

  // Assign order delivery package to a courier
  async acceptDelivery(orderId: string, driverId: string): Promise<{ success: boolean; error: any }> {
    // 1. Transaction check to verify order is still waiting for a driver
    const { data: order } = await supabase
      .from('orders')
      .select('driver_id, status')
      .eq('id', orderId)
      .single();

    if (!order || order.driver_id) {
      return { success: false, error: new Error('لقد تم قبول هذا الطلب بالفعل من قبل مندوب آخر.') };
    }

    // 2. Assign driver
    const { error } = await supabase
      .from('orders')
      .update({
        driver_id: driverId,
        status: 'preparing'
      })
      .eq('id', orderId);

    if (error) return { success: false, error };

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
      .in('status', ['preparing', 'on_the_way']);
    
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
