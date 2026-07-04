import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// audit.repository (Phase-2 architecture stabilization).
// Realtime access to the audit_logs stream for the System Logs console.
// (Reads go through admin.service; this owns only the live subscription.)
// ─────────────────────────────────────────────────────────────────────────────

export const auditRepository = {
  /** Realtime: fire onInsert whenever a new audit_logs row is written. */
  subscribeInserts(onInsert: () => void): any {
    return supabase
      .channel('audit:live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_logs' }, () => onInsert())
      .subscribe();
  },

  unsubscribe(channel: any): void {
    if (channel) supabase.removeChannel(channel);
  },
};
