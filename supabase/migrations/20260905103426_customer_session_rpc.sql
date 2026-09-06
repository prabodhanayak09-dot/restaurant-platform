-- ============================================================
-- Migration 007: Secure Customer Session RPCs
-- ============================================================

-- ============================================================
-- CREATE CUSTOMER + SESSION
--
-- Public customer flow uses this function instead of direct
-- INSERT access to customers/customer_sessions.
-- ============================================================

create or replace function public.create_customer_session(
  p_qr_token uuid,
  p_first_name text,
  p_phone text
)
returns table (
  session_token uuid,
  restaurant_id uuid,
  table_id uuid,
  customer_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
  v_customer_id uuid;
  v_first_name text;
  v_phone text;
begin
  v_first_name := trim(p_first_name);
  v_phone := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');

  if char_length(v_first_name) < 1
     or char_length(v_first_name) > 50 then
    raise exception 'Invalid first name';
  end if;

  if char_length(v_phone) < 7
     or char_length(v_phone) > 15 then
    raise exception 'Invalid phone number';
  end if;

  -- Resolve the active QR code.
  select
    rt.restaurant_id,
    rt.id
  into
    v_restaurant_id,
    v_table_id
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

  if v_restaurant_id is null then
    raise exception 'Invalid or inactive QR code';
  end if;

  -- Find the restaurant-specific customer.
  select c.id
  into v_customer_id
  from public.customers c
  where c.restaurant_id = v_restaurant_id
    and c.phone = v_phone
  limit 1;

  -- Create customer if this is their first visit.
  if v_customer_id is null then
    insert into public.customers (
      restaurant_id,
      first_name,
      phone
    )
    values (
      v_restaurant_id,
      v_first_name,
      v_phone
    )
    on conflict (restaurant_id, phone)
    do update set
      first_name = excluded.first_name,
      updated_at = now()
    returning id into v_customer_id;
  else
    update public.customers
    set
      first_name = v_first_name,
      updated_at = now()
    where id = v_customer_id;
  end if;

  -- Every visit gets an independent session.
  return query
  insert into public.customer_sessions (
    restaurant_id,
    table_id,
    customer_id,
    expires_at,
    last_activity_at
  )
  values (
    v_restaurant_id,
    v_table_id,
    v_customer_id,
    now() + interval '2 hours',
    now()
  )
  returning
    customer_sessions.session_token,
    customer_sessions.restaurant_id,
    customer_sessions.table_id,
    customer_sessions.customer_id;
end;
$$;

-- ============================================================
-- RESOLVE CUSTOMER SESSION
-- ============================================================

create or replace function public.resolve_customer_session(
  p_session_token uuid
)
returns table (
  session_id uuid,
  restaurant_id uuid,
  restaurant_name text,
  table_id uuid,
  table_number integer,
  customer_id uuid,
  customer_first_name text
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    cs.id,
    r.id,
    r.name,
    rt.id,
    rt.table_number,
    c.id,
    c.first_name
  from public.customer_sessions cs
  join public.restaurants r
    on r.id = cs.restaurant_id
  join public.restaurant_tables rt
    on rt.id = cs.table_id
   and rt.restaurant_id = cs.restaurant_id
  join public.customers c
    on c.id = cs.customer_id
   and c.restaurant_id = cs.restaurant_id
  where cs.session_token = p_session_token
    and cs.status = 'active'
    and cs.expires_at > now()
    and r.is_active = true
    and rt.is_active = true
  limit 1;
$$;

-- ============================================================
-- FUNCTION PRIVILEGES
-- ============================================================

revoke all on function public.create_customer_session(
  uuid,
  text,
  text
) from public;

grant execute on function public.create_customer_session(
  uuid,
  text,
  text
) to anon, authenticated;

revoke all on function public.resolve_customer_session(
  uuid
) from public;

grant execute on function public.resolve_customer_session(
  uuid
) to anon, authenticated;