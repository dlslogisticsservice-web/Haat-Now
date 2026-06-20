import { supabase } from '../lib/supabase';
import { Coupon, PaymentMethod, PaymentTransaction } from './types';

export const checkoutService = {
  // Check code coupon validity against existing offers database
  async verifyCoupon(code: string): Promise<{ data: Coupon | null; error: any }> {
    const { data, error } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase())
      .single();

    // 1. Exists
    if (error || !data) {
      return { data: null, error: error || new Error('الكود غير صالح أو غير موجود') };
    }
    // 2. Active flag
    if (!data.is_active) {
      return { data: null, error: new Error('هذا الكوبون غير مفعّل') };
    }
    // 3. Start date
    if (data.start_date && new Date(data.start_date) > new Date()) {
      return { data: null, error: new Error('هذا الكوبون لم يبدأ بعد') };
    }
    // 4. End date
    if (data.end_date && new Date(data.end_date) < new Date()) {
      return { data: null, error: new Error('انتهت صلاحية هذا الكوبون') };
    }
    // 5. Discount value
    if (!data.discount_percent || data.discount_percent <= 0) {
      return { data: null, error: new Error('هذا الكوبون لا يحتوي على خصم صالح') };
    }
    return { data, error: null };
  },

  // Get active registered payment cards/wallets of customer
  async getPaymentMethods(customerId: string): Promise<{ data: PaymentMethod[]; error: any }> {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('customer_id', customerId);
    return { data: data || [], error };
  },

  // Save new client card payment token credentials
  async createPaymentMethod(paymentMethod: Omit<PaymentMethod, 'id'>): Promise<{ data: PaymentMethod | null; error: any }> {
    // If setting default, ensure others are set to false first
    if (paymentMethod.is_default) {
      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('customer_id', paymentMethod.customer_id);
    }

    const { data, error } = await supabase
      .from('payment_methods')
      .insert(paymentMethod)
      .select()
      .single();
    
    return { data, error };
  },

  // Execute standard transaction and process checkout reference registration
  async recordPaymentTransaction(transaction: Omit<PaymentTransaction, 'id'>): Promise<{ data: PaymentTransaction | null; error: any }> {
    const { data, error } = await supabase
      .from('payment_transactions')
      .insert(transaction)
      .select()
      .single();
    return { data, error };
  }
};
