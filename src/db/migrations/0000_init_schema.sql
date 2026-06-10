-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Locations
create table countries (id uuid primary key default uuid_generate_v4(), name varchar(100) not null, code varchar(5) not null);
create table cities (id uuid primary key default uuid_generate_v4(), country_id uuid references countries(id), name varchar(100) not null);
create table zones (id uuid primary key default uuid_generate_v4(), city_id uuid references cities(id), name varchar(100) not null);

-- 2. Core Entities
create table customers (id uuid primary key default uuid_generate_v4(), phone_number varchar(20) unique not null, full_name varchar(100), email varchar(100));
create table addresses (id uuid primary key default uuid_generate_v4(), customer_id uuid references customers(id), zone_id uuid references zones(id), address_line text, label varchar(50));
create table merchants (id uuid primary key default uuid_generate_v4(), business_name varchar(100) not null);
create table merchant_branches (id uuid primary key default uuid_generate_v4(), merchant_id uuid references merchants(id), zone_id uuid references zones(id), name varchar(100));

-- 3. Product Catalog
create table categories (id uuid primary key default uuid_generate_v4(), name varchar(100) not null);
create table products (id uuid primary key default uuid_generate_v4(), branch_id uuid references merchant_branches(id), category_id uuid references categories(id), name varchar(200) not null, price decimal(10,2));
create table product_variants (id uuid primary key default uuid_generate_v4(), product_id uuid references products(id), name varchar(100), price_modifier decimal(10,2));
create table product_images (id uuid primary key default uuid_generate_v4(), product_id uuid references products(id), url text not null);

-- 4. Orders & Drivers
create table drivers (id uuid primary key default uuid_generate_v4(), phone_number varchar(20) unique not null, full_name varchar(100), zone_id uuid references zones(id), is_online boolean default false);
create table orders (id uuid primary key default uuid_generate_v4(), customer_id uuid references customers(id), branch_id uuid references merchant_branches(id), driver_id uuid references drivers(id), status varchar(50) default 'pending', total_amount decimal(10,2));
create table order_items (id uuid primary key default uuid_generate_v4(), order_id uuid references orders(id), variant_id uuid references product_variants(id), quantity integer not null, price decimal(10,2));
create table driver_locations (id uuid primary key default uuid_generate_v4(), driver_id uuid references drivers(id), coords point not null);

-- 5. Wallet & Fin
create table wallets (id uuid primary key default uuid_generate_v4(), owner_type varchar(20) not null, owner_id uuid not null, balance decimal(12,2) default 0);
create table wallet_transactions (id uuid primary key default uuid_generate_v4(), wallet_id uuid references wallets(id), amount decimal(12,2) not null, type varchar(20) not null);

-- 6. Memberships, Subscriptions, Coupons, Favs, Reviews, Audit, Settings
create table memberships (id uuid primary key default uuid_generate_v4(), name varchar(100) not null);
create table subscriptions (id uuid primary key default uuid_generate_v4(), customer_id uuid references customers(id), membership_id uuid references memberships(id), expires_at timestamp with time zone);
create table coupons (id uuid primary key default uuid_generate_v4(), code varchar(50) unique not null, discount_percent integer);
create table coupon_usages (id uuid primary key default uuid_generate_v4(), coupon_id uuid references coupons(id), order_id uuid references orders(id));
create table favorites (id uuid primary key default uuid_generate_v4(), customer_id uuid references customers(id), product_id uuid references products(id));
create table notifications (id uuid primary key default uuid_generate_v4(), target_user_id uuid, message text, type varchar(50));
create table reviews (id uuid primary key default uuid_generate_v4(), order_id uuid references orders(id), customer_id uuid references customers(id), rating integer check (rating between 1 and 5), comment text);
create table audit_logs (id uuid primary key default uuid_generate_v4(), action text, table_name varchar(50), record_id uuid, created_at timestamp with time zone default timezone('utc'::text, now()));
create table settings (key varchar(50) primary key, value jsonb);

-- Indexes
create index idx_orders_customer on orders(customer_id);
create index idx_products_branch on products(branch_id);

-- RLS (Basic Pattern)
alter table customers enable row level security;
create policy "Users can see own data" on customers for select using (auth.uid() = id);

-- Seed
insert into categories (name) values ('مطاعم'), ('سوبر ماركت'), ('صيدلية');
