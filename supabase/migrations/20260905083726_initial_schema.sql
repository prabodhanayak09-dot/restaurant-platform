-- ============================================================
-- Migration 001: Core Restaurant Platform Schema
-- ============================================================

create extension if not exists pgcrypto;

-- ============================================================
-- RESTAURANTS
-- ============================================================

create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  phone text,
  email text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- RESTAURANT MEMBERS
-- Owner and staff accounts belong to a restaurant.
-- ============================================================

create type public.restaurant_member_role as enum (
  'owner',
  'staff'
);

create table public.restaurant_members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.restaurant_member_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, user_id)
);

create index restaurant_members_user_id_idx
  on public.restaurant_members(user_id);

create index restaurant_members_restaurant_id_idx
  on public.restaurant_members(restaurant_id);

-- ============================================================
-- TABLES
-- ============================================================

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  table_number integer not null,
  display_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, table_number)
);

create index restaurant_tables_restaurant_id_idx
  on public.restaurant_tables(restaurant_id);

-- ============================================================
-- QR CODES
-- A QR identifies a table but can be revoked.
-- ============================================================

create table public.table_qr_codes (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references public.restaurant_tables(id) on delete cascade,
  qr_token uuid not null default gen_random_uuid() unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index table_qr_codes_table_id_idx
  on public.table_qr_codes(table_id);

-- ============================================================
-- MENU CATEGORIES
-- ============================================================

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  name text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_categories_restaurant_id_idx
  on public.menu_categories(restaurant_id);

-- ============================================================
-- MENU ITEMS
-- Price and availability are controlled by the restaurant.
-- ============================================================

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants(id) on delete cascade,
  category_id uuid references public.menu_categories(id) on delete set null,

  name text not null,
  description text,

  price_paise bigint not null check (price_paise >= 0),

  image_url text,

  is_available boolean not null default true,
  sort_order integer not null default 0,

  preparation_time_minutes integer
    check (preparation_time_minutes is null or preparation_time_minutes > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index menu_items_restaurant_id_idx
  on public.menu_items(restaurant_id);

create index menu_items_category_id_idx
  on public.menu_items(category_id);

create index menu_items_available_idx
  on public.menu_items(restaurant_id, is_available);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger restaurants_set_updated_at
before update on public.restaurants
for each row
execute function public.set_updated_at();

create trigger restaurant_members_set_updated_at
before update on public.restaurant_members
for each row
execute function public.set_updated_at();

create trigger restaurant_tables_set_updated_at
before update on public.restaurant_tables
for each row
execute function public.set_updated_at();

create trigger menu_categories_set_updated_at
before update on public.menu_categories
for each row
execute function public.set_updated_at();

create trigger menu_items_set_updated_at
before update on public.menu_items
for each row
execute function public.set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.restaurants enable row level security;
alter table public.restaurant_members enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.table_qr_codes enable row level security;
alter table public.menu_categories enable row level security;
alter table public.menu_items enable row level security;

-- ============================================================
-- HELPER FUNCTION
-- Determines whether the logged-in user belongs to a restaurant.
-- ============================================================

create or replace function public.is_restaurant_member(
  target_restaurant_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.is_active = true
  );
$$;

-- ============================================================
-- HELPER FUNCTION
-- Determines whether the logged-in user is an owner.
-- ============================================================

create or replace function public.is_restaurant_owner(
  target_restaurant_id uuid
)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.restaurant_members rm
    where rm.restaurant_id = target_restaurant_id
      and rm.user_id = auth.uid()
      and rm.role = 'owner'
      and rm.is_active = true
  );
$$;

-- ============================================================
-- RESTAURANT POLICIES
-- ============================================================

create policy "members can view their restaurant"
on public.restaurants
for select
to authenticated
using (
  public.is_restaurant_member(id)
);

create policy "owners can update their restaurant"
on public.restaurants
for update
to authenticated
using (
  public.is_restaurant_owner(id)
)
with check (
  public.is_restaurant_owner(id)
);

-- ============================================================
-- MEMBER POLICIES
-- ============================================================

create policy "members can view restaurant members"
on public.restaurant_members
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- ============================================================
-- TABLE POLICIES
-- ============================================================

create policy "members can view restaurant tables"
on public.restaurant_tables
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "owners can manage restaurant tables"
on public.restaurant_tables
for all
to authenticated
using (
  public.is_restaurant_owner(restaurant_id)
)
with check (
  public.is_restaurant_owner(restaurant_id)
);

-- ============================================================
-- QR POLICIES
-- ============================================================

create policy "members can view table QR codes"
on public.table_qr_codes
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_tables rt
    where rt.id = table_qr_codes.table_id
      and public.is_restaurant_member(rt.restaurant_id)
  )
);

create policy "owners can manage table QR codes"
on public.table_qr_codes
for all
to authenticated
using (
  exists (
    select 1
    from public.restaurant_tables rt
    where rt.id = table_qr_codes.table_id
      and public.is_restaurant_owner(rt.restaurant_id)
  )
)
with check (
  exists (
    select 1
    from public.restaurant_tables rt
    where rt.id = table_qr_codes.table_id
      and public.is_restaurant_owner(rt.restaurant_id)
  )
);

-- ============================================================
-- MENU CATEGORY POLICIES
-- ============================================================

create policy "members can view menu categories"
on public.menu_categories
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "owners can manage menu categories"
on public.menu_categories
for all
to authenticated
using (
  public.is_restaurant_owner(restaurant_id)
)
with check (
  public.is_restaurant_owner(restaurant_id)
);

-- ============================================================
-- MENU ITEM POLICIES
-- ============================================================

create policy "members can view menu items"
on public.menu_items
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

create policy "owners can manage menu items"
on public.menu_items
for all
to authenticated
using (
  public.is_restaurant_owner(restaurant_id)
)
with check (
  public.is_restaurant_owner(restaurant_id)
);