-- Staff invitations
create table public.staff_invitations (
  id uuid primary key default gen_random_uuid(),

  restaurant_id uuid not null
    references public.restaurants(id)
    on delete cascade,

  token text not null unique,

  expires_at timestamptz not null,

  used_at timestamptz,

  is_active boolean not null default true,

  created_by uuid references auth.users(id),

  created_at timestamptz not null default now()
);

-- Indexes
create index staff_invitations_token_idx
  on public.staff_invitations(token);

create index staff_invitations_restaurant_id_idx
  on public.staff_invitations(restaurant_id);

-- Enable Row Level Security
alter table public.staff_invitations enable row level security;

-- Restaurant owners can view invitations belonging to their restaurant
create policy "Restaurant owners can view staff invitations"
on public.staff_invitations
for select
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = staff_invitations.restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  )
);

-- Restaurant owners can create invitations
create policy "Restaurant owners can create staff invitations"
on public.staff_invitations
for insert
to authenticated
with check (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = staff_invitations.restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  )
);

-- Restaurant owners can update invitations
create policy "Restaurant owners can update staff invitations"
on public.staff_invitations
for update
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = staff_invitations.restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  )
)
with check (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = staff_invitations.restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  )
);

-- Restaurant owners can delete invitations
create policy "Restaurant owners can delete staff invitations"
on public.staff_invitations
for delete
to authenticated
using (
  exists (
    select 1
    from public.restaurant_members rm
    where rm.user_id = auth.uid()
      and rm.restaurant_id = staff_invitations.restaurant_id
      and rm.role = 'owner'
      and rm.is_active = true
  )
);
