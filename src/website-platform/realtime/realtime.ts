// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Realtime experience (Wave 3, Part 3).
// Reuses the app's existing realtime services (order updates + driver GPS + live
// tracking) — no new realtime infrastructure. Exposes a small subscription port the
// website consumes for live driver position, ETA, delivery status and notifications.
// Reusable by every tenant.
// ─────────────────────────────────────────────────────────────────────────────

import { ordersRepository } from '../../repositories/orders.repository';
import { cxService } from '../../services/cx.service';
import { notificationService } from '../../services/notification.service';

export type Unsub = () => void;

export interface DriverLocationUpdate { lat: number; lng: number }

/** Live subscriptions for the website — all delegate to existing realtime services.
 *  Order/tracking subscriptions are notify-style (the consumer refetches the snapshot),
 *  matching the app's existing realtime API. */
export interface RealtimePort {
  onCustomerOrders(customerId: string, onChange: () => void): Unsub;
  onDriverLocation(driverId: string, onLocation: (u: DriverLocationUpdate) => void): Unsub;
  onOrderTracking(orderId: string, onChange: () => void): Unsub;
  onNotifications(userId: string, onChange: () => void): Unsub;
}

/** Production adapter over the app's Supabase realtime channels. */
export class AppRealtime implements RealtimePort {
  onCustomerOrders(customerId: string, onChange: () => void): Unsub {
    const channel = ordersRepository.subscribeCustomerOrders(customerId, onChange);
    return () => ordersRepository.unsubscribe(channel);
  }
  onDriverLocation(driverId: string, onLocation: (u: DriverLocationUpdate) => void): Unsub {
    const channel = ordersRepository.subscribeDriverLocation(driverId, (payload: { new?: { coords?: string } }) => {
      const coords = payload?.new?.coords;
      if (typeof coords === 'string') {
        const m = coords.match(/(-?\d+(?:\.\d+)?)[ ,]+(-?\d+(?:\.\d+)?)/);
        if (m) onLocation({ lat: parseFloat(m[1]), lng: parseFloat(m[2]) });
      }
    });
    return () => ordersRepository.unsubscribe(channel);
  }
  onOrderTracking(orderId: string, onChange: () => void): Unsub {
    // Notify-style: on any order/driver-location change, the consumer refetches the
    // tracking snapshot (status, remaining_km, ETA) via cxService.tracking(orderId).
    return cxService.subscribeTracking(orderId, onChange);
  }
  onNotifications(userId: string, onChange: () => void): Unsub {
    return notificationService.subscribe(userId, onChange);
  }
}

export function createRealtime(): RealtimePort {
  return new AppRealtime();
}
