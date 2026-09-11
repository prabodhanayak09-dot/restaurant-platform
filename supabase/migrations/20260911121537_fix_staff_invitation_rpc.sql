-- Fix ambiguous restaurant_id references in the staff invitation RPC.
-- No schema changes are made here.

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
  -- 1. Verify caller is an active owner of this restaurant
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
  -- 2. Prevent concurrent requests from creating two invitations
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtext(p_restaurant_id::text)
  );

  -- ----------------------------------------------------------
  -- 3. Deactivate the expired invitation
  -- ----------------------------------------------------------

  update public.staff_invitations si
  set is_active = false
  where si.restaurant_id = p_restaurant_id
    and si.is_active = true
    and si.expires_at <= now();

  -- ----------------------------------------------------------
  -- 4. Reuse the current valid invitation
  -- ----------------------------------------------------------

  select si.*
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
  -- 5. Create a new invitation
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
  returning * into v_invitation;

  -- ----------------------------------------------------------
  -- 6. Load restaurant name
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
  -- 7. Return invitation
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

revoke all
on function public.get_or_create_staff_invitation(uuid)
from public;

grant execute
on function public.get_or_create_staff_invitation(uuid)
to authenticated;
