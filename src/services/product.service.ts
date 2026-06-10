import { supabase } from '../lib/supabase';
import { Product, Category, ProductVariant, Favorite, Review } from './types';

export const productService = {
  // Retrieve global menu categories
  async getCategories(): Promise<{ data: Category[]; error: any }> {
    const { data, error } = await supabase
      .from('categories')
      .select('*');
    return { data: data || [], error };
  },

  // Fetch full category products catalog for a specific merchant branch
  async getProductsByBranch(branchId: string): Promise<{ data: Product[]; error: any }> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants(*),
        product_images(*)
      `)
      .eq('branch_id', branchId);
    return { data: data || [], error };
  },

  // Retrieve single product details including descriptions, pictures, and variants
  async getProductDetails(productId: string): Promise<{ data: Product | null; error: any }> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        product_variants(*),
        product_images(*)
      `)
      .eq('id', productId)
      .single();
    return { data, error };
  },

  // Bookmark a product as favorite for a user
  async toggleFavorite(customerId: string, productId: string): Promise<{ status: 'added' | 'removed'; error: any }> {
    const { data: existing } = await supabase
      .from('favorites')
      .select('*')
      .eq('customer_id', customerId)
      .eq('product_id', productId)
      .single();

    if (existing) {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id);
      return { status: 'removed', error };
    } else {
      const { error } = await supabase
        .from('favorites')
        .insert({ customer_id: customerId, product_id: productId });
      return { status: 'added', error };
    }
  },

  // Fetch all user favorite products
  async getFavorites(customerId: string): Promise<{ data: Favorite[]; error: any }> {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, products(*)')
      .eq('customer_id', customerId);
    return { data: data || [], error };
  },

  // Fetch reviews for an order or customer
  async getReviews(orderId: string): Promise<{ data: Review[]; error: any }> {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('order_id', orderId);
    return { data: data || [], error };
  },

  // Submit deep review rating score for an completed order delivery session
  async submitReview(review: Omit<Review, 'id'>): Promise<{ data: Review | null; error: any }> {
    const { data, error } = await supabase
      .from('reviews')
      .insert(review)
      .select()
      .single();
    return { data, error };
  }
};
