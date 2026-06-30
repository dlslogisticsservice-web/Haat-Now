import { supabase } from '../lib/supabase';

// Demo CX: derive support tickets/SLA from seeded data so Customer Care is usable offline.
const CX_SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';
const cxls = <T,>(t: string): T[] => { try { return JSON.parse(localStorage.getItem(`haat_crud_${t}`) || '[]'); } catch { return []; } };

export interface RatingSummary { avg_rating: number; rating_count: number; five: number; four: number; three: number; two: number; one: number; }
export interface OrderTracking {
  order_id: string; status: string;
  driver: { name: string; phone: string; lat: number; lng: number } | null;
  destination: { lat: number; lng: number };
  remaining_km: number | null; eta_minutes: number | null;
  timeline: { status: string; at: string }[];
}

/** Customer-experience service: favorites, reorder, reviews, tracking, support, search. */
export const cxService = {
  // ── M1 Favorites & Reorder ──────────────────────────────────────────────────
  async favoriteProductIds(customerId: string): Promise<string[]> {
    const { data } = await supabase.from('favorites').select('product_id').eq('customer_id', customerId);
    return (data || []).map((r: any) => r.product_id);
  },
  async toggleFavoriteProduct(customerId: string, productId: string): Promise<{ active: boolean; error: any }> {
    const { data } = await supabase.from('favorites').select('id').eq('customer_id', customerId).eq('product_id', productId).maybeSingle();
    if (data) { const { error } = await supabase.from('favorites').delete().eq('id', data.id); return { active: false, error }; }
    const { error } = await supabase.from('favorites').insert({ customer_id: customerId, product_id: productId });
    return { active: true, error };
  },
  async favoriteBranches(customerId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('favorite_branches').select('*, merchant_branches(id, name, cover_image_url, zone_id)').eq('customer_id', customerId);
    return { data: data || [], error };
  },
  async toggleFavoriteBranch(customerId: string, branchId: string): Promise<{ active: boolean; error: any }> {
    const { data } = await supabase.from('favorite_branches').select('id').eq('customer_id', customerId).eq('branch_id', branchId).maybeSingle();
    if (data) { const { error } = await supabase.from('favorite_branches').delete().eq('id', data.id); return { active: false, error }; }
    const { error } = await supabase.from('favorite_branches').insert({ customer_id: customerId, branch_id: branchId });
    return { active: true, error };
  },
  async reorderItems(orderId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.rpc('reorder_items', { p_order_id: orderId });
    return { data: data || [], error };
  },
  async recentOrders(customerId: string, limit = 10): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('orders')
      .select('id, status, total_amount, created_at, branch_id, merchant_branches(name)')
      .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(limit);
    return { data: data || [], error };
  },

  // ── M2 Addresses ────────────────────────────────────────────────────────────
  async setDefaultAddress(addressId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('set_default_address', { p_address_id: addressId });
    return { error };
  },

  // ── M3 Reviews ──────────────────────────────────────────────────────────────
  async submitReview(orderId: string, targetType: 'merchant' | 'driver' | 'product', targetId: string, rating: number, comment?: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('submit_review', { p_order_id: orderId, p_target_type: targetType, p_target_id: targetId, p_rating: rating, p_comment: comment ?? null });
    return { error };
  },
  async ratingSummary(targetType: string, targetId: string): Promise<RatingSummary | null> {
    const { data } = await supabase.rpc('rating_summary', { p_target_type: targetType, p_target_id: targetId });
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { ...row, avg_rating: Number(row.avg_rating ?? 0), rating_count: Number(row.rating_count ?? 0) } : null;
  },
  async listReviews(targetType: string, targetId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('reviews').select('*').eq('target_type', targetType).eq('target_id', targetId).eq('status', 'approved').order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async reportReview(reviewId: string, reason: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('report_review', { p_review_id: reviewId, p_reason: reason });
    return { error };
  },
  // admin
  async moderationQueue(): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('reviews').select('*').or('is_reported.eq.true,status.eq.pending').order('created_at', { ascending: false }).limit(100);
    return { data: data || [], error };
  },
  async moderateReview(reviewId: string, status: 'approved' | 'hidden'): Promise<{ error: any }> {
    const { error } = await supabase.rpc('moderate_review', { p_review_id: reviewId, p_status: status });
    return { error };
  },

  // ── M4 Tracking ─────────────────────────────────────────────────────────────
  async tracking(orderId: string): Promise<OrderTracking | null> {
    const { data } = await supabase.rpc('order_tracking', { p_order_id: orderId });
    return (data as OrderTracking) ?? null;
  },
  subscribeTracking(orderId: string, onChange: () => void): () => void {
    const ch = supabase.channel(`track-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, onChange)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_locations' }, onChange)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  },

  // ── M5 Support ──────────────────────────────────────────────────────────────
  async createTicket(subject: string, type: 'dispute' | 'refund' | 'inquiry' | 'general', message: string, orderId?: string): Promise<{ data: any; error: any }> {
    const { data, error } = await supabase.rpc('create_support_ticket', { p_subject: subject, p_type: type, p_message: message, p_order_id: orderId ?? null });
    return { data, error };
  },
  async addTicketMessage(ticketId: string, message: string, isInternal = false): Promise<{ error: any }> {
    const { error } = await supabase.rpc('add_ticket_message', { p_ticket_id: ticketId, p_message: message, p_is_internal: isInternal });
    return { error };
  },
  async updateTicketStatus(ticketId: string, status: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('update_ticket_status', { p_ticket_id: ticketId, p_status: status });
    return { error };
  },
  async slaStats(): Promise<any> {
    if (CX_SANDBOX) return { open: 7, in_progress: 4, resolved: 138, breached: 2, avg_first_response_min: 6, avg_resolution_min: 41, satisfaction: 92 };
    const { data } = await supabase.rpc('support_sla_stats');
    return data ?? {};
  },
  async myTickets(customerId: string): Promise<{ data: any[]; error: any }> {
    const { data, error } = await supabase.from('support_tickets').select('*').eq('customer_id', customerId).order('created_at', { ascending: false });
    return { data: data || [], error };
  },
  async ticketMessages(ticketId: string, includeInternal = false): Promise<{ data: any[]; error: any }> {
    let q = supabase.from('support_messages').select('*').eq('ticket_id', ticketId).order('created_at', { ascending: true });
    if (!includeInternal) q = q.eq('is_internal', false);
    const { data, error } = await q;
    return { data: data || [], error };
  },
  async allTickets(status?: string): Promise<{ data: any[]; error: any }> {
    if (CX_SANDBOX) {
      const customers = cxls<any>('customers'); const orders = cxls<any>('orders');
      const subjects = ['تأخر في التوصيل', 'طلب غير مكتمل', 'استفسار عن الفاتورة', 'مشكلة في الدفع', 'طلب استرداد', 'سؤال عام'];
      const types = ['dispute', 'refund', 'inquiry', 'general']; const sts = ['open', 'in_progress', 'resolved', 'open', 'resolved'];
      const data = Array.from({ length: 12 }, (_, i) => { const c = customers[i % Math.max(1, customers.length)] || { id: 'cu', full_name: 'عميل' }; const o = orders[i % Math.max(1, orders.length)]; return { id: `tk-${i}`, subject: subjects[i % subjects.length], type: types[i % types.length], status: sts[i % sts.length], priority: i % 4 === 0 ? 'high' : 'normal', customer_id: c.id, order_id: o?.id || null, customers: { full_name: c.full_name }, created_at: new Date(Date.now() - i * 5400000).toISOString() }; });
      return { data: status ? data.filter(d => d.status === status) : data, error: null };
    }
    let q = supabase.from('support_tickets').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    return { data: data || [], error };
  },

  // ── M6 Search & Discovery ────────────────────────────────────────────────────
  async search(term: string): Promise<{ products: any[]; merchants: any[]; total: number }> {
    const { data } = await supabase.rpc('search_catalog', { p_term: term, p_limit: 20 });
    return (data as any) ?? { products: [], merchants: [], total: 0 };
  },
  async trending(limit = 10): Promise<any[]> {
    const { data } = await supabase.rpc('trending_products', { p_limit: limit });
    return data || [];
  },
  async recentlyOrdered(customerId: string, limit = 10): Promise<any[]> {
    const { data } = await supabase.rpc('recently_ordered', { p_customer: customerId, p_limit: limit });
    return data || [];
  },
  async recommendedMerchants(limit = 10): Promise<any[]> {
    const { data } = await supabase.rpc('recommended_merchants', { p_limit: limit });
    return data || [];
  },
  async searchTermStats(): Promise<any> {
    if (CX_SANDBOX) return { top_terms: [{ term: 'برجر', count: 412 }, { term: 'قهوة', count: 388 }, { term: 'بيتزا', count: 301 }, { term: 'شاورما', count: 277 }, { term: 'كبسة', count: 190 }], zero_result: [{ term: 'سوشي', count: 22 }, { term: 'ستيك', count: 14 }] };
    const { data } = await supabase.rpc('search_term_stats');
    return data ?? { top_terms: [], zero_result: [] };
  },
};
