-- ============================================================
-- Migration 011: Restaurant Owner Onboarding
-- ============================================================

create or replace function public.create_restaurant_for_owner(
  p_name text,
  p_phone text,
  p_email text,
  p_address text
)
returns table (
  restaurant_id uuid,
  restaurant_name text,
  restaurant_slug text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_name text;
  v_phone text;
  v_email text;
  v_address text;
  v_slug text;
  v_restaurant_id uuid;
begin
  -- ----------------------------------------------------------
  -- Current authenticated user
  -- ----------------------------------------------------------

  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  -- ----------------------------------------------------------
  -- Normalize input
  -- ----------------------------------------------------------

  v_name := trim(coalesce(p_name, ''));
  v_phone := trim(coalesce(p_phone, ''));
  v_email := lower(trim(coalesce(p_email, '')));
  v_address := trim(coalesce(p_address, ''));

  -- ----------------------------------------------------------
  -- Validate restaurant name
  -- ----------------------------------------------------------

  if char_length(v_name) < 2
     or char_length(v_name) > 120 then
    raise exception 'Restaurant name must contain between 2 and 120 characters';
  end if;

  -- ----------------------------------------------------------
  -- Make sure this user does not already own a restaurant
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.restaurant_members as rm
    where rm.user_id = v_user_id
      and rm.role = 'owner'
      and rm.is_active = true
  ) then
    raise exception 'This account already has an active restaurant';
  end if;

  -- ----------------------------------------------------------
  -- Generate a safe unique slug
  -- ----------------------------------------------------------

  v_slug :=
    regexp_replace(
      lower(v_name),
      '[^a-z0-9]+',
      '-',
      'g'
    );

  v_slug := trim(both '-' from v_slug);

  if v_slug = '' then
    v_slug := 'restaurant';
  end if;

  v_slug := v_slug || '-' ||
    substr(replace(v_user_id::text, '-', ''), 1, 8);

  -- ----------------------------------------------------------
  -- Create restaurant
  -- ----------------------------------------------------------

  insert into public.restaurants (
    name,
    slug,
    phone,
    email,
    address,
    is_active
  )
  values (
    v_name,
    v_slug,
    nullif(v_phone, ''),
    nullif(v_email, ''),
    nullif(v_address, ''),
    true
  )
  returning
    id
  into
    v_restaurant_id;

  -- ----------------------------------------------------------
  -- Create owner membership
  -- ----------------------------------------------------------

  insert into public.restaurant_members (
    restaurant_id,
    user_id,
    role,
    is_active
  )
  values (
    v_restaurant_id,
    v_user_id,
    'owner',
    true
  );

  -- ----------------------------------------------------------
  -- Return created restaurant
  -- ----------------------------------------------------------

  return query
  select
    r.id,
    r.name,
    r.slug
  from public.restaurants as r
  where r.id = v_restaurant_id;

end;
$$;

-- ------------------------------------------------------------
-- Only authenticated users can call onboarding.
-- ------------------------------------------------------------

revoke all on function public.create_restaurant_for_owner(
  text,
  text,
  text,
  text
)
from public;

grant execute on function public.create_restaurant_for_owner(
  text,
  text,
  text,
  text
)
to authenticated;