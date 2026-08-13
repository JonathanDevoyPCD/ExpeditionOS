alter table public.adventures
  add column visibility text not null default 'private'
  check (visibility in ('private', 'public'));

create index adventures_public_updated_idx
  on public.adventures (updated_at desc)
  where visibility = 'public';

create policy adventures_select_public on public.adventures
for select to anon, authenticated
using (visibility = 'public');

alter table public.adventure_invitations
  alter column role set default 'viewer';

create or replace function public.invite_adventure_member(
  target_adventure_id text,
  target_email text,
  target_role text default 'viewer'
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
    raise exception 'Only the trip creator can invite members.';
  end if;
  if normalized_email = '' or target_role not in ('editor', 'viewer') then
    raise exception 'A valid email and permission are required.';
  end if;
  if normalized_email = lower(coalesce((select auth.jwt() ->> 'email'), '')) then
    raise exception 'The trip creator is already a member.';
  end if;

  insert into public.adventure_invitations (adventure_id, invitee_email, role, invited_by)
  values (target_adventure_id, normalized_email, target_role, (select auth.uid()))
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.set_adventure_visibility(
  target_adventure_id text,
  target_visibility text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_visibility not in ('private', 'public') then
    raise exception 'Visibility must be private or public.';
  end if;
  if not private.can_manage_adventure(target_adventure_id) then
    raise exception 'Only the trip creator can change visibility.';
  end if;

  update public.adventures
  set visibility = target_visibility,
      updated_at = now()
  where id = target_adventure_id;
end;
$$;

create or replace function public.set_adventure_member_role(
  target_adventure_id text,
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_role not in ('editor', 'viewer') then
    raise exception 'Permission must be contributor or viewer.';
  end if;
  if not private.can_manage_adventure(target_adventure_id) then
    raise exception 'Only the trip creator can change member permissions.';
  end if;

  update public.adventure_members
  set role = target_role,
      updated_at = now()
  where adventure_id = target_adventure_id
    and user_id = target_user_id
    and role <> 'owner'
    and status = 'accepted';

  if not found then
    raise exception 'Accepted trip member not found.';
  end if;
end;
$$;

grant select on public.adventures to anon;

revoke all on function public.set_adventure_visibility(text, text) from public, anon;
revoke all on function public.set_adventure_member_role(text, uuid, text) from public, anon;
grant execute on function public.set_adventure_visibility(text, text) to authenticated;
grant execute on function public.set_adventure_member_role(text, uuid, text) to authenticated;
