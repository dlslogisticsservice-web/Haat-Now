import { supabase } from '../../lib/supabase';

// Demo is client-side — never hit Supabase in sandbox. Matches the guard every other
// ops service already carries (dispatch/payout/shift); its absence here meant the
// Zones, Vehicles and Performance tabs fired real network calls in the demo build
// and failed with 401/403 instead of degrading cleanly.
const SANDBOX = import.meta.env.VITE_AUTH_MODE === 'sandbox';


export interface DeliveryZone {
  id: string;
  name: string;
  city_id: string | null;
  country_code: string | null;
  polygon: number[][] | null; // [[lng,lat], ...]
  base_fee: number;
  per_km_fee: number;
  min_fee: number;
  eta_minutes: number;
  is_active: boolean;
  cities?: { name: string; country_id: string } | null;
}

export interface ZoneQuote { fee: number; eta_minutes: number; }

/** Delivery-zone management: polygons, pricing, ETA, activation, geo lookup. */
export const zoneService = {
  async list(): Promise<{ data: DeliveryZone[]; error: any }> {
    if (SANDBOX) return { data: [], error: null };
    const { data, error } = await supabase
      .from('zones')
      .select('id, name, city_id, country_code, polygon, base_fee, per_km_fee, min_fee, eta_minutes, is_active, cities(name, country_id)')
      .order('name', { ascending: true });
    return { data: (data as any) || [], error };
  },

  async get(id: string): Promise<{ data: DeliveryZone | null; error: any }> {
    const { data, error } = await supabase
      .from('zones')
      .select('id, name, city_id, country_code, polygon, base_fee, per_km_fee, min_fee, eta_minutes, is_active, cities(name, country_id)')
      .eq('id', id).single();
    return { data: (data as any) ?? null, error };
  },

  async create(payload: Partial<DeliveryZone>): Promise<{ data: DeliveryZone | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.from('zones').insert({
      name: payload.name,
      city_id: payload.city_id ?? null,
      country_code: payload.country_code ?? null,
      polygon: payload.polygon ?? null,
      base_fee: payload.base_fee ?? 10,
      per_km_fee: payload.per_km_fee ?? 2,
      min_fee: payload.min_fee ?? 10,
      eta_minutes: payload.eta_minutes ?? 30,
      is_active: payload.is_active ?? true,
    }).select().single();
    return { data: (data as any) ?? null, error };
  },

  async update(id: string, patch: Partial<DeliveryZone>): Promise<{ error: any }> {
    if (SANDBOX) return { error: null };
    const { error } = await supabase.from('zones').update(patch).eq('id', id);
    return { error };
  },

  async setActive(id: string, isActive: boolean): Promise<{ error: any }> {
    const { error } = await supabase.from('zones').update({ is_active: isActive }).eq('id', id);
    return { error };
  },

  /** Delivery quote (fee + ETA) for a zone, distance, and optional vehicle. */
  async quote(zoneId: string, distanceKm: number, vehicleId?: string): Promise<{ data: ZoneQuote | null; error: any }> {
    if (SANDBOX) return { data: null, error: null };
    const { data, error } = await supabase.rpc('zone_quote', {
      p_zone_id: zoneId, p_distance_km: distanceKm, p_vehicle_id: vehicleId ?? null,
    });
    const row = Array.isArray(data) ? data[0] : data;
    return { data: (row as ZoneQuote) ?? null, error };
  },

  /** Which active zone (polygon) contains a point. */
  async zoneForPoint(lat: number, lng: number): Promise<{ data: string | null; error: any }> {
    const { data, error } = await supabase.rpc('zone_for_point', { p_lat: lat, p_lng: lng });
    return { data: (data as string) ?? null, error };
  },
};
