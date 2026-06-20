import { supabase } from '../lib/supabase';

export const BUCKETS = {
  PRODUCT_IMAGES: 'product-images',
  MERCHANT_LOGOS: 'merchant-logos',
  BANNERS:        'banners',
  OFFER_IMAGES:   'offer-images',
  AVATARS:        'avatars',
} as const;

type BucketName = typeof BUCKETS[keyof typeof BUCKETS];

function fileExt(file: File): string {
  return file.name.split('.').pop() ?? 'jpg';
}

export const storageService = {
  /**
   * Returns the permanent public CDN URL for a stored file.
   * Synchronous — no network call required (URL is deterministic).
   */
  getPublicUrl(bucket: BucketName, path: string): string {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  /**
   * Uploads a product photo.
   * Path: {productId}/{timestamp}.{ext}
   * Multiple calls produce multiple images (append-only).
   * Insert the returned `url` into product_images(product_id, url) after upload.
   */
  async uploadProductImage(
    productId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${productId}/${Date.now()}.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.PRODUCT_IMAGES)
      .upload(path, file);
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.PRODUCT_IMAGES, path), path, error: null };
  },

  /**
   * Uploads (or replaces) a merchant brand logo.
   * Path: {merchantId}/logo.{ext}
   * upsert:true replaces on re-upload; the public URL is stable.
   * Update merchants.logo_url with the returned `url` after upload.
   */
  async uploadMerchantLogo(
    merchantId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${merchantId}/logo.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.MERCHANT_LOGOS)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.MERCHANT_LOGOS, path), path, error: null };
  },

  /**
   * Uploads (or replaces) a promotional banner image.
   * Path: {bannerId}.{ext}
   * Create the banner DB record first to obtain bannerId, then upload.
   * Update banners.image_url with the returned `url` after upload.
   */
  async uploadBannerImage(
    bannerId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${bannerId}.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.BANNERS)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.BANNERS, path), path, error: null };
  },

  /**
   * Uploads (or replaces) an offer artwork image.
   * Path: {offerId}.{ext}
   * Create the offer DB record first to obtain offerId, then upload.
   * Update offers.image_url with the returned `url` after upload.
   */
  async uploadOfferImage(
    offerId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${offerId}.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.OFFER_IMAGES)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.OFFER_IMAGES, path), path, error: null };
  },

  /**
   * Uploads (or replaces) a branch hero/cover photo.
   * Path: {merchantId}/covers/{branchId}.{ext}
   *   — stored inside the merchant's own folder in merchant-logos so the
   *     storage RLS policy (foldername[1] = auth.uid()::text) passes.
   * upsert:true replaces on re-upload; the public URL is stable.
   * Update merchant_branches.cover_image_url with the returned `url`.
   */
  async uploadBranchCoverImage(
    merchantId: string,
    branchId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${merchantId}/covers/${branchId}.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.MERCHANT_LOGOS)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.MERCHANT_LOGOS, path), path, error: null };
  },

  /**
   * Deletes a file from storage by bucket and path.
   * Call this before removing a product_images row, or when a merchant
   * replaces their logo with a different file extension.
   */
  /**
   * Uploads (or replaces) a customer profile avatar.
   * Path: {customerId}/avatar.{ext}
   *   — stored in its own folder so storage RLS policy
   *     (foldername[1] = auth.uid()::text) passes.
   * upsert:true replaces on re-upload; the public URL is stable.
   * Update customers.avatar_url with the returned `url` after upload.
   */
  async uploadAvatar(
    customerId: string,
    file: File,
  ): Promise<{ url: string | null; path: string | null; error: any }> {
    const path = `${customerId}/avatar.${fileExt(file)}`;
    const { error } = await supabase.storage
      .from(BUCKETS.AVATARS)
      .upload(path, file, { upsert: true });
    if (error) return { url: null, path: null, error };
    return { url: storageService.getPublicUrl(BUCKETS.AVATARS, path), path, error: null };
  },

  async deleteImage(
    bucket: BucketName,
    path: string,
  ): Promise<{ error: any }> {
    const { error } = await supabase.storage.from(bucket).remove([path]);
    return { error };
  },
};
