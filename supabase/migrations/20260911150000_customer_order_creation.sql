-- ============================================================
-- Customer order creation
-- ============================================================

create or replace function public.create_customer_order(
  p_session_token uuid,
  p_payment_method public.payment_method,
  p_items jsonb
)
returns table (
  order_id uuid,
  payment_id uuid,
  order_status public.order_status,
  payment_status public.payment_status,
  payment_method public.payment_method,
  total_paise bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_session_json jsonb;

  v_restaurant_id uuid;
  v_table_id uuid;
  v_customer_id uuid;

  v_order_id uuid;
  v_payment_id uuid;

  v_subtotal bigint := 0;
  v_line_total bigint;
  v_total bigint;

  v_item jsonb;
  v_item_id uuid;
  v_quantity integer;

  v_menu_item record;

  v_order_status public.order_status;
begin
  -- ----------------------------------------------------------
  -- Basic validation
  -- ----------------------------------------------------------

  if p_session_token is null then
    raise exception 'Customer session is required';
  end if;

  if p_payment_method is null then
    raise exception 'Payment method is required';
  end if;

  if p_payment_method not in ('upi', 'card', 'cash') then
    raise exception 'Invalid payment method';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart cannot be empty';
  end if;

  -- ----------------------------------------------------------
  -- Resolve customer session
  -- ----------------------------------------------------------

  select to_jsonb(s)
  into v_session_json
  from public.resolve_customer_session(p_session_token) as s
  limit 1;

  if v_session_json is null then
    raise exception 'Customer session is invalid or expired';
  end if;

  v_restaurant_id :=
    nullif(v_session_json ->> 'restaurant_id', '')::uuid;

  v_table_id :=
    nullif(v_session_json ->> 'table_id', '')::uuid;

  v_customer_id :=
    nullif(v_session_json ->> 'customer_id', '')::uuid;

  if v_restaurant_id is null
     or v_table_id is null
     or v_customer_id is null then
    raise exception
      'Customer session is missing required information';
  end if;

  -- ----------------------------------------------------------
  -- Validate every cart item against the real menu.
  -- Prices are ALWAYS read from the database.
  -- ----------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    if not (
      v_item ? 'id'
      and v_item ? 'quantity'
    ) then
      raise exception 'Invalid cart item';
    end if;

    if (v_item ->> 'id') !~
       '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      raise exception 'Invalid menu item ID';
    end if;

    if (v_item ->> 'quantity') !~ '^[0-9]+$' then
      raise exception 'Invalid item quantity';
    end if;

    v_item_id := (v_item ->> 'id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity < 1 or v_quantity > 99 then
      raise exception 'Item quantity must be between 1 and 99';
    end if;

    select
      mi.id,
      mi.name,
      mi.price_paise,
      mi.stock_quantity
    into v_menu_item
    from public.menu_items mi
    where mi.id = v_item_id
      and mi.restaurant_id = v_restaurant_id
      and mi.is_available = true
    for update;

    if v_menu_item.id is null then
      raise exception
        'One or more selected menu items are no longer available';
    end if;

    if v_menu_item.stock_quantity is not null
       and v_menu_item.stock_quantity < v_quantity then
      raise exception
        'Not enough stock for %',
        v_menu_item.name;
    end if;

    v_line_total :=
      v_menu_item.price_paise * v_quantity;

    v_subtotal :=
      v_subtotal + v_line_total;
  end loop;

  v_total := v_subtotal;

  -- ----------------------------------------------------------
  -- Cash orders can be accepted before payment.
  --
  -- UPI/Card remain payment-pending until the actual gateway
  -- verifies payment.
  -- ----------------------------------------------------------

  if p_payment_method = 'cash' then
    v_order_status := 'pending_acceptance';
  else
    v_order_status := 'pending_payment';
  end if;

  -- ----------------------------------------------------------
  -- Create order
  -- ----------------------------------------------------------

  insert into public.orders (
    restaurant_id,
    table_id,
    customer_id,
    status,
    subtotal_paise,
    tax_paise,
    discount_paise,
    total_paise
  )
  values (
    v_restaurant_id,
    v_table_id,
    v_customer_id,
    v_order_status,
    v_subtotal,
    0,
    0,
    v_total
  )
  returning id into v_order_id;

  -- ----------------------------------------------------------
  -- Create order item snapshots
  -- ----------------------------------------------------------

  for v_item in
    select value
    from jsonb_array_elements(p_items)
  loop
    v_item_id := (v_item ->> 'id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;

    select
      mi.id,
      mi.name,
      mi.price_paise
    into v_menu_item
    from public.menu_items mi
    where mi.id = v_item_id
      and mi.restaurant_id = v_restaurant_id
      and mi.is_available = true;

    if v_menu_item.id is null then
      raise exception
        'Menu item became unavailable during checkout';
    end if;

    v_line_total :=
      v_menu_item.price_paise * v_quantity;

    insert into public.order_items (
      restaurant_id,
      order_id,
      menu_item_id,
      item_name,
      unit_price_paise,
      quantity,
      total_price_paise
    )
    values (
      v_restaurant_id,
      v_order_id,
      v_menu_item.id,
      v_menu_item.name,
      v_menu_item.price_paise,
      v_quantity,
      v_line_total
    );
  end loop;

  -- ----------------------------------------------------------
  -- Create payment
  -- ----------------------------------------------------------

  insert into public.payments (
    restaurant_id,
    order_id,
    method,
    status,
    amount_paise
  )
  values (
    v_restaurant_id,
    v_order_id,
    p_payment_method,
    'pending',
    v_total
  )
  returning id into v_payment_id;

  -- ----------------------------------------------------------
  -- Return created order + payment
  -- ----------------------------------------------------------

  return query
  select
    o.id,
    p.id,
    o.status,
    p.status,
    p.method,
    o.total_paise
  from public.orders o
  join public.payments p
    on p.order_id = o.id
  where o.id = v_order_id;
end;
$$;

revoke all on function public.create_customer_order(
  uuid,
  public.payment_method,
  jsonb
)
from public;

grant execute on function public.create_customer_order(
  uuid,
  public.payment_method,
  jsonb
)
to anon, authenticated;
