import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// customer.repository (Phase-2 service→repository migration).
// Supabase data access for the customer profile + address book (with zone hierarchy).
// No business logic — first-address-is-default and the two-step default change stay
// in customer.service.
// ─────────────────────────────────────────────────────────────────────────────

const ADDRESS_SELECT = '*, zones(id, name, city_id, cities(id, name, country_id, countries(id, name, code)))';
const ZONE_SELECT = 'id, name, city_id, cities(id, name, country_id, countries(id, name, code))';

export const customerRepository = {
  getProfile(customerId: string) {
    return supabase.from('customers').select('id, phone_number, full_name, email, avatar_url, created_at').eq('id', customerId).maybeSingle();
  },

  updateProfile(customerId: string, payload: Record<string, any>) {
    return supabase.from('customers').update(payload).eq('id', customerId);
  },

  getAddresses(customerId: string) {
    return supabase.from('addresses').select(ADDRESS_SELECT).eq('customer_id', customerId).order('is_default', { ascending: false });
  },

  getZonesWithHierarchy() {
    return supabase.from('zones').select(ZONE_SELECT).order('name');
  },

  countAddresses(customerId: string) {
    return supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('customer_id', customerId);
  },

  insertAddress(row: Record<string, any>) {
    return supabase.from('addresses').insert(row).select(ADDRESS_SELECT).single();
  },

  updateAddress(addressId: string, payload: Record<string, any>) {
    return supabase.from('addresses').update(payload).eq('id', addressId);
  },

  deleteAddress(addressId: string) {
    return supabase.from('addresses').delete().eq('id', addressId);
  },

  clearDefault(customerId: string) {
    return supabase.from('addresses').update({ is_default: false }).eq('customer_id', customerId);
  },

  setDefault(addressId: string, customerId: string) {
    return supabase.from('addresses').update({ is_default: true }).eq('id', addressId).eq('customer_id', customerId);
  },
};
