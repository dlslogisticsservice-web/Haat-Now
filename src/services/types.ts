// Database types and API payloads for Haat Now Enterprise Platform

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
}

export interface Address {
  id: string;
  customer_id: string;
  zone_id: string;
  address_line: string;
  label: string;
}

export interface Merchant {
  id: string;
  business_name: string;
}

export interface MerchantBranch {
  id: string;
  merchant_id: string;
  zone_id: string;
  name: string;
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
}

export interface Order {
  id: string;
  customer_id: string;
  branch_id: string;
  driver_id: string | null;
  status: 'pending' | 'accepted' | 'preparing' | 'on_the_way' | 'delivered' | 'cancelled';
  total_amount: number;
  created_at?: string;
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
