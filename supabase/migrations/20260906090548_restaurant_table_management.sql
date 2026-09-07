-- ============================================================
-- Migration 012: Restaurant Table Management
-- ============================================================

-- ------------------------------------------------------------
-- Generate tables + one unique QR code for each table
--
-- The operation is performed inside one database transaction.
-- If any part fails, the complete operation is rolled back.
-- ------------------------------------------------------------

create or replace function public.add_restaurant_tables(
  p_restaurant_id uuid,
  p_table_count integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_count integer;
  v_new_count integer;
  v_table_number integer;
  v_table_id uuid;
begin
  -- ----------------------------------------------------------
  -- Authentication
  -- ----------------------------------------------------------

  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  -- ----------------------------------------------------------
  -- Owner authorization
  -- ----------------------------------------------------------

  if not public.is_restaurant_owner(p_restaurant_id) then
    raise exception 'Only the restaurant owner can manage tables';
  end if;

  -- ----------------------------------------------------------
  -- Validate requested count
  -- ----------------------------------------------------------

  if p_table_count is null
     or p_table_count <= 0
     or p_table_count > 500 then
    raise exception 'Table count must be between 1 and 500';
  end if;

  -- ----------------------------------------------------------
  -- Count currently active tables
  -- ----------------------------------------------------------

  select count(*)::integer
  into v_current_count
  from public.restaurant_tables as rt
  where rt.restaurant_id = p_restaurant_id
    and rt.is_active = true;

  -- ----------------------------------------------------------
  -- Work out how many new tables are required.
  --
  -- Example:
  -- current = 15
  -- requested = 19
  -- create 16,17,18,19
  -- ----------------------------------------------------------

  if p_table_count <= v_current_count then
    return 0;
  end if;

  v_new_count := p_table_count - v_current_count;

  -- ----------------------------------------------------------
  -- Create missing tables.
  --
  -- Each table automatically receives exactly ONE QR code.
  -- qr_token uses the table_qr_codes UUID default, therefore
  -- every generated QR token is globally unique.
  -- ----------------------------------------------------------

  for v_table_number in
    (v_current_count + 1)..p_table_count
  loop

    insert into public.restaurant_tables (
      restaurant_id,
      table_number,
      display_name,
      is_active
    )
    values (
      p_restaurant_id,
      v_table_number,
      'Table ' || v_table_number,
      true
    )
    returning id into v_table_id;

    insert into public.table_qr_codes (
      table_id,
      is_active
    )
    values (
      v_table_id,
      true
    );

  end loop;

  return v_new_count;
end;
$$;


-- ------------------------------------------------------------
-- Reduce / deactivate tables
--
-- Tables are NOT deleted because historical orders may refer
-- to them. Tables above the requested count are deactivated
-- and their active QR codes are revoked.
-- ------------------------------------------------------------

create or replace function public.set_restaurant_table_count(
  p_restaurant_id uuid,
  p_table_count integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current_count integer;
  v_changed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_restaurant_owner(p_restaurant_id) then
    raise exception 'Only the restaurant owner can manage tables';
  end if;

  if p_table_count is null
     or p_table_count < 0
     or p_table_count > 500 then
    raise exception 'Table count must be between 0 and 500';
  end if;

  select count(*)::integer
  into v_current_count
  from public.restaurant_tables as rt
  where rt.restaurant_id = p_restaurant_id
    and rt.is_active = true;

  if p_table_count > v_current_count then
    return public.add_restaurant_tables(
      p_restaurant_id,
      p_table_count
    );
  end if;

  if p_table_count = v_current_count then
    return 0;
  end if;

  -- ----------------------------------------------------------
  -- Deactivate tables above the requested count.
  -- Highest-numbered tables are removed first.
  -- ----------------------------------------------------------

  update public.table_qr_codes as q
  set
    is_active = false,
    revoked_at = coalesce(q.revoked_at, now())
  where q.table_id in (
    select rt.id
    from public.restaurant_tables as rt
    where rt.restaurant_id = p_restaurant_id
      and rt.is_active = true
      and rt.table_number > p_table_count
  )
  and q.is_active = true;

  update public.restaurant_tables as rt
  set
    is_active = false,
    updated_at = now()
  where rt.restaurant_id = p_restaurant_id
    and rt.is_active = true
    and rt.table_number > p_table_count;

  get diagnostics v_changed_count = row_count;

  return v_changed_count;
end;
$$;


-- ------------------------------------------------------------
-- Regenerate the QR code for ONE table
--
-- The old QR is revoked first.
-- A completely new UUID token is generated.
-- ------------------------------------------------------------

create or replace function public.regenerate_table_qr(
  p_restaurant_id uuid,
  p_table_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_new_qr_token uuid;
  v_table_restaurant_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_restaurant_owner(p_restaurant_id) then
    raise exception 'Only the restaurant owner can manage QR codes';
  end if;

  select rt.restaurant_id
  into v_table_restaurant_id
  from public.restaurant_tables as rt
  where rt.id = p_table_id
    and rt.restaurant_id = p_restaurant_id
    and rt.is_active = true;

  if v_table_restaurant_id is null then
    raise exception 'Table not found or inactive';
  end if;

  -- Revoke every currently active QR for this table.
  update public.table_qr_codes as q
  set
    is_active = false,
    revoked_at = coalesce(q.revoked_at, now())
  where q.table_id = p_table_id
    and q.is_active = true;

  -- Generate a brand-new QR token.
  insert into public.table_qr_codes (
    table_id,
    qr_token,
    is_active
  )
  values (
    p_table_id,
    gen_random_uuid(),
    true
  )
  returning qr_token
  into v_new_qr_token;

  return v_new_qr_token;
end;
$$;


-- ------------------------------------------------------------
-- Revoke the current QR for one table
-- ------------------------------------------------------------

create or replace function public.revoke_table_qr(
  p_restaurant_id uuid,
  p_table_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not public.is_restaurant_owner(p_restaurant_id) then
    raise exception 'Only the restaurant owner can manage QR codes';
  end if;

  update public.table_qr_codes as q
  set
    is_active = false,
    revoked_at = coalesce(q.revoked_at, now())
  where q.table_id = p_table_id
    and q.is_active = true;

  return true;
end;
$$;


-- ============================================================
-- Permissions
-- ============================================================

revoke all on function public.add_restaurant_tables(
  uuid,
  integer
)
from public;

grant execute on function public.add_restaurant_tables(
  uuid,
  integer
)
to authenticated;


revoke all on function public.set_restaurant_table_count(
  uuid,
  integer
)
from public;

grant execute on function public.set_restaurant_table_count(
  uuid,
  integer
)
to authenticated;


revoke all on function public.regenerate_table_qr(
  uuid,
  uuid
)
from public;

grant execute on function public.regenerate_table_qr(
  uuid,
  uuid
)
to authenticated;


revoke all on function public.revoke_table_qr(
  uuid,
  uuid
)
from public;

grant execute on function public.revoke_table_qr(
  uuid,
  uuid
)
to authenticated;