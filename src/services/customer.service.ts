import { customerRepository } from '../repositories/customer.repository';

// ── Enriched types (local to this service) ────────────────────────
export interface ZoneHierarchy {
  id: string;
  name: string;
  city_id: string | null;
  cities: {
    id: string;
    name: string;
    country_id: string | null;
    countries: { id: string; name: string; code: string } | null;
  } | null;
}

export interface AddressWithZone {
  id: string;
  customer_id: string;
  zone_id: string;
  address_line: string | null;
  label: string | null;
  label_type?: 'home' | 'work' | 'custom' | null;
  notes?: string | null;
  is_default: boolean;
  latitude?: number | null;
  longitude?: number | null;
  zones: ZoneHierarchy | null;
}

export interface CustomerProfile {
  id: string;
  phone_number: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

// ── Service ───────────────────────────────────────────────────────
export const customerService = {

  async getProfile(customerId: string): Promise<{ data: CustomerProfile | null; error: any }> {
    const { data, error } = await customerRepository.getProfile(customerId);
    return { data: data as CustomerProfile | null, error };
  },

  async updateProfile(
    customerId: string,
    payload: Partial<Pick<CustomerProfile, 'full_name' | 'email' | 'avatar_url'>>,
  ): Promise<{ error: any }> {
    const { error } = await customerRepository.updateProfile(customerId, payload);
    return { error };
  },

  async getAddresses(customerId: string): Promise<{ data: AddressWithZone[]; error: any }> {
    const { data, error } = await customerRepository.getAddresses(customerId);
    return { data: (data as AddressWithZone[]) || [], error };
  },

  async getZonesWithHierarchy(): Promise<{ data: ZoneHierarchy[]; error: any }> {
    const { data, error } = await customerRepository.getZonesWithHierarchy();
    return { data: (data as unknown as ZoneHierarchy[]) || [], error };
  },

  async createAddress(
    customerId: string,
    payload: { label: string; address_line: string; zone_id: string; latitude?: number | null; longitude?: number | null; label_type?: string; notes?: string | null },
  ): Promise<{ data: AddressWithZone | null; error: any }> {
    // First address for a customer is automatically set as default
    const { count } = await customerRepository.countAddresses(customerId);
    const isDefault = (count ?? 0) === 0;

    const { data, error } = await customerRepository.insertAddress({ ...payload, customer_id: customerId, is_default: isDefault });
    return { data: data as AddressWithZone | null, error };
  },

  async updateAddress(
    addressId: string,
    payload: Partial<{ label: string; address_line: string; zone_id: string; latitude: number | null; longitude: number | null; label_type: string; notes: string | null }>,
  ): Promise<{ error: any }> {
    const { error } = await customerRepository.updateAddress(addressId, payload);
    return { error };
  },

  async deleteAddress(addressId: string): Promise<{ error: any }> {
    const { error } = await customerRepository.deleteAddress(addressId);
    return { error };
  },

  // Two-step default change: clear all → set one.
  // Both steps are scoped to customer_id so RLS passes.
  // Non-atomic by design (acceptable for client-side address book).
  async setDefaultAddress(customerId: string, addressId: string): Promise<{ error: any }> {
    const { error: clearErr } = await customerRepository.clearDefault(customerId);
    if (clearErr) return { error: clearErr };

    const { error } = await customerRepository.setDefault(addressId, customerId);
    return { error };
  },
};
