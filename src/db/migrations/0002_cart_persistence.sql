-- 0002_cart_persistence.sql
-- Create customer_carts and cart_items for cloud-synced persistent shopping carts

create table if not exists customer_carts (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade unique,
  branch_id uuid references merchant_branches(id) on delete set null,
  applied_coupon jsonb, -- { code: string, discountPercent: number }
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table if not exists cart_items (
  id uuid primary key default uuid_generate_v4(),
  cart_id uuid references customer_carts(id) on delete cascade,
  product_id uuid references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  quantity integer not null default 1,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique (cart_id, product_id, variant_id)
);

-- Enable RLS and create security policies
alter table customer_carts enable row level security;
alter table cart_items enable row level security;

create policy "Customers can manage their own cart" on customer_carts
  for all using (auth.uid() = customer_id);

create policy "Customers can manage their own cart items" on cart_items
  for all using (
    cart_id in (select id from customer_carts where customer_id = auth.uid())
  );
