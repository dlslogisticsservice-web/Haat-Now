-- 0004_security_hardening.sql
-- Enable Row Level Security (RLS) on all remaining sensitive tables

-- =====================================================================
-- 1. Orders
-- =====================================================================
alter table orders enable row level security;

-- Customers can only access their own orders
create policy "Customers can manage own orders" on orders
  for all using (customer_id = auth.uid());

-- Drivers can only access assigned deliveries
create policy "Drivers can manage assigned deliveries" on orders
  for all using (driver_id = auth.uid());

-- Merchants can only access orders for their own branches
create policy "Merchants can manage branch orders" on orders
  for all using (
    branch_id in (
      select id from merchant_branches where merchant_id = auth.uid()
    )
  );


-- =====================================================================
-- 2. Order Items
-- =====================================================================
alter table order_items enable row level security;

-- Users can access order items of orders they are allowed to access
create policy "Users can access items of accessible orders" on order_items
  for all using (
    order_id in (
      select id from orders
    )
  );


-- =====================================================================
-- 3. Driver Locations
-- =====================================================================
alter table driver_locations enable row level security;

-- Drivers can manage their own locations
create policy "Drivers can manage own location" on driver_locations
  for all using (driver_id = auth.uid());

-- Customers and Merchants can view location of drivers assigned to their orders
create policy "Authorized users can view driver locations" on driver_locations
  for select using (
    driver_id in (
      select driver_id from orders
    )
  );


-- =====================================================================
-- 4. Wallets
-- =====================================================================
alter table wallets enable row level security;

-- Users (customers, drivers, merchants) can only access their own wallets
create policy "Users can access own wallets" on wallets
  for all using (owner_id = auth.uid());


-- =====================================================================
-- 5. Wallet Transactions
-- =====================================================================
alter table wallet_transactions enable row level security;

-- Users can only access wallet transactions for their own wallets
create policy "Users can access own wallet transactions" on wallet_transactions
  for all using (
    wallet_id in (
      select id from wallets where owner_id = auth.uid()
    )
  );


-- =====================================================================
-- 6. Notifications
-- =====================================================================
alter table notifications enable row level security;

-- Customers can only access their own notifications
create policy "Users can access own notifications" on notifications
  for all using (target_user_id = auth.uid());


-- =====================================================================
-- 7. Reviews
-- =====================================================================
alter table reviews enable row level security;

-- Customers can manage their own reviews
create policy "Customers can manage own reviews" on reviews
  for all using (customer_id = auth.uid());

-- Reviews are public for viewing
create policy "Anyone can see reviews" on reviews
  for select using (true);


-- =====================================================================
-- 8. Favorites
-- =====================================================================
alter table favorites enable row level security;

-- Customers can only access their own favorites list
create policy "Users can manage own favorites" on favorites
  for all using (customer_id = auth.uid());


-- =====================================================================
-- 9. Subscriptions
-- =====================================================================
alter table subscriptions enable row level security;

-- Customers can only access their own subscriptions
create policy "Customers can manage own subscriptions" on subscriptions
  for all using (customer_id = auth.uid());


-- =====================================================================
-- 10. Coupons
-- =====================================================================
alter table coupons enable row level security;

-- Anyone can see coupons (public directory catalog)
create policy "Anyone can select coupons" on coupons
  for select using (true);


-- =====================================================================
-- 11. Coupon Usages
-- =====================================================================
alter table coupon_usages enable row level security;

-- Users can access coupon usages of orders they can access
create policy "Users can access coupon usages for their orders" on coupon_usages
  for all using (
    order_id in (
      select id from orders
    )
  );


-- =====================================================================
-- 12. Additional Security Hardening (Merchant Branches & Drivers profiling)
-- =====================================================================
alter table merchant_branches enable row level security;

create policy "Merchants can manage own branches" on merchant_branches
  for all using (merchant_id = auth.uid());

create policy "Anyone can view merchant branches" on merchant_branches
  for select using (true);


alter table drivers enable row level security;

create policy "Drivers can manage own profile" on drivers
  for all using (id = auth.uid());

create policy "Anyone can select drivers" on drivers
  for select using (true);


alter table merchants enable row level security;

create policy "Merchants can manage own profile" on merchants
  for all using (id = auth.uid());

create policy "Anyone can select merchants" on merchants
  for select using (true);
