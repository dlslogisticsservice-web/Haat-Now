import { merchantRepository } from '../repositories/merchant.repository';
import { Order, Product, MerchantBranch, ProductImage } from './types';

export const merchantService = {
  // Query all order files dispatched to a particular branch ID
  async getBranchOrders(branchId: string): Promise<{ data: Order[]; error: any }> {
    const { data, error } = await merchantRepository.getBranchOrders(branchId);
    return { data: data || [], error };
  },

  // Modify merchant branch service settings (name and/or cover image)
  async updateBranchInfo(
    branchId: string,
    payload: Partial<Pick<MerchantBranch, 'name' | 'cover_image_url' | 'is_active'>>,
  ): Promise<{ error: any }> {
    const { error } = await merchantRepository.updateBranchInfo(branchId, payload);
    return { error };
  },

  // Update merchant brand logo URL (call after storageService.uploadMerchantLogo)
  async updateMerchantLogo(merchantId: string, logoUrl: string): Promise<{ error: any }> {
    const { error } = await merchantRepository.updateMerchantLogo(merchantId, logoUrl);
    return { error };
  },

  // Link a storage URL to a product by inserting into product_images
  // Call after storageService.uploadProductImage returns a url
  async addProductImage(productId: string, url: string): Promise<{ data: ProductImage | null; error: any }> {
    const { data, error } = await merchantRepository.addProductImage(productId, url);
    return { data, error };
  },

  // Remove a product image record (does not delete the file from storage)
  async deleteProductImage(imageId: string): Promise<{ error: any }> {
    const { error } = await merchantRepository.deleteProductImage(imageId);
    return { error };
  },

  // Insert or update restaurant menu product
  async upsertProduct(product: Partial<Product> & { name: string; price: number; branch_id: string }): Promise<{ data: Product | null; error: any }> {
    const { data, error } = await merchantRepository.upsertProduct(product);
    return { data, error };
  },

  // Delete product from store catalog
  async deleteProduct(productId: string): Promise<{ error: any }> {
    const { error } = await merchantRepository.deleteProduct(productId);
    return { error };
  }
};
