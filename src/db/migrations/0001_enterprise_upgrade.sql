-- 0001_enterprise_upgrade.sql
-- Upgrade database schema to full custom enterprise level

-- 1. Roles & Permissions Management
create table roles (
  id uuid primary key default uuid_generate_v4(),
  name varchar(50) unique not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table permissions (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  email varchar(100) unique not null,
  full_name varchar(100) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Payments Architecture
create table payment_methods (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  provider varchar(50) not null, -- 'stripe', 'mada', 'cash', etc.
  provider_payment_method_id varchar(255),
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table payment_transactions (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id) on delete cascade,
  status varchar(50) not null,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Customer Support Engine
create table support_tickets (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  subject varchar(200) not null,
  status varchar(50) default 'open' not null, -- 'open', 'in_progress', 'resolved', 'closed'
  priority varchar(50) default 'medium' not null, -- 'low', 'medium', 'high', 'critical'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table support_messages (
  id uuid primary key default uuid_generate_v4(),
  ticket_id uuid references support_tickets(id) on delete cascade,
  sender_type varchar(50) not null, -- 'customer', 'admin', 'system'
  sender_id uuid not null,
  message_text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Advertising & Dynamic Offers
create table offers (
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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
  id uuid primary key default uuid_generate_v4(),
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

-- Sample High-level Roles & Security Policies
create policy "Admins can manage configuration" on app_config for all using (true);
create policy "Customers can see active banners" on banners for select using (is_active = true);
create policy "Customers can see active offers" on offers for select using (is_active = true);
create policy "Customers can access own support ticket history" on support_tickets for all using (auth.uid() = customer_id);
create policy "Customers can see own payment methods" on payment_methods for all using (auth.uid() = customer_id);
