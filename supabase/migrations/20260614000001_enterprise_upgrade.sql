-- 0001_enterprise_upgrade.sql
-- Upgrade database schema to full custom enterprise level

-- 1. Roles & Permissions Management
create table roles (
  id uuid primary key default gen_random_uuid(),
  name varchar(50) unique not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) unique not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table role_permissions (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (role_id, permission_id)
);

create table user_roles (
  user_id uuid not null, -- References auth.users or our internal user tables
  role_id uuid references roles(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, role_id)
);

-- 2. Admin Users Table
create table admin_users (
  id uuid primary key default gen_random_uuid(),
  email varchar(100) unique not null,
  full_name varchar(100) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Payments Architecture
create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  provider varchar(50) not null, -- 'stripe', 'mada', 'cash', etc.
  provider_payment_method_id varchar(255),
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table payment_transactions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  amount decimal(12, 2) not null,
  currency varchar(10) default 'SAR' not null,
  status varchar(50) default 'pending' not null, -- 'pending', 'succeeded', 'failed', 'refunded'
  gateway_reference varchar(255),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Driver Financials
create table driver_earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references drivers(id) on delete cascade,
  order_id uuid references orders(id) on delete set null,
  delivery_fee_earned decimal(10, 2) not null,
  tip_earned decimal(10, 2) default 0.00 not null,
  bonus_earned decimal(10, 2) default 0.00 not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Logging / Status Auditing
create table order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  status varchar(50) not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Customer Support Engine
create table support_tickets (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references customers(id) on delete cascade,
  subject varchar(200) not null,
  status varchar(50) default 'open' not null, -- 'open', 'in_progress', 'resolved', 'closed'
  priority varchar(50) default 'medium' not null, -- 'low', 'medium', 'high', 'critical'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid references support_tickets(id) on delete cascade,
  sender_type varchar(50) not null, -- 'customer', 'admin', 'system'
  sender_id uuid not null,
  message_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Advertising & Dynamic Offers
create table offers (
  id uuid primary key default gen_random_uuid(),
  title varchar(200) not null,
  description text,
  discount_percent integer CHECK (discount_percent between 1 and 100),
  start_date timestamp with time zone not null,
  end_date timestamp with time zone not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table banners (
  id uuid primary key default gen_random_uuid(),
  title varchar(200),
  image_url text not null,
  link_url text,
  display_order integer default 0 not null,
  is_active boolean default true not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Messaging Integration Setup
create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_type varchar(50) not null, -- 'customer', 'driver', 'merchant'
  user_id uuid not null,
  token text unique not null,
  device_type varchar(50), -- 'ios', 'android', 'web'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. Enterprise Configuration Store
create table app_config (
  key varchar(100) primary key,
  value jsonb not null,
  description text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes for Optimal Query Performance
create index idx_payment_methods_customer on payment_methods(customer_id);
create index idx_payment_transactions_order on payment_transactions(order_id);
create index idx_driver_earnings_driver on driver_earnings(driver_id);
create index idx_order_status_history_order on order_status_history(order_id);
create index idx_support_tickets_customer on support_tickets(customer_id);
create index idx_support_messages_ticket on support_messages(ticket_id);
create index idx_user_roles_user on user_roles(user_id);

-- Row Level Security (RLS) Enablement
alter table roles enable row level security;
alter table permissions enable row level security;
alter table role_permissions enable row level security;
alter table user_roles enable row level security;
alter table admin_users enable row level security;
alter table payment_methods enable row level security;
alter table payment_transactions enable row level security;
alter table driver_earnings enable row level security;
alter table order_status_history enable row level security;
alter table support_tickets enable row level security;
alter table support_messages enable row level security;
alter table offers enable row level security;
alter table banners enable row level security;
alter table push_tokens enable row level security;
alter table app_config enable row level security;

-- =====================================================================
-- Security Policies
-- =====================================================================

-- app_config: public read, authenticated write only
-- SECURITY FIX: original `for all using (true)` granted anonymous write access
create policy "Anyone can read config" on app_config
  for select using (true);
create policy "Authenticated users can write config" on app_config
  for all to authenticated using (true) with check (true);

-- banners / offers: public read (unchanged)
create policy "Customers can see active banners" on banners for select using (is_active = true);
create policy "Customers can see active offers"  on offers  for select using (is_active = true);

-- support_tickets / payment_methods: scoped to owner (unchanged)
create policy "Customers can access own support ticket history" on support_tickets
  for all using (auth.uid() = customer_id);
create policy "Customers can see own payment methods" on payment_methods
  for all using (auth.uid() = customer_id);

-- =====================================================================
-- Missing RLS policies for tables that require write access
-- =====================================================================

-- roles: authenticated users need SELECT to resolve role names during login
create policy "Authenticated users can read roles" on roles
  for select to authenticated using (true);

-- user_roles: authenticated users can read only their own role assignment
create policy "Users can read own role assignment" on user_roles
  for select to authenticated using (auth.uid() = user_id);

-- order_status_history: append-only audit log
-- INSERT: any authenticated party to an order (customer, driver, merchant)
-- SELECT: scoped via RLS on orders — subquery returns only rows the caller can access
create policy "Authenticated users can insert order status" on order_status_history
  for insert to authenticated with check (true);
create policy "Authenticated users can read accessible order history" on order_status_history
  for select to authenticated using (
    order_id in (select id from orders)
  );

-- support_messages: customers open threads; admins reply
-- INSERT: any authenticated user (customer or admin sending reply)
-- SELECT: scoped to tickets owned by the caller
create policy "Authenticated users can insert support messages" on support_messages
  for insert to authenticated with check (true);
create policy "Users can read messages on own tickets" on support_messages
  for select to authenticated using (
    ticket_id in (select id from support_tickets where customer_id = auth.uid())
  );

-- driver_earnings: drivers record and read their own delivery earnings
-- Assumes drivers.id = auth.uid() per the auth model in 0004_security_hardening.sql
create policy "Drivers can insert own earnings" on driver_earnings
  for insert to authenticated with check (driver_id = auth.uid());
create policy "Drivers can read own earnings" on driver_earnings
  for select to authenticated using (driver_id = auth.uid());

-- payment_transactions: payment service records transactions during checkout
-- INSERT: any authenticated user (customer completing checkout)
-- SELECT: scoped via RLS on orders — subquery returns only accessible orders
create policy "Authenticated users can insert payment transactions" on payment_transactions
  for insert to authenticated with check (true);
create policy "Users can read own payment transactions" on payment_transactions
  for select to authenticated using (
    order_id in (select id from orders)
  );

-- push_tokens: users register and manage their own device push tokens
create policy "Users can manage own push tokens" on push_tokens
  for all to authenticated
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
