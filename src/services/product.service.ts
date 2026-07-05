import { productRepository } from '../repositories/product.repository';
import { Product, Category, Favorite, Review } from './types';

export const productService = {
  // Retrieve global menu categories
  async getCategories(): Promise<{ data: Category[]; error: any }> {
    const { data, error } = await productRepository.getCategories();
    return { data: data || [], error };
  },

  // Fetch full category products catalog for a specific merchant branch
  async getProductsByBranch(branchId: string): Promise<{ data: Product[]; error: any }> {
    const { data, error } = await productRepository.getProductsByBranch(branchId);
    return { data: data || [], error };
  },

  // Retrieve single product details including descriptions, pictures, and variants
  async getProductDetails(productId: string): Promise<{ data: Product | null; error: any }> {
    const { data, error } = await productRepository.getProductDetails(productId);
    return { data, error };
  },

  // Bookmark a product as favorite for a user
  async toggleFavorite(customerId: string, productId: string): Promise<{ status: 'added' | 'removed'; error: any }> {
    const { data: existing } = await productRepository.findFavorite(customerId, productId);

    if (existing) {
      const { error } = await productRepository.deleteFavorite(existing.id);
      return { status: 'removed', error };
    } else {
      const { error } = await productRepository.insertFavorite(customerId, productId);
      return { status: 'added', error };
    }
  },

  // Fetch all user favorite products
  async getFavorites(customerId: string): Promise<{ data: Favorite[]; error: any }> {
    const { data, error } = await productRepository.getFavorites(customerId);
    return { data: data || [], error };
  },

  // Fetch reviews for an order or customer
  async getReviews(orderId: string): Promise<{ data: Review[]; error: any }> {
    const { data, error } = await productRepository.getReviews(orderId);
    return { data: data || [], error };
  },

  // Submit deep review rating score for an completed order delivery session
  async submitReview(review: Omit<Review, 'id'>): Promise<{ data: Review | null; error: any }> {
    const { data, error } = await productRepository.insertReview(review);
    return { data, error };
  }
};
