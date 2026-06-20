// Database types and API payloads for Haat Now Enterprise Platform

// ── Order status machine — single source of truth ──────────────────────────
export const ORDER_STATUSES = {
  PENDING:    'pending',
  ACCEPTED:   'accepted',
  PREPARING:  'preparing',
  ON_THE_WAY: 'on_the_way',
  DELIVERED:  'delivered',
  CANCELLED:  'cancelled',
} as const;

export type OrderStatusValue = typeof ORDER_STATUSES[keyof typeof ORDER_STATUSES];

// Statuses where a driver has an active obligation on the order
export const DRIVER_ACTIVE_STATUSES = [ORDER_STATUSES.PREPARING, ORDER_STATUSES.ON_THE_WAY] as const;
// Statuses visible to the merchant as actionable / in-progress
export const MERCHANT_ACTIVE_STATUSES = [ORDER_STATUSES.PENDING, ORDER_STATUSES.ACCEPTED, ORDER_STATUSES.PREPARING, ORDER_STATUSES.ON_THE_WAY] as const;
// Terminal statuses — order is no longer actionable
export const ARCHIVED_STATUSES = [ORDER_STATUSES.DELIVERED, ORDER_STATUSES.CANCELLED] as const;

export interface Country {
  id: string;
  name: string;
  code: string;
}

export interface City {
  id: string;
  country_id: string;
  name: string;
}

export interface Zone {
  id: string;
  city_id: string;
  name: string;
}

export interface Customer {
  id: string;
  phone_number: string;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
}

export interface Address {
  id: string;
  customer_id: string;
  zone_id: string;
  address_line: string;
  label: string;
  is_default?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Merchant {
  id: string;
  business_name: string;
  logo_url?: string | null;
}

export interface MerchantBranch {
  id: string;
  merchant_id: string;
  zone_id: string;
  name: string;
  cover_image_url?: string | null;
  is_active?: boolean;
  latitude?: number | null;
  longitude?: number | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface Product {
  id: string;
  branch_id: string;
  category_id: string;
  name: string;
  price: number;
  description?: string | null;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price_modifier: number;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
}

export interface Driver {
  id: string;
  phone_number: string;
  full_name: string | null;
  zone_id: string;
  is_online: boolean;
}

export interface DriverLocation {
  id: string;
  driver_id: string;
  coords: { x: number; y: number } | string;
  recorded_at?: string | null;
}

export interface Order {
  id: string;
  customer_id: string;
  branch_id: string;
  driver_id: string | null;
  status: OrderStatusValue;
  total_amount: number;
  delivery_fee?: number;
  payment_status?: 'unpaid' | 'paid' | 'refunded' | 'partially_refunded';
  created_at?: string;
  // Location fields added in 0005_location_foundation
  address_id?: string | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
  branch_lat_snapshot?: number | null;
  branch_lng_snapshot?: number | null;
}

export interface PaymentAttempt {
  id: string;
  order_id: string;
  customer_id: string | null;
  provider: string;
  amount: number;
  currency: string;
  status: 'pending' | 'captured' | 'failed' | 'cancelled';
  idempotency_key: string;
  gateway_reference: string | null;
  raw_response?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export interface Refund {
  id: string;
  order_id: string | null;
  payment_attempt_id: string | null;
  amount: number;
  currency: string;
  reason: string | null;
  status: 'pending' | 'refunded' | 'failed';
  gateway_refund_ref: string | null;
  initiated_by: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface WebhookEvent {
  id: string;
  provider: string;
  event_type: string;
  idempotency_key: string;
  payload: Record<string, any>;
  processed: boolean;
  processed_at: string | null;
  error: string | null;
  received_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string;
  quantity: number;
  price: number;
}

export interface Wallet {
  id: string;
  owner_type: 'customer' | 'driver' | 'merchant';
  owner_id: string;
  balance: number;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  amount: number;
  type: 'deposit' | 'withdrawal' | 'payment_refund' | 'payout';
  created_at?: string;
}

export interface Membership {
  id: string;
  name: string;
}

export interface Subscription {
  id: string;
  customer_id: string;
  membership_id: string;
  expires_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface CouponUsage {
  id: string;
  coupon_id: string;
  order_id: string;
}

export interface Favorite {
  id: string;
  customer_id: string;
  product_id: string;
}

export interface Notification {
  id: string;
  target_user_id: string | null;
  message: string;
  type: string;
  created_at?: string;
}

export interface Review {
  id: string;
  order_id: string;
  customer_id: string;
  rating: number;
  comment: string | null;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
}

export interface Permission {
  id: string;
  name: string;
  description: string | null;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
}

export interface PaymentMethod {
  id: string;
  customer_id: string;
  provider: string;
  provider_payment_method_id: string | null;
  is_default: boolean;
}

export interface PaymentTransaction {
  id: string;
  order_id: string;
  payment_method_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  gateway_reference: string | null;
}

export interface DriverEarning {
  id: string;
  driver_id: string;
  order_id: string;
  delivery_fee_earned: number;
  tip_earned: number;
  bonus_earned: number;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;
  status: string;
  notes: string | null;
  created_at?: string;
}

export interface SupportTicket {
  id: string;
  customer_id: string;
  subject: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: 'customer' | 'admin' | 'system';
  sender_id: string;
  message_text: string;
}

export interface Offer {
  id: string;
  title: string;
  description: string | null;
  discount_percent: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  image_url?: string | null;
}

export interface Banner {
  id: string;
  title: string | null;
  image_url: string;
  link_url: string | null;
  display_order: number;
  is_active: boolean;
}

export interface PushToken {
  id: string;
  user_type: 'customer' | 'driver' | 'merchant';
  user_id: string;
  token: string;
  device_type: string | null;
}

export interface AppConfig {
  key: string;
  value: any;
  description: string | null;
}
