-- ============================================================
-- Migration: Payment methods and final restaurant order flow
-- ============================================================

-- ------------------------------------------------------------
-- PAYMENT METHOD
-- ------------------------------------------------------------

create type public.payment_method as enum (
  'upi',
  'card',
  'cash'
);

-- ------------------------------------------------------------
-- PAYMENT STATUS
-- ------------------------------------------------------------

create type public.payment_status as enum (
  'pending',
  'paid',
  'failed',
  'refunded'
);

-- ------------------------------------------------------------
-- ORDER STATUS
--
-- pending_acceptance:
-- Customer has submitted the order and it is waiting for staff.
--
-- preparing:
-- Staff has accepted/confirmed the order and kitchen preparation
-- is underway.
-- ------------------------------------------------------------

alter type public.order_status
add value if not exists 'pending_acceptance';

-- ------------------------------------------------------------
-- PAYMENTS
--
-- One payment record belongs to one order.
--
-- NEVER store raw card number, CVV, PIN, or other sensitive
-- card credentials here.
-- ------------------------------------------------------------

create table public.payments (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete restrict,

  order_id uuid not null,

  method public.payment_method not null,

  status public.payment_status not null
    default 'pending',

  amount_paise bigint not null
    check (amount_paise >= 0),

  gateway text,

  gateway_payment_id text,

  gateway_order_id text,

  paid_at timestamptz,

  created_at timestamptz not null default now(),

  updated_at timestamptz not null default now(),

  unique (order_id),

  constraint payments_order_same_restaurant_fk
  foreign key (order_id, restaurant_id)
  references public.orders(id, restaurant_id)
  on delete restrict,

  constraint payments_paid_at_check
  check (
    (status = 'paid' and paid_at is not null)
    or
    (status <> 'paid')
  )
);

create index payments_restaurant_id_idx
  on public.payments(restaurant_id);

create index payments_order_id_idx
  on public.payments(order_id);

create index payments_status_idx
  on public.payments(restaurant_id, status);

create index payments_method_idx
  on public.payments(restaurant_id, method);

create index payments_gateway_payment_id_idx
  on public.payments(gateway_payment_id);

-- ------------------------------------------------------------
-- UPDATED_AT TRIGGER
-- ------------------------------------------------------------

drop trigger if exists payments_set_updated_at
on public.payments;

create trigger payments_set_updated_at
before update on public.payments
for each row
execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------

alter table public.payments enable row level security;

create policy "restaurant members can view payments"
on public.payments
for select
to authenticated
using (
  public.is_restaurant_member(restaurant_id)
);

-- No direct INSERT/UPDATE/DELETE policies are intentionally
-- created here.
--
-- Payment creation and payment-state changes must happen through
-- controlled server-side operations.

-- ------------------------------------------------------------
-- STAFF ORDER TRANSITION FUNCTION
--
-- ONLINE:
--   UPI/Card must already be PAID.
--
-- CASH:
--   Payment may still be PENDING.
--
-- In both cases, staff moves the order:
--
--   pending_acceptance -> preparing
--
-- This represents staff acceptance/confirmation and starts
-- preparation.
-- ------------------------------------------------------------

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
  v_payment public.payments;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = p_order_id
  for update;

  if not found then
    raise exception 'Order not found';
  end if;

  select *
  into v_membership
  from public.restaurant_members rm
  where rm.user_id = v_user_id
    and rm.restaurant_id = v_order.restaurant_id
    and rm.role = 'staff'
    and rm.is_active = true
  limit 1;

  if not found then
    raise exception 'Staff access required';
  end if;

  select *
  into v_payment
  from public.payments p
  where p.order_id = v_order.id
    and p.restaurant_id = v_order.restaurant_id;

  -- ----------------------------------------------------------
  -- ACCEPT / CONFIRM ORDER
  -- ----------------------------------------------------------

  if p_new_status = 'preparing' then

    if v_order.status <> 'pending_acceptance' then
      raise exception
        'Order cannot be accepted from status %',
        v_order.status;
    end if;

    if v_payment.id is null then
      raise exception 'Payment record not found';
    end if;

    -- UPI/Card:
    -- Must already be paid.
    if v_payment.method in ('upi', 'card')
       and v_payment.status <> 'paid' then
      raise exception
        'Online payment must be completed before accepting the order';
    end if;

    -- Cash:
    -- Payment may remain pending because the customer pays
    -- after eating.

    update public.orders
    set
      status = 'preparing',
      accepted_at = coalesce(accepted_at, now()),
      preparing_at = coalesce(preparing_at, now()),
      updated_at = now()
    where id = p_order_id;

  -- ----------------------------------------------------------
  -- MARK READY
  -- ----------------------------------------------------------

  elsif p_new_status = 'ready' then

    if v_order.status <> 'preparing' then
      raise exception
        'Order cannot be marked ready from status %',
        v_order.status;
    end if;

    update public.orders
    set
      status = 'ready',
      ready_at = coalesce(ready_at, now()),
      updated_at = now()
    where id = p_order_id;

  -- ----------------------------------------------------------
  -- MARK SERVED
  -- ----------------------------------------------------------

  elsif p_new_status = 'served' then

    if v_order.status <> 'ready' then
      raise exception
        'Order cannot be marked served from status %',
        v_order.status;
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
  from public.orders o
  where o.id = p_order_id;

  return v_order;
end;
$$;

revoke all on function public.staff_update_order_status(
  uuid,
  public.order_status
)
from public;

grant execute on function public.staff_update_order_status(
  uuid,
  public.order_status
)
to authenticated;

-- ------------------------------------------------------------
-- CASH PAYMENT CONFIRMATION
--
-- Only staff of the same restaurant can confirm a cash payment.
--
-- This is deliberately separate from order status.
-- A cash order can be SERVED while payment is still PENDING.
-- ------------------------------------------------------------

create or replace function public.staff_confirm_cash_payment(
  p_order_id uuid
)
returns public.payments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_order public.orders;
  v_payment public.payments;
  v_membership public.restaurant_members;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select *
  into v_order
  from public.orders o
  where o.id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;

  select *
  into v_membership
  from public.restaurant_members rm
  where rm.user_id = v_user_id
    and rm.restaurant_id = v_order.restaurant_id
    and rm.role = 'staff'
    and rm.is_active = true
  limit 1;

  if not found then
    raise exception 'Staff access required';
  end if;

  select *
  into v_payment
  from public.payments p
  where p.order_id = v_order.id
    and p.restaurant_id = v_order.restaurant_id
  for update;

  if not found then
    raise exception 'Payment record not found';
  end if;

  if v_payment.method <> 'cash' then
    raise exception 'Only cash payments can be confirmed by staff';
  end if;

  if v_payment.status <> 'pending' then
    raise exception
      'Cash payment is not pending; current status is %',
      v_payment.status;
  end if;

  update public.payments
  set
    status = 'paid',
    paid_at = now(),
    updated_at = now()
  where id = v_payment.id
  returning *
  into v_payment;

  return v_payment;
end;
$$;

revoke all on function public.staff_confirm_cash_payment(uuid)
from public;

grant execute on function public.staff_confirm_cash_payment(uuid)
to authenticated;

-- ------------------------------------------------------------
-- PAYMENT AMOUNT MUST MATCH ORDER TOTAL
-- ------------------------------------------------------------

create or replace function public.validate_payment_amount()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_total bigint;
begin
  select total_paise
  into v_order_total
  from public.orders
  where id = new.order_id
    and restaurant_id = new.restaurant_id;

  if v_order_total is null then
    raise exception 'Order not found for payment';
  end if;

  if new.amount_paise <> v_order_total then
    raise exception
      'Payment amount % does not match order total %',
      new.amount_paise,
      v_order_total;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_validate_amount
on public.payments;

create trigger payments_validate_amount
before insert or update on public.payments
for each row
execute function public.validate_payment_amount();

revoke all on function public.validate_payment_amount()
from public;
