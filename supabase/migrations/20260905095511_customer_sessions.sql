-- ============================================================
-- Migration 005: Customer Sessions
-- ============================================================

create table public.customer_sessions (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete cascade,

  table_id uuid not null,

  customer_id uuid not null
    references public.customers(id)
    on delete cascade,

  session_token uuid not null
    default gen_random_uuid()
    unique,

  status text not null default 'active'
    check (status in ('active', 'expired', 'closed')),

  started_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  expires_at timestamptz not null,

  closed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, restaurant_id),

  constraint customer_sessions_table_same_restaurant_fk
    foreign key (table_id, restaurant_id)
    references public.restaurant_tables(id, restaurant_id)
    on delete restrict,

  unique (session_token)
);

create index customer_sessions_restaurant_id_idx
  on public.customer_sessions(restaurant_id);

create index customer_sessions_table_id_idx
  on public.customer_sessions(table_id);

create index customer_sessions_customer_id_idx
  on public.customer_sessions(customer_id);

create index customer_sessions_active_idx
  on public.customer_sessions(
    table_id,
    status,
    expires_at
  );

create trigger customer_sessions_set_updated_at
before update on public.customer_sessions
for each row
execute function public.set_updated_at();

-- ============================================================
-- Link orders to the customer's session.
-- A single session can have multiple orders.
-- ============================================================

alter table public.orders
add column customer_session_id uuid;

alter table public.orders
add constraint orders_session_same_restaurant_fk
foreign key (customer_session_id, restaurant_id)
references public.customer_sessions(id, restaurant_id)
on delete restrict;

create index orders_customer_session_id_idx
  on public.orders(customer_session_id);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table public.customer_sessions enable row level security;

create policy "restaurant members can view customer sessions"
on public.customer_sessions
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);