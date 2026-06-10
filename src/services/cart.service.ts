import { supabase } from '../lib/supabase';
import { Product, ProductVariant } from './types';

export interface CartItem {
  id: string; // Composite unique key e.g. `${productId}_${variantId || 'none'}`
  product: Product;
  variant: ProductVariant | null;
  quantity: number;
}

export interface CartState {
  items: CartItem[];
  appliedCoupon: { code: string; discountPercent: number } | null;
  branchId: string | null;
}

// Durable cloud CRM or localStorage shopping cart manager with remote synchronization
export const cartService = {
  getCart(): CartState {
    const raw = localStorage.getItem('haat_cart');
    if (!raw) return { items: [], appliedCoupon: null, branchId: null };
    try {
      return JSON.parse(raw);
    } catch {
      return { items: [], appliedCoupon: null, branchId: null };
    }
  },

  saveCart(cart: CartState): void {
    localStorage.setItem('haat_cart', JSON.stringify(cart));
  },

  addToCart(product: Product, variant: ProductVariant | null, quantity = 1): CartState {
    const cart = this.getCart();

    // Prevent adding products from different branches to the same cart
    if (cart.branchId && cart.branchId !== product.branch_id) {
      throw new Error('لا يمكنك إضافة منتجات من فروع/متاجر مختلفة في نفس الطلب.');
    }

    const itemId = `${product.id}_${variant ? variant.id : 'none'}`;
    const existingIndex = cart.items.findIndex(item => item.id === itemId);

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        id: itemId,
        product,
        variant,
        quantity,
      });
    }

    cart.branchId = product.branch_id;
    this.saveCart(cart);
    return cart;
  },

  updateQuantity(itemId: string, quantity: number): CartState {
    const cart = this.getCart();
    const index = cart.items.findIndex(item => item.id === itemId);

    if (index > -1) {
      if (quantity <= 0) {
        cart.items.splice(index, 1);
      } else {
        cart.items[index].quantity = quantity;
      }
    }

    if (cart.items.length === 0) {
      cart.branchId = null;
      cart.appliedCoupon = null;
    }

    this.saveCart(cart);
    return cart;
  },

  removeFromCart(itemId: string): CartState {
    return this.updateQuantity(itemId, 0);
  },

  clearCart(): void {
    localStorage.removeItem('haat_cart');
  },

  applyCoupon(code: string, discountPercent: number): CartState {
    const cart = this.getCart();
    cart.appliedCoupon = { code, discountPercent };
    this.saveCart(cart);
    return cart;
  },

  removeCoupon(): CartState {
    const cart = this.getCart();
    cart.appliedCoupon = null;
    this.saveCart(cart);
    return cart;
  },

  calculateTotal(): { subtotal: number; discount: number; total: number } {
    const cart = this.getCart();
    let subtotal = 0;

    for (const item of cart.items) {
      const basePrice = Number(item.product.price);
      const modifier = item.variant ? Number(item.variant.price_modifier) : 0;
      subtotal += (basePrice + modifier) * item.quantity;
    }

    let discount = 0;
    if (cart.appliedCoupon) {
      discount = subtotal * (cart.appliedCoupon.discountPercent / 100);
    }

    const total = subtotal - discount;

    return {
      subtotal,
      discount,
      total,
    };
  },

  // Remote persistent operations for synchronization (Priority 1)
  async fetchRemoteCart(customerId: string): Promise<CartState> {
    try {
      const { data: cartData, error: cartError } = await supabase
        .from('customer_carts')
        .select('*')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (cartError) {
        console.error('Error fetching remote cart:', cartError);
        return { items: [], appliedCoupon: null, branchId: null };
      }

      if (!cartData) {
        return { items: [], appliedCoupon: null, branchId: null };
      }

      const { data: itemsData, error: itemsError } = await supabase
        .from('cart_items')
        .select(`
          id,
          quantity,
          product_id,
          variant_id,
          products:product_id(*),
          product_variants:variant_id(*)
        `)
        .eq('cart_id', cartData.id);

      if (itemsError) {
        console.error('Error fetching remote cart items:', itemsError);
        return { items: [], appliedCoupon: null, branchId: null };
      }

      const items: CartItem[] = (itemsData || []).map((item: any) => ({
        id: `${item.product_id}_${item.variant_id || 'none'}`,
        product: item.products,
        variant: item.product_variants || null,
        quantity: item.quantity,
      }));

      return {
        items,
        appliedCoupon: cartData.applied_coupon,
        branchId: cartData.branch_id,
      };
    } catch (e) {
      console.error('fetchRemoteCart failed:', e);
      return { items: [], appliedCoupon: null, branchId: null };
    }
  },

  async syncLocalCartToRemote(
    customerId: string,
    items: CartItem[],
    branchId: string | null,
    appliedCoupon: { code: string; discountPercent: number } | null
  ): Promise<void> {
    try {
      if (!customerId) return;

      // 1. Get or create cart ID
      let { data: cartData, error: cartError } = await supabase
        .from('customer_carts')
        .select('id')
        .eq('customer_id', customerId)
        .maybeSingle();

      if (cartError) throw cartError;

      if (!cartData) {
        const { data: newCart, error: createError } = await supabase
          .from('customer_carts')
          .insert({
            customer_id: customerId,
            branch_id: branchId,
            applied_coupon: appliedCoupon,
          })
          .select('id')
          .single();

        if (createError) throw createError;
        cartData = newCart;
      } else {
        const { error: updateError } = await supabase
          .from('customer_carts')
          .update({
            branch_id: branchId,
            applied_coupon: appliedCoupon,
            updated_at: new Date().toISOString()
          })
          .eq('id', cartData.id);

        if (updateError) throw updateError;
      }

      const cartId = cartData.id;

      // 2. Delete existing items to sync afresh
      const { error: deleteError } = await supabase
        .from('cart_items')
        .delete()
        .eq('cart_id', cartId);

      if (deleteError) throw deleteError;

      // 3. Insert active list items
      if (items.length > 0) {
        const rowsToInsert = items.map(item => ({
          cart_id: cartId,
          product_id: item.product.id,
          variant_id: item.variant ? item.variant.id : null,
          quantity: item.quantity
        }));

        const { error: insertError } = await supabase
          .from('cart_items')
          .insert(rowsToInsert);

        if (insertError) throw insertError;
      }
    } catch (e) {
      console.error('syncLocalCartToRemote failed:', e);
    }
  }
};
