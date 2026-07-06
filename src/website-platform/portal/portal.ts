// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Customer Portal (Wave 3 → completed Wave 4, Part 7).
// A COMPLETE facade over the SAME app services the mobile app uses — no duplicated
// logic. Covers orders, wallet, loyalty, notifications, addresses, payment methods,
// invoices/downloads, support, refunds and favorites. Reusable by every tenant.
// (Adapter is browser-side; tested via a fake port + a pure invoice generator.)
// ─────────────────────────────────────────────────────────────────────────────

import type { Result } from '../shared/types';
import { ok, err } from '../shared/types';
import { errors } from '../shared/errors';
import { walletService } from '../../services/wallet.service';
import { loyaltyService } from '../../services/loyalty.service';
import { orderService } from '../../services/order.service';
import { notificationService } from '../../services/notification.service';
import { cxService } from '../../services/cx.service';
import { customerService } from '../../services/customer.service';
import { checkoutService } from '../../services/checkout.service';
import { buildInvoice, renderInvoiceHtml, type Invoice, type InvoiceOrder, type InvoiceBrand } from '../invoices/invoice';

// Types derived from the app services (single source of truth; no fragile imports).
type Wallet = NonNullable<Awaited<ReturnType<typeof walletService.getWallet>>['data']>;
type WalletTx = Awaited<ReturnType<typeof walletService.getTransactions>>['data'][number];
type LoyaltyTx = Awaited<ReturnType<typeof loyaltyService.getHistory>>['data'][number];
type Order = Awaited<ReturnType<typeof orderService.getCustomerOrders>>['data'][number];
type Notif = Awaited<ReturnType<typeof notificationService.getUserNotifications>>['data'][number];
type Profile = NonNullable<Awaited<ReturnType<typeof customerService.getProfile>>['data']>;
type Address = Awaited<ReturnType<typeof customerService.getAddresses>>['data'][number];
type PaymentMethod = Awaited<ReturnType<typeof checkoutService.getPaymentMethods>>['data'][number];

/** Normalized support/refund ticket for the portal (mapped from the CX service rows). */
export interface PortalTicket { id: string; subject: string; type: string; status: string; createdAt: string }

function toTicket(row: Record<string, unknown>): PortalTicket {
  return { id: String(row.id ?? ''), subject: String(row.subject ?? ''), type: String(row.type ?? ''), status: String(row.status ?? ''), createdAt: String(row.created_at ?? '') };
}

export interface CustomerPortalPort {
  // Account
  profile(customerId: string): Promise<Result<Profile | null>>;
  // Addresses
  addresses(customerId: string): Promise<Result<Address[]>>;
  setDefaultAddress(customerId: string, addressId: string): Promise<Result<true>>;
  // Wallet
  wallet(customerId: string): Promise<Result<Wallet | null>>;
  walletTransactions(walletId: string): Promise<Result<WalletTx[]>>;
  // Loyalty / rewards
  loyaltyPoints(customerId: string): Promise<Result<number>>;
  loyaltyHistory(customerId: string): Promise<Result<LoyaltyTx[]>>;
  // Orders + favorites
  savedOrders(customerId: string): Promise<Result<Order[]>>;
  favoriteProductIds(customerId: string): Promise<Result<string[]>>;
  // Payment methods
  paymentMethods(customerId: string): Promise<Result<PaymentMethod[]>>;
  // Notifications
  notifications(customerId: string): Promise<Result<Notif[]>>;
  unreadCount(customerId: string): Promise<Result<number>>;
  markNotificationRead(notificationId: string): Promise<Result<true>>;
  markAllNotificationsRead(customerId: string): Promise<Result<true>>;
  // Support + refunds
  supportTickets(customerId: string): Promise<Result<PortalTicket[]>>;
  openSupportTicket(subject: string, message: string, orderId?: string): Promise<Result<true>>;
  requestRefund(orderId: string, reason: string): Promise<Result<true>>;
  refundRequests(customerId: string): Promise<Result<PortalTicket[]>>;
  // Invoices / downloads (pure generation from an order)
  invoice(order: InvoiceOrder, brand: InvoiceBrand): Invoice;
  invoiceHtml(order: InvoiceOrder, brand: InvoiceBrand): string;
}

/** Production adapter — delegates 1:1 to the app services. */
export class AppServicesCustomerPortal implements CustomerPortalPort {
  async profile(customerId: string): Promise<Result<Profile | null>> {
    const r = await customerService.getProfile(customerId);
    return r.error ? err(errors.unavailable('profile failed')) : ok(r.data);
  }
  async addresses(customerId: string): Promise<Result<Address[]>> {
    const r = await customerService.getAddresses(customerId);
    return r.error ? err(errors.unavailable('addresses failed')) : ok(r.data);
  }
  async setDefaultAddress(customerId: string, addressId: string): Promise<Result<true>> {
    const r = await customerService.setDefaultAddress(customerId, addressId);
    return r.error ? err(errors.unavailable('setDefaultAddress failed')) : ok(true);
  }
  async wallet(customerId: string): Promise<Result<Wallet | null>> {
    const r = await walletService.getWallet('customer', customerId);
    return r.error ? err(errors.unavailable('wallet failed')) : ok(r.data);
  }
  async walletTransactions(walletId: string): Promise<Result<WalletTx[]>> {
    const r = await walletService.getTransactions(walletId);
    return r.error ? err(errors.unavailable('walletTransactions failed')) : ok(r.data);
  }
  async loyaltyPoints(customerId: string): Promise<Result<number>> {
    const r = await loyaltyService.getPoints(customerId);
    return r.error ? err(errors.unavailable('loyaltyPoints failed')) : ok(r.points);
  }
  async loyaltyHistory(customerId: string): Promise<Result<LoyaltyTx[]>> {
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
  async paymentMethods(customerId: string): Promise<Result<PaymentMethod[]>> {
    const r = await checkoutService.getPaymentMethods(customerId);
    return r.error ? err(errors.unavailable('paymentMethods failed')) : ok(r.data);
  }
  async notifications(customerId: string): Promise<Result<Notif[]>> {
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
  async supportTickets(customerId: string): Promise<Result<PortalTicket[]>> {
    const r = await cxService.myTickets(customerId);
    return r.error ? err(errors.unavailable('supportTickets failed')) : ok((r.data as Array<Record<string, unknown>>).map(toTicket));
  }
  async openSupportTicket(subject: string, message: string, orderId?: string): Promise<Result<true>> {
    const r = await cxService.createTicket(subject, 'general', message, orderId);
    return r.error ? err(errors.unavailable('openSupportTicket failed')) : ok(true);
  }
  async requestRefund(orderId: string, reason: string): Promise<Result<true>> {
    const r = await cxService.createTicket('Refund request', 'refund', reason, orderId);
    return r.error ? err(errors.unavailable('requestRefund failed')) : ok(true);
  }
  async refundRequests(customerId: string): Promise<Result<PortalTicket[]>> {
    const r = await cxService.myTickets(customerId);
    if (r.error) return err(errors.unavailable('refundRequests failed'));
    return ok((r.data as Array<Record<string, unknown>>).map(toTicket).filter(t => t.type === 'refund'));
  }
  invoice(order: InvoiceOrder, brand: InvoiceBrand): Invoice { return buildInvoice(order, brand); }
  invoiceHtml(order: InvoiceOrder, brand: InvoiceBrand): string { return renderInvoiceHtml(buildInvoice(order, brand), brand); }
}

export function createCustomerPortal(): CustomerPortalPort {
  return new AppServicesCustomerPortal();
}
