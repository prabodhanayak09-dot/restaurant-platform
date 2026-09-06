-- ============================================================
-- Migration 009: Secure Customer Menu RPC
-- ============================================================

create or replace function public.get_customer_menu(
  p_session_token uuid
)
returns table (
  category_id uuid,
  category_name text,
  category_description text,
  category_sort_order integer,

  item_id uuid,
  item_category_id uuid,
  item_name text,
  item_description text,
  item_price_paise bigint,
  item_image_url text,
  item_is_available boolean,
  item_sort_order integer,
  item_preparation_time_minutes integer,
  item_stock_quantity integer
)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    mc.id as category_id,
    mc.name as category_name,
    mc.description as category_description,
    mc.sort_order as category_sort_order,

    mi.id as item_id,
    mi.category_id as item_category_id,
    mi.name as item_name,
    mi.description as item_description,
    mi.price_paise as item_price_paise,
    mi.image_url as item_image_url,
    mi.is_available as item_is_available,
    mi.sort_order as item_sort_order,
    mi.preparation_time_minutes as item_preparation_time_minutes,
    mi.stock_quantity as item_stock_quantity

  from public.customer_sessions as cs

  inner join public.menu_categories as mc
    on mc.restaurant_id = cs.restaurant_id
   and mc.is_active = true

  inner join public.menu_items as mi
    on mi.restaurant_id = cs.restaurant_id
   and mi.category_id = mc.id
   and mi.is_available = true

  where cs.session_token = p_session_token
    and cs.status = 'active'
    and cs.expires_at > now()

  order by
    mc.sort_order asc,
    mc.name asc,
    mi.sort_order asc,
    mi.name asc;
$$;

revoke all on function public.get_customer_menu(uuid)
from public;

grant execute on function public.get_customer_menu(uuid)
to anon, authenticated;