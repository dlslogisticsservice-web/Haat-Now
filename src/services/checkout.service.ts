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
    
    return { data, error };
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
