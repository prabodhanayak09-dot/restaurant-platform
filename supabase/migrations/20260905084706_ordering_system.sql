-- ============================================================
-- Migration 002: Customer Ordering System
-- ============================================================

-- ============================================================
-- ORDER STATUS
-- ============================================================

create type public.order_status as enum (
  'pending_payment',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'cancelled',
  'payment_failed',
  'expired'
);

-- ============================================================
-- RESERVATION STATUS
-- ============================================================

create type public.reservation_status as enum (
  'active',
  'converted',
  'expired',
  'released'
);

-- ============================================================
-- CUSTOMER
-- Restaurant-specific customer identity.
-- ============================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete cascade,

  first_name text not null
    check (char_length(trim(first_name)) between 1 and 50),

  phone text not null
    check (char_length(trim(phone)) between 7 and 20),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (restaurant_id, phone),
  unique (id, restaurant_id)
);

create index customers_restaurant_id_idx
  on public.customers(restaurant_id);

create index customers_phone_idx
  on public.customers(phone);

-- ============================================================
-- MENU INVENTORY
--
-- NULL = unlimited stock
-- 0    = sold out
-- >0   = quantity available
-- ============================================================

alter table public.menu_items
add column stock_quantity integer
  check (stock_quantity is null or stock_quantity >= 0);

-- ============================================================
-- RESTAURANT/TABLE AND MENU COMPOSITE UNIQUENESS
--
-- These constraints allow us to enforce that related objects
-- always belong to the same restaurant.
-- ============================================================

alter table public.restaurant_tables
add constraint restaurant_tables_id_restaurant_unique
unique (id, restaurant_id);

alter table public.menu_items
add constraint menu_items_id_restaurant_unique
unique (id, restaurant_id);

-- ============================================================
-- ORDERS
-- ============================================================

create table public.orders (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete restrict,

  table_id uuid not null,

  customer_id uuid not null,

  status public.order_status not null
    default 'pending_payment',

  subtotal_paise bigint not null default 0
    check (subtotal_paise >= 0),

  tax_paise bigint not null default 0
    check (tax_paise >= 0),

  discount_paise bigint not null default 0
    check (
      discount_paise >= 0
      and discount_paise <= subtotal_paise
    ),

  total_paise bigint not null default 0
    check (total_paise >= 0),

  estimated_preparation_minutes integer
    check (
      estimated_preparation_minutes is null
      or estimated_preparation_minutes > 0
    ),

  accepted_at timestamptz,
  preparing_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, restaurant_id),

  constraint orders_total_calculation_check
  check (
    total_paise = subtotal_paise + tax_paise - discount_paise
  ),

  constraint orders_table_same_restaurant_fk
  foreign key (table_id, restaurant_id)
  references public.restaurant_tables(id, restaurant_id)
  on delete restrict,

  constraint orders_customer_same_restaurant_fk
  foreign key (customer_id, restaurant_id)
  references public.customers(id, restaurant_id)
  on delete restrict
);

create index orders_restaurant_id_idx
  on public.orders(restaurant_id);

create index orders_table_id_idx
  on public.orders(table_id);

create index orders_customer_id_idx
  on public.orders(customer_id);

create index orders_status_idx
  on public.orders(restaurant_id, status);

create index orders_created_at_idx
  on public.orders(restaurant_id, created_at desc);

-- ============================================================
-- ORDER ITEMS
--
-- restaurant_id allows the database to enforce that:
--
-- Order -> Restaurant
-- Menu Item -> Same Restaurant
--
-- item_name and unit_price_paise are immutable historical
-- snapshots from the time the order is created.
-- ============================================================

create table public.order_items (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete restrict,

  order_id uuid not null,

  menu_item_id uuid not null,

  item_name text not null
    check (char_length(trim(item_name)) between 1 and 200),

  unit_price_paise bigint not null
    check (unit_price_paise >= 0),

  quantity integer not null
    check (quantity > 0 and quantity <= 100),

  total_price_paise bigint not null
    check (total_price_paise >= 0),

  created_at timestamptz not null default now(),

  constraint order_items_order_same_restaurant_fk
  foreign key (order_id, restaurant_id)
  references public.orders(id, restaurant_id)
  on delete cascade,

  constraint order_items_menu_same_restaurant_fk
  foreign key (menu_item_id, restaurant_id)
  references public.menu_items(id, restaurant_id)
  on delete restrict,

  constraint order_items_total_calculation_check
  check (
    total_price_paise = unit_price_paise * quantity
  )
);

create index order_items_order_id_idx
  on public.order_items(order_id);

create index order_items_menu_item_id_idx
  on public.order_items(menu_item_id);

create index order_items_restaurant_id_idx
  on public.order_items(restaurant_id);

-- ============================================================
-- ITEM RESERVATIONS
--
-- Temporary checkout lock.
--
-- For limited-stock items:
--
-- stock = 10
-- active reservations = 6
-- available = 4
--
-- The atomic reservation function below prevents two customers
-- from claiming the same remaining stock simultaneously.
-- ============================================================

create table public.item_reservations (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete restrict,

  menu_item_id uuid not null,

  customer_id uuid not null,

  quantity integer not null
    check (quantity > 0 and quantity <= 100),

  status public.reservation_status not null
    default 'active',

  expires_at timestamptz not null,

  created_at timestamptz not null default now(),

  released_at timestamptz,

  constraint item_reservations_menu_same_restaurant_fk
  foreign key (menu_item_id, restaurant_id)
  references public.menu_items(id, restaurant_id)
  on delete restrict,

  constraint item_reservations_customer_same_restaurant_fk
  foreign key (customer_id, restaurant_id)
  references public.customers(id, restaurant_id)
  on delete restrict
);

create index item_reservations_menu_item_idx
  on public.item_reservations(menu_item_id);

create index item_reservations_customer_idx
  on public.item_reservations(customer_id);

create index item_reservations_active_idx
  on public.item_reservations(
    menu_item_id,
    status,
    expires_at
  );

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create trigger customers_set_updated_at
before update on public.customers
for each row
execute function public.set_updated_at();

create trigger orders_set_updated_at
before update on public.orders
for each row
execute function public.set_updated_at();

-- ============================================================
-- ATOMIC ITEM RESERVATION FUNCTION
--
-- This is the important PVR-style locking mechanism.
--
-- The menu item row is locked with FOR UPDATE, so concurrent
-- requests cannot both calculate the same remaining stock.
--
-- p_hold_seconds defaults to 300 seconds = 5 minutes.
-- ============================================================

create or replace function public.create_item_reservation(
  p_restaurant_id uuid,
  p_menu_item_id uuid,
  p_customer_id uuid,
  p_quantity integer,
  p_hold_seconds integer default 300
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock_quantity integer;
  v_is_available boolean;
  v_reserved_quantity integer;
  v_reservation_id uuid;
begin

  if p_quantity <= 0 or p_quantity > 100 then
    raise exception 'Invalid reservation quantity';
  end if;

  if p_hold_seconds <= 0 or p_hold_seconds > 1800 then
    raise exception 'Invalid reservation duration';
  end if;

  -- Lock the menu item row.
  select
    stock_quantity,
    is_available
  into
    v_stock_quantity,
    v_is_available
  from public.menu_items
  where id = p_menu_item_id
    and restaurant_id = p_restaurant_id
  for update;

  if not found then
    raise exception 'Menu item not found';
  end if;

  if v_is_available = false then
    raise exception 'Menu item is unavailable';
  end if;

  -- Expire old reservations for this item.
  update public.item_reservations
  set
    status = 'expired',
    released_at = now()
  where menu_item_id = p_menu_item_id
    and status = 'active'
    and expires_at <= now();

  -- Unlimited-stock item.
  if v_stock_quantity is null then

    insert into public.item_reservations (
      restaurant_id,
      menu_item_id,
      customer_id,
      quantity,
      status,
      expires_at
    )
    values (
      p_restaurant_id,
      p_menu_item_id,
      p_customer_id,
      p_quantity,
      'active',
      now() + make_interval(secs => p_hold_seconds)
    )
    returning id into v_reservation_id;

    return v_reservation_id;
  end if;

  -- Calculate currently reserved quantity.
  select coalesce(sum(quantity), 0)
  into v_reserved_quantity
  from public.item_reservations
  where menu_item_id = p_menu_item_id
    and status = 'active'
    and expires_at > now();

  -- Check remaining stock.
  if v_stock_quantity - v_reserved_quantity < p_quantity then
    raise exception 'Not enough stock available';
  end if;

  insert into public.item_reservations (
    restaurant_id,
    menu_item_id,
    customer_id,
    quantity,
    status,
    expires_at
  )
  values (
    p_restaurant_id,
    p_menu_item_id,
    p_customer_id,
    p_quantity,
    'active',
    now() + make_interval(secs => p_hold_seconds)
  )
  returning id into v_reservation_id;

  return v_reservation_id;
end;
$$;

-- ============================================================
-- EXPIRE RESERVATIONS FUNCTION
-- Can later be called by a scheduled job.
-- ============================================================

create or replace function public.expire_item_reservations()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin

  update public.item_reservations
  set
    status = 'expired',
    released_at = now()
  where status = 'active'
    and expires_at <= now();

  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.item_reservations enable row level security;

-- ============================================================
-- CUSTOMER POLICIES
-- ============================================================

create policy "restaurant members can view customers"
on public.customers
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- ============================================================
-- ORDER POLICIES
--
-- Direct order updates are intentionally NOT allowed here.
-- Status and money changes will go through controlled server-side
-- operations in later migrations.
-- ============================================================

create policy "restaurant members can view orders"
on public.orders
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- ============================================================
-- ORDER ITEM POLICIES
-- ============================================================

create policy "restaurant members can view order items"
on public.order_items
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- ============================================================
-- RESERVATION POLICIES
-- ============================================================

create policy "restaurant members can view reservations"
on public.item_reservations
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- ============================================================
-- FUNCTION PRIVILEGES
--
-- These functions are intended to be called by our backend
-- application, not exposed as unrestricted client operations.
-- ============================================================

revoke all on function public.create_item_reservation(
  uuid,
  uuid,
  uuid,
  integer,
  integer
) from public;

revoke all on function public.expire_item_reservations()
from public;