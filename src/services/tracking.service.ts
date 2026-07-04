import { trackingRepository } from '../repositories/tracking.repository';
import { DriverLocation } from './types';

export const trackingService = {
  // Retrieve the latest verified GPS coordinates of an online courier driver assigned to an order
  async getDriverLocation(driverId: string): Promise<{ data: DriverLocation | null; error: any }> {
    const { data, error } = await trackingRepository.getLatest(driverId);
    return { data, error };
  },

  // Log new GPS location of delivery courier
  async updateDriverLocation(driverId: string, latitude: number, longitude: number): Promise<{ error: any }> {
    // Check if the record already exists for the driver
    const { data: existing } = await trackingRepository.findByDriver(driverId);

    let error;
    // Format coordinates as a PostgreSQL point representation string or coordinate object
    const coordsString = `(${latitude},${longitude})`;

    if (existing) {
      const { error: updateError } = await trackingRepository.updateCoords(driverId, coordsString);
      error = updateError;
    } else {
      const { error: insertError } = await trackingRepository.insertCoords(driverId, coordsString);
      error = insertError;
    }

    return { error };
  }
};
