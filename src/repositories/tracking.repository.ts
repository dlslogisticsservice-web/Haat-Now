import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// tracking.repository (Phase-2 service→repository migration).
// Supabase data access for driver_locations. No business logic — the upsert
// decision (update vs insert) lives in tracking.service.
// ─────────────────────────────────────────────────────────────────────────────

export const trackingRepository = {
  getLatest(driverId: string) {
    return supabase.from('driver_locations').select('*').eq('driver_id', driverId).single();
  },

  findByDriver(driverId: string) {
    return supabase.from('driver_locations').select('id').eq('driver_id', driverId).single();
  },

  updateCoords(driverId: string, coords: string) {
    return supabase.from('driver_locations').update({ coords }).eq('driver_id', driverId);
  },

  insertCoords(driverId: string, coords: string) {
    return supabase.from('driver_locations').insert({ driver_id: driverId, coords });
  },
};
