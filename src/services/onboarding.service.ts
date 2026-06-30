import { supabase } from '../lib/supabase';

export type EntityType = 'merchant' | 'driver';
export type AccountStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'suspended' | 'banned';
export const KYC_BUCKET = 'kyc-documents';

export interface MerchantApplication {
  business_name: string; contact_email: string; contact_phone: string;
  tax_number?: string; commercial_registration_number?: string; business_type?: string; address?: string;
}
export interface DriverApplication {
  full_name: string; phone: string; national_id_number?: string;
  license_number?: string; license_expiry?: string; vehicle_plate?: string; vehicle_id?: string; zone_id?: string;
}
export interface KycQueueItem {
  id: string; entity_type: EntityType; entity_id: string; status: 'pending' | 'approved' | 'rejected';
  submitted_at: string; reviewed_at: string | null; decision_notes: string | null;
  entity_name?: string;
}
export interface DocRow {
  id: string; doc_type: string; file_path: string; file_name: string | null;
  status: 'pending' | 'approved' | 'rejected'; notes: string | null; uploaded_at: string;
}
export interface HistoryRow {
  from_status: string | null; to_status: string; action: string; reason: string | null; created_at: string;
}

/** Trust / KYC / supply-onboarding service. Applicant submission + document upload + admin review. */
export const onboardingService = {
  // ── applicant submission ──────────────────────────────────────────────────
  async submitMerchant(app: MerchantApplication): Promise<{ id: string | null; error: any }> {
    const { data, error } = await supabase.rpc('submit_merchant_application', {
      p_business_name: app.business_name, p_contact_email: app.contact_email, p_contact_phone: app.contact_phone,
      p_tax_number: app.tax_number ?? null, p_cr_number: app.commercial_registration_number ?? null,
      p_business_type: app.business_type ?? null, p_address: app.address ?? null,
    });
    return { id: (data as string) ?? null, error };
  },

  async submitDriver(app: DriverApplication): Promise<{ id: string | null; error: any }> {
    const { data, error } = await supabase.rpc('submit_driver_application', {
      p_full_name: app.full_name, p_phone: app.phone, p_national_id: app.national_id_number ?? null,
      p_license_number: app.license_number ?? null, p_license_expiry: app.license_expiry ?? null,
      p_vehicle_plate: app.vehicle_plate ?? null, p_vehicle_id: app.vehicle_id ?? null, p_zone_id: app.zone_id ?? null,
    });
    return { id: (data as string) ?? null, error };
  },

  /** Upload a KYC file to the private bucket under <userId>/<entity>/<docType>-<ts>.<ext>. */
  async uploadDocument(userId: string, entityType: EntityType, docType: string, file: File): Promise<{ path: string | null; error: any }> {
    const ext = file.name.split('.').pop() ?? 'pdf';
    const path = `${userId}/${entityType}/${docType}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, file);
    return { path: error ? null : path, error };
  },

  async recordMerchantDocument(merchantId: string, docType: string, filePath: string, fileName: string): Promise<{ error: any }> {
    const { error } = await supabase.from('merchant_documents').insert({ merchant_id: merchantId, doc_type: docType, file_path: filePath, file_name: fileName });
    return { error };
  },
  async recordDriverDocument(driverId: string, docType: string, filePath: string, fileName: string): Promise<{ error: any }> {
    const { error } = await supabase.from('driver_documents').insert({ driver_id: driverId, doc_type: docType, file_path: filePath, file_name: fileName });
    return { error };
  },

  /** The applicant's own application id (by owner_user_id) for the given entity. */
  async myEntityId(entityType: EntityType, userId: string): Promise<{ id: string | null; error: any }> {
    const table = entityType === 'merchant' ? 'merchants' : 'drivers';
    const { data, error } = await supabase.from(table).select('id').eq('owner_user_id', userId).maybeSingle();
    return { id: (data?.id as string) ?? null, error };
  },

  async myStatus(entityType: EntityType, entityId: string): Promise<{ status: AccountStatus | null; reason: string | null; error: any }> {
    const { data, error } = await supabase.from('account_status').select('status, reason')
      .eq('entity_type', entityType).eq('entity_id', entityId).maybeSingle();
    return { status: (data?.status as AccountStatus) ?? null, reason: (data?.reason as string) ?? null, error };
  },

  // ── admin review ──────────────────────────────────────────────────────────
  async kycQueue(status: 'pending' | 'approved' | 'rejected' = 'pending'): Promise<{ data: KycQueueItem[]; error: any }> {
    if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
      const ls = (t: string): any[] => { try { return JSON.parse(localStorage.getItem(`haat_crud_${t}`) || '[]'); } catch { return []; } };
      const drivers = ls('drivers'), merchants = ls('merchants');
      const map: Record<string, { d: [number, number]; m: [number, number] }> = { pending: { d: [0, 5], m: [0, 3] }, approved: { d: [5, 14], m: [3, 9] }, rejected: { d: [14, 16], m: [9, 10] } };
      const r = map[status]; const rows: KycQueueItem[] = [];
      drivers.slice(r.d[0], r.d[1]).forEach((d: any, i: number) => rows.push({ id: `kyc-d-${d.id}`, entity_type: 'driver' as any, entity_id: d.id, status, submitted_at: new Date(Date.now() - (i + 1) * 7200000).toISOString(), reviewed_at: status === 'pending' ? null : new Date().toISOString(), decision_notes: status === 'rejected' ? 'وثائق غير واضحة' : null, entity_name: d.full_name }));
      merchants.slice(r.m[0], r.m[1]).forEach((m: any, i: number) => rows.push({ id: `kyc-m-${m.id}`, entity_type: 'merchant' as any, entity_id: m.id, status, submitted_at: new Date(Date.now() - (i + 1) * 9000000).toISOString(), reviewed_at: status === 'pending' ? null : new Date().toISOString(), decision_notes: null, entity_name: m.business_name }));
      return { data: rows, error: null };
    }
    const { data, error } = await supabase.from('kyc_reviews').select('*')
      .eq('status', status).order('submitted_at', { ascending: true });
    const rows = (data as KycQueueItem[]) || [];
    // resolve entity display names
    const mIds = rows.filter(r => r.entity_type === 'merchant').map(r => r.entity_id);
    const dIds = rows.filter(r => r.entity_type === 'driver').map(r => r.entity_id);
    const names: Record<string, string> = {};
    if (mIds.length) { const { data: m } = await supabase.from('merchants').select('id, business_name').in('id', mIds); (m || []).forEach((x: any) => names[x.id] = x.business_name); }
    if (dIds.length) { const { data: d } = await supabase.from('drivers').select('id, full_name').in('id', dIds); (d || []).forEach((x: any) => names[x.id] = x.full_name); }
    return { data: rows.map(r => ({ ...r, entity_name: names[r.entity_id] ?? r.entity_id.slice(0, 8) })), error };
  },

  async documents(entityType: EntityType, entityId: string): Promise<{ data: DocRow[]; error: any }> {
    const table = entityType === 'merchant' ? 'merchant_documents' : 'driver_documents';
    const fk = entityType === 'merchant' ? 'merchant_id' : 'driver_id';
    const { data, error } = await supabase.from(table).select('*').eq(fk, entityId).order('uploaded_at', { ascending: true });
    return { data: (data as DocRow[]) || [], error };
  },

  async signedDocUrl(path: string): Promise<{ url: string | null; error: any }> {
    const { data, error } = await supabase.storage.from(KYC_BUCKET).createSignedUrl(path, 300);
    return { url: data?.signedUrl ?? null, error };
  },

  async history(entityType: EntityType, entityId: string): Promise<{ data: HistoryRow[]; error: any }> {
    const { data, error } = await supabase.from('approval_history').select('from_status, to_status, action, reason, created_at')
      .eq('entity_type', entityType).eq('entity_id', entityId).order('created_at', { ascending: false });
    return { data: (data as HistoryRow[]) || [], error };
  },

  async reviewDocument(entityType: EntityType, docId: string, status: 'approved' | 'rejected', notes?: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('review_document', { p_entity_type: entityType, p_doc_id: docId, p_status: status, p_notes: notes ?? null });
    return { error };
  },
  async reviewKyc(entityType: EntityType, entityId: string, decision: 'approved' | 'rejected', notes?: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('review_kyc', { p_entity_type: entityType, p_entity_id: entityId, p_decision: decision, p_notes: notes ?? null });
    return { error };
  },
  async suspend(entityType: EntityType, entityId: string, reason: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('suspend_entity', { p_entity_type: entityType, p_entity_id: entityId, p_reason: reason });
    return { error };
  },
  async liftSuspension(entityType: EntityType, entityId: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('lift_suspension', { p_entity_type: entityType, p_entity_id: entityId });
    return { error };
  },
  async ban(entityType: EntityType, entityId: string, reason: string): Promise<{ error: any }> {
    const { error } = await supabase.rpc('ban_entity', { p_entity_type: entityType, p_entity_id: entityId, p_reason: reason });
    return { error };
  },

  /** Compliance dashboard counts by status across both entity types. */
  async complianceStats(): Promise<{ data: Record<string, Record<string, number>>; error: any }> {
    if (import.meta.env.VITE_AUTH_MODE === 'sandbox') {
      const ls = (t: string): any[] => { try { return JSON.parse(localStorage.getItem(`haat_crud_${t}`) || '[]'); } catch { return []; } };
      const dN = ls('drivers').length, mN = ls('merchants').length;
      return { data: { merchant: { approved: Math.round(mN * 0.7), pending: Math.round(mN * 0.2), suspended: Math.round(mN * 0.05), rejected: Math.round(mN * 0.05) }, driver: { approved: Math.round(dN * 0.75), pending: Math.round(dN * 0.15), suspended: Math.round(dN * 0.05), banned: Math.round(dN * 0.05) } }, error: null };
    }
    const { data, error } = await supabase.from('account_status').select('entity_type, status');
    const out: Record<string, Record<string, number>> = { merchant: {}, driver: {} };
    (data || []).forEach((r: any) => { out[r.entity_type][r.status] = (out[r.entity_type][r.status] || 0) + 1; });
    return { data: out, error };
  },
};
