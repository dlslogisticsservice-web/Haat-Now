import { supabase } from '../lib/supabase';
import { DriverLocation } from './types';

export const trackingService = {
  // Retrieve the latest verified GPS coordinates of an online courier driver assigned to an order
  async getDriverLocation(driverId: string): Promise<{ data: DriverLocation | null; error: any }> {
    const { data, error } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('driver_id', driverId)
      .single();
    
    return { data, error };
  },

  // Log new GPS location of delivery courier
  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<{ error: any }> {
    // Check if the record already exists for the driver
    const { data: existing } = await supabase
      .from('driver_locations')
      .select('id')
      .eq('driver_id', driverId)
      .single();

    let error;
    // Format coordinates as a PostgreSQL point representation string or coordinate object
    const coordsString = `(${latitude},${longitude})`;

    if (existing) {
      const { error: updateError } = await supabase
        .from('driver_locations')
        .update({ coords: coordsString })
        .eq('driver_id', driverId);
      error = updateError;
    } else {
      const { error: insertError } = await supabase
        .from('driver_locations')
        .insert({ driver_id: driverId, coords: coordsString });
      error = insertError;
    }

    return { error };
  }
};
