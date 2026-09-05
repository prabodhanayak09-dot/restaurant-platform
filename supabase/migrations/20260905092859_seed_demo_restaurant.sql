-- ============================================================
-- Migration 004: Demo Restaurant Data
-- Development/testing only
-- ============================================================

do $$
declare
  v_restaurant_id uuid;
  v_table_id uuid;
begin

  -- Create demo restaurant
  insert into public.restaurants (
    name,
    slug,
    phone,
    email,
    address
  )
  values (
    'Demo Restaurant',
    'demo-restaurant',
    '0000000000',
    'demo@example.test',
    'Development Test Location'
  )
  on conflict (slug) do update
    set name = excluded.name
  returning id into v_restaurant_id;

  -- Create demo table
  insert into public.restaurant_tables (
    restaurant_id,
    table_number,
    display_name
  )
  values (
    v_restaurant_id,
    1,
    'Table 1'
  )
  on conflict (restaurant_id, table_number)
  do update set
    display_name = excluded.display_name
  returning id into v_table_id;

  -- Create a QR code for the demo table
  insert into public.table_qr_codes (
    table_id,
    is_active
  )
  select
    v_table_id,
    true
  where not exists (
    select 1
    from public.table_qr_codes
    where table_id = v_table_id
      and is_active = true
  );

end $$;