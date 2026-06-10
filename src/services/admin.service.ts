import { supabase } from '../lib/supabase';
import { AppConfig, SupportTicket, SupportMessage } from './types';

export const adminService = {
  // Query full master table list of customer support tickets
  async getAllTickets(): Promise<{ data: SupportTicket[]; error: any }> {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*, customers(full_name, phone_number)')
      .order('created_at', { ascending: false });
    return { data: data || [], error };
  },

  // Update support ticket resolution state
  async updateTicketStatus(ticketId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed'): Promise<{ error: any }> {
    const { error } = await supabase
      .from('support_tickets')
      .update({ status })
      .eq('id', ticketId);
    return { error };
  },

  // Send an administrative reply to a customer support ticket
  async sendAdminReply(ticketId: string, adminId: string, text: string): Promise<{ data: SupportMessage | null; error: any }> {
    const { data, error } = await supabase
      .from('support_messages')
      .insert({
        ticket_id: ticketId,
        sender_type: 'admin',
        sender_id: adminId,
        message_text: text
      })
      .select()
      .single();
    
    return { data, error };
  },

  // Alter system-wide variables and custom operating limits
  async updateAppConfig(key: string, value: any, description?: string): Promise<{ error: any }> {
    const { error } = await supabase
      .from('app_config')
      .upsert({
        key,
        value,
        description,
        updated_at: new Date().toISOString()
      });
    return { error };
  },

  // Read app layout / operations configuration variables
  async getAppConfig(key: string): Promise<{ data: AppConfig | null; error: any }> {
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .eq('key', key)
      .single();
    return { data, error };
  },

  // Query platform active order statistics across zones
  async getGlobalAnalytics(): Promise<{ data: any; error: any }> {
    const { count: totalOrders, error: orderErr } = await supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });

    const { count: totalMerchants, error: merchantErr } = await supabase
      .from('merchants')
      .select('*', { count: 'exact', head: true });

    const { count: totalDrivers, error: driverErr } = await supabase
      .from('drivers')
      .select('*', { count: 'exact', head: true });

    return {
      data: {
        totalOrders: totalOrders || 0,
        totalMerchants: totalMerchants || 0,
        totalDrivers: totalDrivers || 0
      },
      error: orderErr || merchantErr || driverErr
    };
  }
};
