-- ============================================================
-- Migration 010: Platform Roles
-- ============================================================

-- ------------------------------------------------------------
-- Platform-level roles
-- ------------------------------------------------------------

create type public.platform_role as enum (
  'platform_admin'
);

-- ------------------------------------------------------------
-- Platform users
-- ------------------------------------------------------------

create table public.platform_users (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  role public.platform_role not null,

  is_active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create index platform_users_user_id_idx
  on public.platform_users(user_id);

-- ------------------------------------------------------------
-- Updated-at trigger
-- ------------------------------------------------------------

create trigger platform_users_set_updated_at
before update on public.platform_users
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Helper function
-- ------------------------------------------------------------

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.platform_users as pu
    where pu.user_id = auth.uid()
      and pu.role = 'platform_admin'
      and pu.is_active = true
  );
$$;

revoke all on function public.is_platform_admin()
from public;

grant execute on function public.is_platform_admin()
to authenticated;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------

alter table public.platform_users
enable row level security;

create policy "platform admins can view platform users"
on public.platform_users
for select
to authenticated
using (
  public.is_platform_admin()
);

create policy "platform admins can manage platform users"
on public.platform_users
for all
to authenticated
using (
  public.is_platform_admin()
)
with check (
  public.is_platform_admin()
);