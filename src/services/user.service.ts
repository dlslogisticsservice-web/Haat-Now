import { supabase } from '../lib/supabase';
import { Customer, Address, Subscription } from './types';

export const userService = {
  // Get Customer Profile details
  async getProfile(customerId: string): Promise<{ data: Customer | null; error: any }> {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();
    
    return { data, error };
  },

  // Update customer details
  async updateProfile(customerId: string, payload: Partial<Omit<Customer, 'id' | 'phone_number'>>): Promise<{ error: any }> {
    const { error } = await supabase
      .from('customers')
      .update(payload)
      .eq('id', customerId);
    return { error };
  },

  // Fetch all addresses configured by customer
  async getAddresses(customerId: string): Promise<{ data: Address[]; error: any }> {
    const { data, error } = await supabase
      .from('addresses')
      .select('*, zones(*, cities(*))')
      .eq('customer_id', customerId);
    
    return { data: data || [], error };
  },

  // Save a new physical delivery address
  async createAddress(address: Omit<Address, 'id'>): Promise<{ data: Address | null; error: any }> {
    const { data, error } = await supabase
      .from('addresses')
      .insert(address)
      .select()
      .single();
    
    return { data, error };
  },

  // Delete customer address
  async deleteAddress(addressId: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('addresses')
      .delete()
      .eq('id', addressId);
    return { error };
  },

  // Get active Premium Subscription status
  async getSubscription(customerId: string): Promise<{ data: Subscription | null; error: any }> {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*, memberships(*)')
      .eq('customer_id', customerId)
      .single();
    
    return { data, error };
  }
};
