// ─────────────────────────────────────────────────────────────────────────────
// Website Platform · Website ordering (Wave 2).
// Ordering from the website reuses the SAME backend as the mobile app — no duplicated
// business logic. This is a thin adapter over the existing app services
// (product/cart/order); the website UI (a later wave) consumes this port. A fake
// implementation supports tests. Reusable by every white-label tenant.
// ─────────────────────────────────────────────────────────────────────────────

import type { Result } from '../shared/types';
import { ok, err } from '../shared/types';
import { errors } from '../shared/errors';
import { productService } from '../../services/product.service';
import { cartService } from '../../services/cart.service';
import { orderService } from '../../services/order.service';
import type { Product, ProductVariant, Category, Order } from '../../services/types';
import type { CartState } from '../../services/cart.service';

export interface CheckoutInput {
  customerId: string;
  branchId: string;
  totalAmount: number;
  items: Array<{ variantId: string; quantity: number; price: number }>;
  location?: {
    addressId?: string | null; deliveryLat?: number | null; deliveryLng?: number | null;
    branchLatSnapshot?: number | null; branchLngSnapshot?: number | null; deliveryFee?: number | null;
  };
  idempotencyKey?: string;
}

/** The capabilities the website ordering UI needs. All logic lives in the app services. */
export interface WebsiteOrderingPort {
  getCategories(): Promise<Result<Category[]>>;
  browse(branchId: string): Promise<Result<Product[]>>;
  search(branchId: string, query: string): Promise<Result<Product[]>>;
  productDetails(productId: string): Promise<Result<Product | null>>;
  // cart (sync, client-side — same store the app uses)
  getCart(): CartState;
  addToCart(product: Product, variant: ProductVariant | null, quantity?: number): CartState;
  updateQuantity(itemId: string, quantity: number): CartState;
  removeFromCart(itemId: string): CartState;
  calculateTotal(): { subtotal: number; discount: number; total: number };
  // order lifecycle
  checkout(input: CheckoutInput): Promise<Result<Order>>;
  trackOrder(orderId: string): Promise<Result<Order | null>>;
  myOrders(customerId: string): Promise<Result<Order[]>>;
}

/** Production adapter — delegates 1:1 to the app services (single source of truth). */
export class AppServicesOrdering implements WebsiteOrderingPort {
  async getCategories(): Promise<Result<Category[]>> {
    const r = await productService.getCategories();
    return r.error ? err(errors.unavailable('getCategories failed')) : ok(r.data);
  }
  async browse(branchId: string): Promise<Result<Product[]>> {
    const r = await productService.getProductsByBranch(branchId);
    return r.error ? err(errors.unavailable('browse failed')) : ok(r.data);
  }
  async search(branchId: string, query: string): Promise<Result<Product[]>> {
    const r = await productService.getProductsByBranch(branchId);
    if (r.error) return err(errors.unavailable('search failed'));
    const q = query.trim().toLowerCase();
    return ok(q ? r.data.filter(p => p.name.toLowerCase().includes(q)) : r.data);
  }
  async productDetails(productId: string): Promise<Result<Product | null>> {
    const r = await productService.getProductDetails(productId);
    return r.error ? err(errors.notFound('Product', productId)) : ok(r.data);
  }
  getCart(): CartState { return cartService.getCart(); }
  addToCart(product: Product, variant: ProductVariant | null, quantity = 1): CartState { return cartService.addToCart(product, variant, quantity); }
  updateQuantity(itemId: string, quantity: number): CartState { return cartService.updateQuantity(itemId, quantity); }
  removeFromCart(itemId: string): CartState { return cartService.removeFromCart(itemId); }
  calculateTotal(): { subtotal: number; discount: number; total: number } { return cartService.calculateTotal(); }

  async checkout(input: CheckoutInput): Promise<Result<Order>> {
    const r = await orderService.createOrder(input.customerId, input.branchId, input.totalAmount, input.items, input.location, input.idempotencyKey);
    if (r.error || !r.data) return err(errors.conflict('checkout failed'));
    return ok(r.data);
  }
  async trackOrder(orderId: string): Promise<Result<Order | null>> {
    const r = await orderService.getOrderDetails(orderId);
    return r.error ? err(errors.notFound('Order', orderId)) : ok(r.data);
  }
  async myOrders(customerId: string): Promise<Result<Order[]>> {
    const r = await orderService.getCustomerOrders(customerId);
    return r.error ? err(errors.unavailable('myOrders failed')) : ok(r.data);
  }
}

export function createWebsiteOrdering(): WebsiteOrderingPort {
  return new AppServicesOrdering();
}
