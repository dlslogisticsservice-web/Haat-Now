import { notificationRepository } from '../repositories/notification.repository';
import { Notification, PushToken } from './types';
import { monitoring } from './monitoring.service';

// Monotonic counter so each realtime subscriber gets a distinct channel name.
let _chanSeq = 0;

export const notificationService = {
  // Query all in-app notifications dispatched to specific active user ID
  async getUserNotifications(userId: string): Promise<{ data: Notification[]; error: any }> {
    const { data, error } = await notificationRepository.listForUser(userId);
    return { data: data || [], error };
  },

  // Save new in-app notification dispatch log
  async sendNotification(userId: string | null, message: string, type = 'system'): Promise<{ data: Notification | null; error: any }> {
    const { data, error } = await notificationRepository.insert({ target_user_id: userId, message, type });
    // Delivery failure — surfaced to Guardian, never swallowed or faked as success.
    if (error) monitoring.log('error', `[notify] delivery_failed: ${error.message || 'insert failed'}`, { type });
    return { data, error };
  },

  // Admin broadcast: send a notification to an audience (all/customers/drivers/merchants).
  // Production -> SECURITY DEFINER RPC broadcast_notification (admin-guarded, one row/user).
  // Sandbox (no backend) -> simulated success so the composer works end-to-end in demo.
  async broadcast(audience: 'all' | 'customers' | 'drivers' | 'merchants', message: string, type = 'announcement'): Promise<{ count: number; error: any }> {
    if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
      return { count: 0, error: null };
    }
    const { data, error } = await notificationRepository.broadcast(audience, type, message);
    return { count: typeof data === 'number' ? data : 0, error };
  },

  // Register device push notification token
  async registerPushToken(tokenPayload: Omit<PushToken, 'id'>): Promise<{ error: any }> {
    // Upsert the token to prevent duplicate mapping
    const { error } = await notificationRepository.upsertPushToken({
      user_type: tokenPayload.user_type,
      user_id: tokenPayload.user_id,
      token: tokenPayload.token,
      device_type: tokenPayload.device_type,
    });
    return { error };
  },

  // Mark a single notification as read (migration 0020 adds notifications.is_read).
  async markRead(notificationId: string): Promise<{ error: any }> {
    const { error } = await notificationRepository.markRead(notificationId);
    return { error };
  },

  // Mark all of a user's notifications as read.
  async markAllRead(userId: string): Promise<{ error: any }> {
    const { error } = await notificationRepository.markAllRead(userId);
    return { error };
  },

  // Count unread notifications for a user.
  async getUnreadCount(userId: string): Promise<{ count: number; error: any }> {
    const { count, error } = await notificationRepository.unreadCount(userId);
    return { count: count ?? 0, error };
  },

  // Remove a notification permanently. Requires the delete grant from migration
  // 20260626000001; callers handle the error gracefully if not yet applied.
  async remove(notificationId: string): Promise<{ error: any }> {
    const { error } = await notificationRepository.remove(notificationId);
    return { error };
  },

  // Subscribe to live notification changes for a user via Supabase Realtime.
  // Returns an unsubscribe function. Fires on every insert/update/delete.
  // Each call gets a UNIQUE channel name so multiple independent subscribers
  // (e.g. the sidebar badge + the notification center) don't collide on one channel.
  subscribe(userId: string, onChange: () => void): () => void {
    const channel = notificationRepository.subscribe(`notif:${userId}:${++_chanSeq}`, userId, onChange);
    return () => { notificationRepository.unsubscribe(channel); };
  }
};
