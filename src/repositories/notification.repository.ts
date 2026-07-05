import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// notification.repository (Phase-2 service→repository migration).
// Supabase data access for in-app notifications, push tokens, the broadcast RPC and
// the realtime stream. No business logic — the sandbox short-circuit and the
// channel-name sequence stay in notification.service.
// ─────────────────────────────────────────────────────────────────────────────

export const notificationRepository = {
  listForUser(userId: string) {
    return supabase.from('notifications').select('*').eq('target_user_id', userId).order('created_at', { ascending: false });
  },

  insert(row: { target_user_id: string | null; message: string; type: string }) {
    return supabase.from('notifications').insert(row).select().single();
  },

  broadcast(audience: string, type: string, message: string) {
    return supabase.rpc('broadcast_notification', { p_audience: audience, p_type: type, p_message: message });
  },

  upsertPushToken(row: { user_type: string; user_id: string; token: string; device_type: string }) {
    return supabase.from('push_tokens').upsert(row, { onConflict: 'token' });
  },

  markRead(id: string) {
    return supabase.from('notifications').update({ is_read: true }).eq('id', id);
  },

  markAllRead(userId: string) {
    return supabase.from('notifications').update({ is_read: true }).eq('target_user_id', userId);
  },

  unreadCount(userId: string) {
    return supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('target_user_id', userId).eq('is_read', false);
  },

  remove(id: string) {
    return supabase.from('notifications').delete().eq('id', id);
  },

  subscribe(channelName: string, userId: string, onChange: () => void): any {
    return supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `target_user_id=eq.${userId}` }, () => onChange())
      .subscribe();
  },

  unsubscribe(channel: any): void {
    if (channel) supabase.removeChannel(channel);
  },
};
