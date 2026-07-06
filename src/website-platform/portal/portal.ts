// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Customer Portal (Wave 3, Part 4).
// A facade over the SAME app services the mobile app uses — no duplicated logic.
// Exposes wallet, loyalty/rewards, saved orders, favorites and notifications to the
// website. Reusable by every tenant. (Adapter is browser-side; tested via a fake port.)
// ─────────────────────────────────────────────────────────────────────────────

import type { Result } from '../shared/types';
import { ok, err } from '../shared/types';
import { errors } from '../shared/errors';
import { walletService } from '../../services/wallet.service';
import { loyaltyService } from '../../services/loyalty.service';
import { orderService } from '../../services/order.service';
import { notificationService } from '../../services/notification.service';
import { cxService } from '../../services/cx.service';
import type { Wallet, WalletTransaction, LoyaltyTransaction, Order, Notification } from '../../services/types';

export interface CustomerPortalPort {
  wallet(customerId: string): Promise<Result<Wallet | null>>;
  walletTransactions(walletId: string): Promise<Result<WalletTransaction[]>>;
  loyaltyPoints(customerId: string): Promise<Result<number>>;
  loyaltyHistory(customerId: string): Promise<Result<LoyaltyTransaction[]>>;
  savedOrders(customerId: string): Promise<Result<Order[]>>;
  favoriteProductIds(customerId: string): Promise<Result<string[]>>;
  notifications(customerId: string): Promise<Result<Notification[]>>;
  unreadCount(customerId: string): Promise<Result<number>>;
  markNotificationRead(notificationId: string): Promise<Result<true>>;
  markAllNotificationsRead(customerId: string): Promise<Result<true>>;
}

/** Production adapter — delegates 1:1 to the app services (single source of truth). */
export class AppServicesCustomerPortal implements CustomerPortalPort {
  async wallet(customerId: string): Promise<Result<Wallet | null>> {
    const r = await walletService.getWallet('customer', customerId);
    return r.error ? err(errors.unavailable('wallet failed')) : ok(r.data);
  }
  async walletTransactions(walletId: string): Promise<Result<WalletTransaction[]>> {
    const r = await walletService.getTransactions(walletId);
    return r.error ? err(errors.unavailable('walletTransactions failed')) : ok(r.data);
  }
  async loyaltyPoints(customerId: string): Promise<Result<number>> {
    const r = await loyaltyService.getPoints(customerId);
    return r.error ? err(errors.unavailable('loyaltyPoints failed')) : ok(r.points);
  }
  async loyaltyHistory(customerId: string): Promise<Result<LoyaltyTransaction[]>> {
    const r = await loyaltyService.getHistory(customerId);
    return r.error ? err(errors.unavailable('loyaltyHistory failed')) : ok(r.data);
  }
  async savedOrders(customerId: string): Promise<Result<Order[]>> {
    const r = await orderService.getCustomerOrders(customerId);
    return r.error ? err(errors.unavailable('savedOrders failed')) : ok(r.data);
  }
  async favoriteProductIds(customerId: string): Promise<Result<string[]>> {
    return ok(await cxService.favoriteProductIds(customerId));
  }
  async notifications(customerId: string): Promise<Result<Notification[]>> {
    const r = await notificationService.getUserNotifications(customerId);
    return r.error ? err(errors.unavailable('notifications failed')) : ok(r.data);
  }
  async unreadCount(customerId: string): Promise<Result<number>> {
    const r = await notificationService.getUnreadCount(customerId);
    return r.error ? err(errors.unavailable('unreadCount failed')) : ok(r.count);
  }
  async markNotificationRead(notificationId: string): Promise<Result<true>> {
    const r = await notificationService.markRead(notificationId);
    return r.error ? err(errors.unavailable('markRead failed')) : ok(true);
  }
  async markAllNotificationsRead(customerId: string): Promise<Result<true>> {
    const r = await notificationService.markAllRead(customerId);
    return r.error ? err(errors.unavailable('markAllRead failed')) : ok(true);
  }
}

export function createCustomerPortal(): CustomerPortalPort {
  return new AppServicesCustomerPortal();
}
