import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// Repository layer (Phase-2 architecture stabilization).
//
// Repositories are the ONLY place allowed to touch Supabase directly. They expose
// thin, typed data-access methods and contain NO business logic — services compose
// and interpret their results. This enforces the target boundary:
//   UI → Hooks → Services → Repositories → Supabase
//
// catalog.repository — read access to the public marketplace catalog (branches, offers).
// ─────────────────────────────────────────────────────────────────────────────

const BRANCH_SELECT =
  'id,name,merchant_id,zone_id,is_active,merchants(business_name,logo_url),zones(name)';

export const catalogRepository = {
  /** All merchant branches with their merchant + zone (marketplace listing). */
  listBranches() {
    return supabase.from('merchant_branches').select(BRANCH_SELECT);
  },

  /** Currently-active promotional offers (within their start/end window). */
  listActiveOffers(nowIso: string) {
    return supabase
      .from('offers')
      .select('id,title,description,discount_percent')
      .eq('is_active', true)
      .lte('start_date', nowIso)
      .gte('end_date', nowIso);
  },

  /** A branch's menu for the customer restaurant screen (products + images + variants). */
  listBranchMenu(branchId: string) {
    return supabase
      .from('products')
      .select('id,name,description,price,product_images(url),product_variants(id,name,price_modifier)')
      .eq('branch_id', branchId);
  },

  /** A branch's products for the merchant portal (full row + images). */
  listBranchProducts(branchId: string) {
    return supabase.from('products').select('*, product_images(*)').eq('branch_id', branchId);
  },
};
