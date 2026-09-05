-- ============================================================
-- Migration 006: Demo Restaurant Menu
-- Development/testing data only
-- ============================================================

do $$
declare
  v_restaurant_id uuid;
  v_burgers_id uuid;
  v_drinks_id uuid;
begin

  -- ----------------------------------------------------------
  -- Find Demo Restaurant
  -- ----------------------------------------------------------

  select id
  into v_restaurant_id
  from public.restaurants
  where slug = 'demo-restaurant'
  limit 1;

  if v_restaurant_id is null then
    raise exception 'Demo Restaurant not found';
  end if;

  -- ----------------------------------------------------------
  -- Burgers category
  -- ----------------------------------------------------------

  select id
  into v_burgers_id
  from public.menu_categories
  where restaurant_id = v_restaurant_id
    and name = 'Burgers'
  limit 1;

  if v_burgers_id is null then
    insert into public.menu_categories (
      restaurant_id,
      name,
      description,
      sort_order,
      is_active
    )
    values (
      v_restaurant_id,
      'Burgers',
      'Freshly prepared burgers',
      1,
      true
    )
    returning id into v_burgers_id;
  end if;

  -- ----------------------------------------------------------
  -- Drinks category
  -- ----------------------------------------------------------

  select id
  into v_drinks_id
  from public.menu_categories
  where restaurant_id = v_restaurant_id
    and name = 'Drinks'
  limit 1;

  if v_drinks_id is null then
    insert into public.menu_categories (
      restaurant_id,
      name,
      description,
      sort_order,
      is_active
    )
    values (
      v_restaurant_id,
      'Drinks',
      'Cold and refreshing beverages',
      2,
      true
    )
    returning id into v_drinks_id;
  end if;

  -- ----------------------------------------------------------
  -- Chicken Burger
  -- ₹220 = 22000 paise
  -- ----------------------------------------------------------

  insert into public.menu_items (
    restaurant_id,
    category_id,
    name,
    description,
    price_paise,
    stock_quantity,
    is_available,
    sort_order,
    preparation_time_minutes
  )
  select
    v_restaurant_id,
    v_burgers_id,
    'Chicken Burger',
    'Crispy chicken burger with fresh vegetables',
    22000,
    20,
    true,
    1,
    15
  where not exists (
    select 1
    from public.menu_items
    where restaurant_id = v_restaurant_id
      and name = 'Chicken Burger'
  );

  -- ----------------------------------------------------------
  -- Veg Burger
  -- ₹180 = 18000 paise
  -- ----------------------------------------------------------

  insert into public.menu_items (
    restaurant_id,
    category_id,
    name,
    description,
    price_paise,
    stock_quantity,
    is_available,
    sort_order,
    preparation_time_minutes
  )
  select
    v_restaurant_id,
    v_burgers_id,
    'Veg Burger',
    'Vegetable patty with fresh vegetables',
    18000,
    20,
    true,
    2,
    10
  where not exists (
    select 1
    from public.menu_items
    where restaurant_id = v_restaurant_id
      and name = 'Veg Burger'
  );

  -- ----------------------------------------------------------
  -- Cold Coffee
  -- ₹120 = 12000 paise
  -- ----------------------------------------------------------

  insert into public.menu_items (
    restaurant_id,
    category_id,
    name,
    description,
    price_paise,
    stock_quantity,
    is_available,
    sort_order,
    preparation_time_minutes
  )
  select
    v_restaurant_id,
    v_drinks_id,
    'Cold Coffee',
    'Chilled coffee beverage',
    12000,
    30,
    true,
    1,
    5
  where not exists (
    select 1
    from public.menu_items
    where restaurant_id = v_restaurant_id
      and name = 'Cold Coffee'
  );

  -- ----------------------------------------------------------
  -- Lemon Soda
  -- ₹80 = 8000 paise
  -- ----------------------------------------------------------

  insert into public.menu_items (
    restaurant_id,
    category_id,
    name,
    description,
    price_paise,
    stock_quantity,
    is_available,
    sort_order,
    preparation_time_minutes
  )
  select
    v_restaurant_id,
    v_drinks_id,
    'Lemon Soda',
    'Refreshing lemon soda',
    8000,
    30,
    true,
    2,
    5
  where not exists (
    select 1
    from public.menu_items
    where restaurant_id = v_restaurant_id
      and name = 'Lemon Soda'
  );

end $$;