import { couponRepository } from '../repositories/coupon.repository';
import { Coupon } from './types';

// Coupon administration — real Supabase counterpart of sandboxStore coupons.
// Backed by migration 0020 (coupons extra columns + validate_coupon RPC).
export const couponService = {
  async listCoupons(): Promise<{ data: Coupon[]; error: any }> {
    const { data, error } = await couponRepository.list();
    return { data: (data as Coupon[]) || [], error };
  },

  async createCoupon(c: {
    code: string; discount_percent: number; max_uses: number;
    expires_at: string | null; country_code: string | null; is_active?: boolean;
  }): Promise<{ data: Coupon | null; error: any }> {
    const { data, error } = await couponRepository.insert({ ...c, code: c.code.toUpperCase(), is_active: c.is_active ?? true, used_count: 0 });
    return { data: (data as Coupon) ?? null, error };
  },

  async updateCoupon(id: string, patch: Partial<Coupon>): Promise<{ error: any }> {
    const { error } = await couponRepository.update(id, patch);
    return { error };
  },

  async deactivateCoupon(id: string): Promise<{ error: any }> {
    return this.updateCoupon(id, { is_active: false });
  },

  // Server-side validation (active / expiry / usage limit / country) via RPC.
  async validateCoupon(code: string, country?: string): Promise<{ data: Coupon | null; error: any }> {
    const { data, error } = await couponRepository.validate(code, country ?? null);
    return { data: (data as Coupon) ?? null, error };
  },
};
