-- ============================================================
-- Migration: Reusable staff invitation QR with 24-hour rotation
-- ============================================================


-- ------------------------------------------------------------
-- 1. Temporarily remove the existing broken updated_at trigger
--
-- The current staff_invitations table does not have an
-- updated_at column, but this trigger expects one.
-- ------------------------------------------------------------

drop trigger if exists staff_invitations_set_updated_at
on public.staff_invitations;


-- ------------------------------------------------------------
-- 2. Add updated_at to staff_invitations
-- ------------------------------------------------------------

alter table public.staff_invitations
add column if not exists updated_at timestamptz;


-- Populate existing rows before making the column NOT NULL.

update public.staff_invitations
set updated_at = coalesce(created_at, now())
where updated_at is null;


alter table public.staff_invitations
alter column updated_at set default now();


alter table public.staff_invitations
alter column updated_at set not null;


-- ------------------------------------------------------------
-- 3. Re-create the updated_at trigger
--
-- The trigger function already exists in the database.
-- ------------------------------------------------------------

create trigger staff_invitations_set_updated_at
before update on public.staff_invitations
for each row
execute function public.set_updated_at();


-- ------------------------------------------------------------
-- 4. Ensure expires_at defaults to 24 hours
-- ------------------------------------------------------------

alter table public.staff_invitations
alter column expires_at
set default (now() + interval '24 hours');


-- ------------------------------------------------------------
-- 5. Expire old invitations
-- ------------------------------------------------------------

update public.staff_invitations
set is_active = false
where is_active = true
  and expires_at <= now();


-- ------------------------------------------------------------
-- 6. Clean up duplicate active invitations
--
-- Keep only the newest active invitation for each restaurant.
-- ------------------------------------------------------------

with ranked as (
  select
    id,
    row_number() over (
      partition by restaurant_id
      order by created_at desc, id desc
    ) as rn
  from public.staff_invitations
  where is_active = true
)
update public.staff_invitations si
set is_active = false
from ranked r
where si.id = r.id
  and r.rn > 1;


-- ------------------------------------------------------------
-- 7. Only one active invitation per restaurant
-- ------------------------------------------------------------

create unique index if not exists
staff_invitations_one_active_per_restaurant_idx
on public.staff_invitations (restaurant_id)
where is_active = true;


-- ============================================================
-- 8. OWNER RPC
--
-- Returns the current staff QR.
--
-- Same QR:
--   - can be used by unlimited staff members
--   - remains valid for 24 hours
--
-- After expiry:
--   - old QR becomes inactive
--   - next request creates a new UUID token
-- ============================================================

create or replace function public.get_or_create_staff_invitation(
  p_restaurant_id uuid
)
returns table (
  id uuid,
  restaurant_id uuid,
  token uuid,
  expires_at timestamptz,
  restaurant_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.staff_invitations%rowtype;
  v_restaurant_name text;
begin

  -- ----------------------------------------------------------
  -- Verify authenticated caller owns this restaurant
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = p_restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  ) then
    raise exception 'Not authorized to manage staff invitations';
  end if;


  -- ----------------------------------------------------------
  -- Prevent concurrent rotation
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(p_restaurant_id::text, 0)
  );


  -- ----------------------------------------------------------
  -- Expire the old invitation
  -- ----------------------------------------------------------

  update public.staff_invitations
  set
    is_active = false
  where restaurant_id = p_restaurant_id
    and is_active = true
    and expires_at <= now();


  -- ----------------------------------------------------------
  -- Reuse current valid invitation
  -- ----------------------------------------------------------

  select *
  into v_invitation
  from public.staff_invitations si
  where si.restaurant_id = p_restaurant_id
    and si.is_active = true
    and si.expires_at > now()
  order by si.created_at desc
  limit 1;


  if found then

    select r.name
    into v_restaurant_name
    from public.restaurants r
    where r.id = p_restaurant_id
      and r.is_active = true;

    if v_restaurant_name is null then
      raise exception 'Restaurant is unavailable';
    end if;


    return query
    select
      v_invitation.id,
      v_invitation.restaurant_id,
      v_invitation.token,
      v_invitation.expires_at,
      v_restaurant_name;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Create new invitation
  --
  -- token is UUID in the actual database.
  -- ----------------------------------------------------------

  insert into public.staff_invitations (
    restaurant_id,
    token,
    expires_at,
    used_at,
    is_active,
    created_by
  )
  values (
    p_restaurant_id,
    gen_random_uuid(),
    now() + interval '24 hours',
    null,
    true,
    auth.uid()
  )
  returning *
  into v_invitation;


  -- ----------------------------------------------------------
  -- Get restaurant name
  -- ----------------------------------------------------------

  select r.name
  into v_restaurant_name
  from public.restaurants r
  where r.id = p_restaurant_id
    and r.is_active = true;


  if v_restaurant_name is null then
    raise exception 'Restaurant is unavailable';
  end if;


  -- ----------------------------------------------------------
  -- Return new invitation
  -- ----------------------------------------------------------

  return query
  select
    v_invitation.id,
    v_invitation.restaurant_id,
    v_invitation.token,
    v_invitation.expires_at,
    v_restaurant_name;

end;
$$;


-- ------------------------------------------------------------
-- 9. Secure owner RPC permissions
-- ------------------------------------------------------------

revoke all
on function public.get_or_create_staff_invitation(uuid)
from public;

grant execute
on function public.get_or_create_staff_invitation(uuid)
to authenticated;


-- ============================================================
-- 10. PUBLIC RPC
--
-- Allows an anonymous staff member to validate a QR token.
--
-- IMPORTANT:
-- used_at is NOT checked and is NOT modified.
-- Therefore the same QR can register unlimited staff members
-- during its 24-hour validity period.
-- ============================================================

create or replace function public.get_staff_invitation(
  p_token uuid
)
returns table (
  id uuid,
  restaurant_id uuid,
  token uuid,
  expires_at timestamptz,
  restaurant_name text
)
language sql
security definer
set search_path = public
as $$
  select
    si.id,
    si.restaurant_id,
    si.token,
    si.expires_at,
    r.name as restaurant_name
  from public.staff_invitations si
  inner join public.restaurants r
    on r.id = si.restaurant_id
  where si.token = p_token
    and si.is_active = true
    and si.expires_at > now()
    and r.is_active = true
  limit 1;
$$;


-- ------------------------------------------------------------
-- 11. Public lookup permissions
-- ------------------------------------------------------------

revoke all
on function public.get_staff_invitation(uuid)
from public;

grant execute
on function public.get_staff_invitation(uuid)
to anon;

grant execute
on function public.get_staff_invitation(uuid)
to authenticated;


-- ------------------------------------------------------------
-- 12. Explicit search_path
-- ------------------------------------------------------------

alter function public.get_or_create_staff_invitation(uuid)
set search_path = public;

alter function public.get_staff_invitation(uuid)
set search_path = public;
