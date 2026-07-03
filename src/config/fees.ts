// Canonical fee constants — single source of truth for default/fallback fee values.
// Extracted from literals previously hardcoded across checkout, merchant earnings, and the
// sandbox store. Value is unchanged (10) — this only removes the duplicated magic number.
// The authoritative per-order fee is always the order's `delivery_fee` field; this constant
// is the default/fallback used when no configured fee is present.
export const DEFAULT_DELIVERY_FEE = 10;
