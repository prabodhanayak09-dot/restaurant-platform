-- ============================================================
-- Migration 008: Fix Customer Session RPC
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
  v_session_token uuid;
  v_first_name text;
  v_phone text;
begin

  -- ----------------------------------------------------------
  -- Normalize input
  -- ----------------------------------------------------------

  v_first_name := trim(coalesce(p_first_name, ''));

  v_phone := regexp_replace(
    coalesce(p_phone, ''),
    '\D',
    '',
    'g'
  );

  -- ----------------------------------------------------------
  -- Validate input
  -- ----------------------------------------------------------

  if char_length(v_first_name) < 1
     or char_length(v_first_name) > 50 then
    raise exception 'Invalid first name';
  end if;

  if char_length(v_phone) < 7
     or char_length(v_phone) > 15 then
    raise exception 'Invalid phone number';
  end if;

  -- ----------------------------------------------------------
  -- Resolve QR → restaurant + table
  -- ----------------------------------------------------------

  select
    rt.restaurant_id,
    rt.id
  into
    v_restaurant_id,
    v_table_id
  from public.table_qr_codes as q
  inner join public.restaurant_tables as rt
    on rt.id = q.table_id
  inner join public.restaurants as r
    on r.id = rt.restaurant_id
  where q.qr_token = p_qr_token
    and q.is_active = true
    and rt.is_active = true
    and r.is_active = true
  limit 1;

  if v_restaurant_id is null
     or v_table_id is null then
    raise exception 'Invalid or inactive QR code';
  end if;

  -- ----------------------------------------------------------
  -- Find customer belonging to this restaurant
  -- ----------------------------------------------------------

  select c.id
  into v_customer_id
  from public.customers as c
  where c.restaurant_id = v_restaurant_id
    and c.phone = v_phone
  limit 1;

  -- ----------------------------------------------------------
  -- Create or update customer
  -- ----------------------------------------------------------

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
    returning public.customers.id
    into v_customer_id;

  else

    update public.customers as c
    set
      first_name = v_first_name,
      updated_at = now()
    where c.id = v_customer_id;

  end if;

  -- ----------------------------------------------------------
  -- Create a NEW session for this visit
  -- ----------------------------------------------------------

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
  returning public.customer_sessions.session_token
  into v_session_token;

  -- ----------------------------------------------------------
  -- Return session
  -- ----------------------------------------------------------

  return query
  select
    v_session_token as session_token,
    v_restaurant_id as restaurant_id,
    v_table_id as table_id,
    v_customer_id as customer_id;

end;
$$;


-- ============================================================
-- Resolve Customer Session
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
    cs.id as session_id,
    r.id as restaurant_id,
    r.name as restaurant_name,
    rt.id as table_id,
    rt.table_number as table_number,
    c.id as customer_id,
    c.first_name as customer_first_name
  from public.customer_sessions as cs
  inner join public.restaurants as r
    on r.id = cs.restaurant_id
  inner join public.restaurant_tables as rt
    on rt.id = cs.table_id
   and rt.restaurant_id = cs.restaurant_id
  inner join public.customers as c
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
-- Permissions
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