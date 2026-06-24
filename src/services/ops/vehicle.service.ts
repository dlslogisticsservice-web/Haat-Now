import { supabase } from '../../lib/supabase';

export interface Vehicle {
  id: string;
  type: 'motorcycle' | 'car' | 'van' | 'truck';
  name_en: string;
  name_ar: string;
  capacity: number;        // max concurrent orders
  speed_kmh: number;       // average delivery speed
  pricing_modifier: number; // multiplies zone fee
  is_active: boolean;
}

/** Vehicle-type management + driver↔vehicle assignment. */
export const vehicleService = {
  async list(): Promise<{ data: Vehicle[]; error: any }> {
    const { data, error } = await supabase
      .from('vehicles')
      .select('*')
      .order('capacity', { ascending: true });
    return { data: (data as any) || [], error };
  },

  async update(id: string, patch: Partial<Pick<Vehicle, 'capacity' | 'speed_kmh' | 'pricing_modifier' | 'is_active' | 'name_en' | 'name_ar'>>): Promise<{ error: any }> {
    const { error } = await supabase.from('vehicles').update(patch).eq('id', id);
    return { error };
  },

  /** Assign a vehicle type to a driver (also sets the driver's concurrency to capacity). */
  async assignToDriver(driverId: string, vehicleId: string): Promise<{ error: any }> {
    const { data: veh } = await supabase.from('vehicles').select('capacity').eq('id', vehicleId).single();
    const { error } = await supabase
      .from('drivers')
      .update({ vehicle_id: vehicleId, max_concurrent_orders: veh?.capacity ?? 1 })
      .eq('id', driverId);
    return { error };
  },
};
