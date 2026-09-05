-- ============================================================
-- Migration 003: Secure QR Resolution
-- ============================================================

create or replace function public.resolve_table_qr(
  p_qr_token uuid
)
returns table (
  restaurant_id uuid,
  restaurant_name text,
  table_id uuid,
  table_number integer
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    r.id,
    r.name,
    rt.id,
    rt.table_number
  from public.table_qr_codes q
  join public.restaurant_tables rt
    on rt.id = q.table_id
  join public.restaurants r
    on r.id = rt.restaurant_id
  where q.qr_token = p_qr_token
    and q.is_active = true
    and rt.is_active = true
    and r.is_active = true
  limit 1;
$$;

revoke all on function public.resolve_table_qr(uuid)
from public;

grant execute on function public.resolve_table_qr(uuid)
to anon, authenticated;