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
  },

  // ── Global enterprise search ───────────────────────────────────────────────
  // Searches customers, drivers, merchants, products and orders concurrently.
  // RBAC is enforced by the per-table RLS policies (admin scope). Returns a flat,
  // ranked, categorized result list.
  async globalSearch(query: string): Promise<{ data: GlobalSearchResult[]; error: any }> {
    const q = query.trim();
    if (q.length < 2) return { data: [], error: null };
    const like = `%${q}%`;
    const isUuid = /^[0-9a-f]{8}-?[0-9a-f]{4}/i.test(q);

    const [cust, drv, mer, prod, ord] = await Promise.all([
      supabase.from('customers').select('id, full_name, phone_number, email').or(`full_name.ilike.${like},phone_number.ilike.${like},email.ilike.${like}`).limit(6),
      supabase.from('drivers').select('id, full_name, phone_number, status').or(`full_name.ilike.${like},phone_number.ilike.${like}`).limit(6),
      supabase.from('merchants').select('id, business_name, contact_phone, business_type').or(`business_name.ilike.${like},contact_phone.ilike.${like}`).limit(6),
      supabase.from('products').select('id, name, price').ilike('name', like).limit(6),
      isUuid
        ? supabase.from('orders').select('id, status, total_amount, created_at').ilike('id::text', like).limit(6)
        : Promise.resolve({ data: [], error: null } as any),
    ]);

    const results: GlobalSearchResult[] = [];
    (cust.data || []).forEach((r: any) => results.push({ id: r.id, type: 'customer', title: r.full_name || r.phone_number, subtitle: r.phone_number || r.email || '', navKey: 'ops:care' }));
    (drv.data || []).forEach((r: any) => results.push({ id: r.id, type: 'driver', title: r.full_name || r.phone_number, subtitle: `${r.status ?? ''} · ${r.phone_number ?? ''}`, navKey: 'ops:performance' }));
    (mer.data || []).forEach((r: any) => results.push({ id: r.id, type: 'merchant', title: r.business_name, subtitle: `${r.business_type ?? ''} · ${r.contact_phone ?? ''}`, navKey: 'ops:kyc' }));
    (prod.data || []).forEach((r: any) => results.push({ id: r.id, type: 'product', title: r.name, subtitle: `${r.price ?? ''}`, navKey: 'coupons' }));
    (ord.data || []).forEach((r: any) => results.push({ id: r.id, type: 'order', title: `#${String(r.id).slice(0, 8)}`, subtitle: `${r.status ?? ''} · ${r.total_amount ?? ''}`, navKey: 'ops:command' }));

    // Rank: exact-ish prefix match first, then by type priority.
    const lower = q.toLowerCase();
    results.sort((a, b) => {
      const ap = a.title?.toLowerCase().startsWith(lower) ? 0 : 1;
      const bp = b.title?.toLowerCase().startsWith(lower) ? 0 : 1;
      return ap - bp;
    });
    const error = cust.error || drv.error || mer.error || prod.error || ord.error || null;
    return { data: results, error };
  },

  // ── Audit logs (System Logs viewer) ────────────────────────────────────────
  // Requires the audit_logs SELECT grant from migration 20260626000001.
  async auditLogs(opts: { search?: string; action?: string; limit?: number } = {}): Promise<{ data: AuditLogRow[]; error: any }> {
    let qb = supabase.from('audit_logs').select('id, action, table_name, record_id, created_at, severity').order('created_at', { ascending: false }).limit(opts.limit ?? 100);
    if (opts.action) qb = qb.eq('action', opts.action);
    if (opts.search) qb = qb.or(`action.ilike.%${opts.search}%,table_name.ilike.%${opts.search}%`);
    const { data, error } = await qb;
    return { data: (data as AuditLogRow[]) || [], error };
  }
};

export type GlobalSearchType = 'customer' | 'driver' | 'merchant' | 'product' | 'order';
export interface GlobalSearchResult { id: string; type: GlobalSearchType; title: string; subtitle: string; navKey: string; }
export interface AuditLogRow { id: string; action: string; table_name: string; record_id: string | null; created_at: string; severity?: string; }
