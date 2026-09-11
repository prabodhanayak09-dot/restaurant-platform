-- Staff-controlled order status transitions.
-- Staff can move:
-- pending_payment/confirmed -> preparing
-- preparing -> ready
-- ready -> served

create or replace function public.staff_update_order_status(
  p_order_id uuid,
  p_new_status public.order_status
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order public.orders;
  v_membership public.restaurant_members;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select *
  into v_membership
  from public.restaurant_members
  where user_id = v_user_id
    and restaurant_id = v_order.restaurant_id
    and role = 'staff'
    and is_active = true
  limit 1;

  if not found then
    raise exception 'Staff access required';
  end if;

  if p_new_status = 'preparing' then
    if v_order.status not in ('confirmed', 'pending_payment') then
      raise exception 'Order cannot be moved to preparing from status %', v_order.status;
    end if;

    update public.orders
    set
      status = 'preparing',
      accepted_at = coalesce(accepted_at, now()),
      preparing_at = coalesce(preparing_at, now()),
      updated_at = now()
    where id = p_order_id;

  elsif p_new_status = 'ready' then
    if v_order.status <> 'preparing' then
      raise exception 'Order cannot be moved to ready from status %', v_order.status;
    end if;

    update public.orders
    set
      status = 'ready',
      ready_at = coalesce(ready_at, now()),
      updated_at = now()
    where id = p_order_id;

  elsif p_new_status = 'served' then
    if v_order.status <> 'ready' then
      raise exception 'Order cannot be moved to served from status %', v_order.status;
    end if;

    update public.orders
    set
      status = 'served',
      served_at = coalesce(served_at, now()),
      updated_at = now()
    where id = p_order_id;

  else
    raise exception 'Invalid staff status transition';
  end if;

  select *
  into v_order
  from public.orders
  where id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.staff_update_order_status(uuid, public.order_status)
from public;

grant execute on function public.staff_update_order_status(uuid, public.order_status)
to authenticated;
