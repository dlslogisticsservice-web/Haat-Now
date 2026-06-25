import { supabase } from '../lib/supabase';
import { Notification, PushToken } from './types';

// Monotonic counter so each realtime subscriber gets a distinct channel name.
let _chanSeq = 0;

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
  },

  // Mark a single notification as read (migration 0020 adds notifications.is_read).
  async markRead(notificationId: string): Promise<{ error: any }> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    return { error };
  },

  // Mark all of a user's notifications as read.
  async markAllRead(userId: string): Promise<{ error: any }> {
    const { error } = await supabase.from('notifications').update({ is_read: true }).eq('target_user_id', userId);
    return { error };
  },

  // Count unread notifications for a user.
  async getUnreadCount(userId: string): Promise<{ count: number; error: any }> {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('target_user_id', userId)
      .eq('is_read', false);
    return { count: count ?? 0, error };
  },

  // Remove a notification permanently. Requires the delete grant from migration
  // 20260626000001; callers handle the error gracefully if not yet applied.
  async remove(notificationId: string): Promise<{ error: any }> {
    const { error } = await supabase.from('notifications').delete().eq('id', notificationId);
    return { error };
  },

  // Subscribe to live notification changes for a user via Supabase Realtime.
  // Returns an unsubscribe function. Fires on every insert/update/delete.
  // Each call gets a UNIQUE channel name so multiple independent subscribers
  // (e.g. the sidebar badge + the notification center) don't collide on one channel.
  subscribe(userId: string, onChange: () => void): () => void {
    const channel = supabase
      .channel(`notif:${userId}:${++_chanSeq}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${userId}` }, () => onChange())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }
};
