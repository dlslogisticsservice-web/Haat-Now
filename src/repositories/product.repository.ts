import { supabase } from '../lib/supabase';
import { Review } from '../services/types';

// ─────────────────────────────────────────────────────────────────────────────
// product.repository (Phase-2 service→repository migration).
// Supabase data access for categories, products, favorites and reviews. No business
// logic — the favorite toggle (select → delete/insert) stays in product.service.
// ─────────────────────────────────────────────────────────────────────────────

const PRODUCT_SELECT = `
        *,
        product_variants(*),
        product_images(*)
      `;

export const productRepository = {
  getCategories() {
    return supabase.from('categories').select('*');
  },

  getProductsByBranch(branchId: string) {
    return supabase.from('products').select(PRODUCT_SELECT).eq('branch_id', branchId);
  },

  getProductDetails(productId: string) {
    return supabase.from('products').select(PRODUCT_SELECT).eq('id', productId).single();
  },

  findFavorite(customerId: string, productId: string) {
    return supabase.from('favorites').select('*').eq('customer_id', customerId).eq('product_id', productId).single();
  },

  deleteFavorite(id: string) {
    return supabase.from('favorites').delete().eq('id', id);
  },

  insertFavorite(customerId: string, productId: string) {
    return supabase.from('favorites').insert({ customer_id: customerId, product_id: productId });
  },

  getFavorites(customerId: string) {
    return supabase.from('favorites').select('*, products(*)').eq('customer_id', customerId);
  },

  getReviews(orderId: string) {
    return supabase.from('reviews').select('*').eq('order_id', orderId);
  },

  insertReview(review: Omit<Review, 'id'>) {
    return supabase.from('reviews').insert(review).select().single();
  },
};
