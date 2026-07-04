import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// support.repository (Phase-2 architecture stabilization).
// Supabase data access for customer support tickets/messages. No business logic.
// ─────────────────────────────────────────────────────────────────────────────

export const supportRepository = {
  createTicket(row: { customer_id: string; subject: string; status: string; priority: string }) {
    return supabase.from('support_tickets').insert(row).select().single();
  },

  addMessage(row: { ticket_id: string; sender_type: string; sender_id: string; message_text: string }) {
    return supabase.from('support_messages').insert(row);
  },
};
