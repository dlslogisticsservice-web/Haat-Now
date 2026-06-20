-- 0013_coupon_lifecycle.sql
-- Add lifecycle columns to coupons: is_active, start_date, end_date
-- Idempotent: uses ADD COLUMN IF NOT EXISTS

alter table coupons
  add column if not exists is_active  boolean     not null default true,
  add column if not exists start_date timestamptz null,
  add column if not exists end_date   timestamptz null;
