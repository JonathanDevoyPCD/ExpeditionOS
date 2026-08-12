create schema if not exists private;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  display_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_private_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email text,
  phone text,
  preferred_otp_channel text not null default 'email' check (preferred_otp_channel in ('email', 'sms')),
  phone_verified boolean not null default false,
  gender text check (gender is null or gender in ('female', 'male', 'non_binary', 'prefer_not_to_say', 'self_described')),
  gender_description text,
  date_of_birth date,
  address_line_1 text,
  address_line_2 text,
  city text,
  province text,
  country text not null default 'South Africa',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profile_private_details_email_unique
  on public.profile_private_details (lower(email))
  where email is not null and email <> '';

create table public.profile_travel_documents (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  sa_id_number text,
  passport_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_emergency_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  emergency_contact_name text,
  emergency_contact_phone text,
  medical_aid_name text,
  medical_aid_number text,
  blood_type text check (blood_type is null or blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown')),
  allergies text,
  doctor_name text,
  doctor_phone text,
  additional_information text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adventures (
  id text primary key,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text not null default '',
  source text not null check (source in ('gpx', 'manual', 'copilot')),
  days integer not null default 1 check (days between 1 and 365),
  route jsonb not null,
  anchors jsonb not null default '[]'::jsonb,
  blueprint jsonb,
  preferences jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.adventure_members (
  adventure_id text not null references public.adventures(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  status text not null default 'accepted' check (status in ('accepted', 'removed')),
  share_emergency_profile boolean not null default false,
  added_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (adventure_id, user_id)
);

create index adventure_members_user_idx on public.adventure_members (user_id, status);

create table public.adventure_invitations (
  id uuid primary key default gen_random_uuid(),
  adventure_id text not null references public.adventures(id) on delete cascade,
  invitee_email text not null,
  role text not null check (role in ('editor', 'viewer')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'revoked')),
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create unique index adventure_invitations_pending_unique
  on public.adventure_invitations (adventure_id, lower(invitee_email))
  where status = 'pending';

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger profile_private_details_touch_updated_at before update on public.profile_private_details
for each row execute function private.touch_updated_at();
create trigger profile_travel_documents_touch_updated_at before update on public.profile_travel_documents
for each row execute function private.touch_updated_at();
create trigger profile_emergency_details_touch_updated_at before update on public.profile_emergency_details
for each row execute function private.touch_updated_at();
create trigger adventures_touch_updated_at before update on public.adventures
for each row execute function private.touch_updated_at();
create trigger adventure_members_touch_updated_at before update on public.adventure_members
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  first_name_value text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  last_name_value text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
  otp_channel_value text := case
    when new.raw_user_meta_data ->> 'preferred_otp_channel' = 'sms' then 'sms'
    else 'email'
  end;
begin
  insert into public.profiles (id, first_name, last_name, display_name)
  values (new.id, first_name_value, last_name_value, trim(first_name_value || ' ' || last_name_value));

  insert into public.profile_private_details (user_id, email, phone, preferred_otp_channel, phone_verified)
  values (new.id, lower(coalesce(new.email, new.raw_user_meta_data ->> 'email')), coalesce(new.phone, new.raw_user_meta_data ->> 'phone'), otp_channel_value, new.phone_confirmed_at is not null);

  insert into public.profile_travel_documents (user_id) values (new.id);
  insert into public.profile_emergency_details (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.sync_auth_contact()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profile_private_details
  set email = lower(coalesce(new.email, email)),
      phone = coalesce(new.phone, phone),
      phone_verified = new.phone_confirmed_at is not null
  where user_id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_contact_changed
after update of email, phone, phone_confirmed_at on auth.users
for each row execute function private.sync_auth_contact();

create or replace function private.ensure_adventure_owner_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.adventure_members (adventure_id, user_id, role, status, added_by)
  values (new.id, new.owner_id, 'owner', 'accepted', new.owner_id)
  on conflict (adventure_id, user_id) do update set role = 'owner', status = 'accepted';
  return new;
end;
$$;

create trigger on_adventure_created
after insert on public.adventures
for each row execute function private.ensure_adventure_owner_member();

create or replace function private.prevent_adventure_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'The adventure owner cannot be changed.';
  end if;
  return new;
end;
$$;

create trigger adventures_prevent_owner_change
before update on public.adventures
for each row execute function private.prevent_adventure_owner_change();

create or replace function private.can_access_adventure(target_adventure_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.adventures a
      where a.id = target_adventure_id and a.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.adventure_members m
      where m.adventure_id = target_adventure_id
        and m.user_id = (select auth.uid())
        and m.status = 'accepted'
    )
  );
$$;

create or replace function private.can_edit_adventure(target_adventure_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and (
    exists (
      select 1 from public.adventures a
      where a.id = target_adventure_id and a.owner_id = (select auth.uid())
    )
    or exists (
      select 1 from public.adventure_members m
      where m.adventure_id = target_adventure_id
        and m.user_id = (select auth.uid())
        and m.status = 'accepted'
        and m.role = 'editor'
    )
  );
$$;

create or replace function private.can_manage_adventure(target_adventure_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.adventures a
    where a.id = target_adventure_id and a.owner_id = (select auth.uid())
  );
$$;

create or replace function private.shares_trip_with(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_user_id or exists (
    select 1
    from public.adventure_members mine
    join public.adventure_members theirs on theirs.adventure_id = mine.adventure_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'accepted'
      and theirs.user_id = target_user_id
      and theirs.status = 'accepted'
  );
$$;

create or replace function private.can_view_emergency(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) = target_user_id or exists (
    select 1
    from public.adventure_members mine
    join public.adventure_members theirs on theirs.adventure_id = mine.adventure_id
    where mine.user_id = (select auth.uid())
      and mine.status = 'accepted'
      and theirs.user_id = target_user_id
      and theirs.status = 'accepted'
      and theirs.share_emergency_profile
  );
$$;

alter table public.profiles enable row level security;
alter table public.profile_private_details enable row level security;
alter table public.profile_travel_documents enable row level security;
alter table public.profile_emergency_details enable row level security;
alter table public.adventures enable row level security;
alter table public.adventure_members enable row level security;
alter table public.adventure_invitations enable row level security;

create policy profiles_select on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.shares_trip_with(id));
create policy profiles_insert on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);
create policy profiles_update on public.profiles for update to authenticated
using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy profile_private_details_select on public.profile_private_details for select to authenticated
using ((select auth.uid()) = user_id);
create policy profile_private_details_insert on public.profile_private_details for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy profile_private_details_update on public.profile_private_details for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy profile_travel_documents_select on public.profile_travel_documents for select to authenticated
using ((select auth.uid()) = user_id);
create policy profile_travel_documents_insert on public.profile_travel_documents for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy profile_travel_documents_update on public.profile_travel_documents for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy profile_emergency_details_select on public.profile_emergency_details for select to authenticated
using ((select auth.uid()) = user_id or private.can_view_emergency(user_id));
create policy profile_emergency_details_insert on public.profile_emergency_details for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy profile_emergency_details_update on public.profile_emergency_details for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy adventures_select on public.adventures for select to authenticated
using (private.can_access_adventure(id));
create policy adventures_insert on public.adventures for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy adventures_update on public.adventures for update to authenticated
using (private.can_edit_adventure(id)) with check (private.can_edit_adventure(id));
create policy adventures_delete on public.adventures for delete to authenticated
using (private.can_manage_adventure(id));

create policy adventure_members_select on public.adventure_members for select to authenticated
using (private.can_access_adventure(adventure_id));
create policy adventure_members_update_own on public.adventure_members for update to authenticated
using ((select auth.uid()) = user_id and status = 'accepted')
with check ((select auth.uid()) = user_id and status = 'accepted');

create policy adventure_invitations_select on public.adventure_invitations for select to authenticated
using (
  private.can_manage_adventure(adventure_id)
  or lower(invitee_email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
);

create or replace function public.invite_adventure_member(
  target_adventure_id text,
  target_email text,
  target_role text default 'editor'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_id uuid;
  normalized_email text := lower(trim(target_email));
begin
  if not private.can_manage_adventure(target_adventure_id) then
    raise exception 'Only the trip owner can invite members.';
  end if;
  if normalized_email = '' or target_role not in ('editor', 'viewer') then
    raise exception 'A valid email and role are required.';
  end if;
  if normalized_email = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'The trip owner is already a member.';
  end if;

  insert into public.adventure_invitations (adventure_id, invitee_email, role, invited_by)
  values (target_adventure_id, normalized_email, target_role, (select auth.uid()))
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.respond_to_adventure_invitation(
  target_invitation_id uuid,
  accept_invitation boolean
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_record public.adventure_invitations%rowtype;
begin
  select * into invitation_record
  from public.adventure_invitations
  where id = target_invitation_id and status = 'pending'
  for update;

  if invitation_record.id is null
    or lower(invitation_record.invitee_email) <> lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'This invitation is not available to the signed-in user.';
  end if;

  update public.adventure_invitations
  set status = case when accept_invitation then 'accepted' else 'declined' end,
      responded_at = now()
  where id = target_invitation_id;

  if accept_invitation then
    insert into public.adventure_members (adventure_id, user_id, role, status, added_by)
    values (invitation_record.adventure_id, (select auth.uid()), invitation_record.role, 'accepted', invitation_record.invited_by)
    on conflict (adventure_id, user_id) do update
      set role = excluded.role, status = 'accepted', added_by = excluded.added_by;
  end if;

  return invitation_record.adventure_id;
end;
$$;

create or replace function public.remove_adventure_member(
  target_adventure_id text,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.can_manage_adventure(target_adventure_id) then
    raise exception 'Only the trip owner can remove members.';
  end if;
  if target_user_id = (select auth.uid()) then
    raise exception 'The trip owner cannot remove themselves.';
  end if;
  delete from public.adventure_members
  where adventure_id = target_adventure_id and user_id = target_user_id and role <> 'owner';
end;
$$;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

revoke all on public.profiles, public.profile_private_details, public.profile_travel_documents,
  public.profile_emergency_details, public.adventures, public.adventure_members,
  public.adventure_invitations from anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.profile_private_details to authenticated;
grant select, insert, update on public.profile_travel_documents to authenticated;
grant select, insert, update on public.profile_emergency_details to authenticated;
grant select, insert, delete on public.adventures to authenticated;
grant update (name, description, source, days, route, anchors, blueprint, preferences, updated_at)
  on public.adventures to authenticated;
grant select on public.adventure_members to authenticated;
grant update (share_emergency_profile) on public.adventure_members to authenticated;
grant select on public.adventure_invitations to authenticated;

revoke all on function public.invite_adventure_member(text, text, text) from public, anon;
revoke all on function public.respond_to_adventure_invitation(uuid, boolean) from public, anon;
revoke all on function public.remove_adventure_member(text, uuid) from public, anon;
grant execute on function public.invite_adventure_member(text, text, text) to authenticated;
grant execute on function public.respond_to_adventure_invitation(uuid, boolean) to authenticated;
grant execute on function public.remove_adventure_member(text, uuid) to authenticated;
