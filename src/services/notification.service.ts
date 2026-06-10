import { supabase } from '../lib/supabase';
import { Notification, PushToken } from './types';

export const notificationService = {
  // Query all in-app notifications dispatched to specific active user ID
  async getUserNotifications(userId: string): Promise<{ data: Notification[]; error: any }> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('target_user_id', userId)
      .order('created_at', { ascending: false });
    
    return { data: data || [], error };
  },

  // Save new in-app notification dispatch log
  async sendNotification(userId: string | null, message: string, type = 'system'): Promise<{ data: Notification | null; error: any }> {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        target_user_id: userId,
        message,
        type
      })
      .select()
      .single();
    return { data, error };
  },

  // Register device push notification token
  async registerPushToken(tokenPayload: Omit<PushToken, 'id'>): Promise<{ error: any }> {
    // Upsert the token to prevent duplicate mapping
    const { error } = await supabase
      .from('push_tokens')
      .upsert({
        user_type: tokenPayload.user_type,
        user_id: tokenPayload.user_id,
        token: tokenPayload.token,
        device_type: tokenPayload.device_type
      }, { onConflict: 'token' });
    
    return { error };
  }
};
