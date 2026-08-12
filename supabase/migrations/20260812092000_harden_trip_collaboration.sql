create index adventures_owner_idx on public.adventures (owner_id);
create index adventure_members_added_by_idx on public.adventure_members (added_by);
create index adventure_invitations_invited_by_idx on public.adventure_invitations (invited_by);

drop policy adventure_invitations_select on public.adventure_invitations;
create policy adventure_invitations_select on public.adventure_invitations for select to authenticated
using (
  private.can_manage_adventure(adventure_id)
  or lower(invitee_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
);

create policy adventure_invitations_insert on public.adventure_invitations for insert to authenticated
with check (
  private.can_manage_adventure(adventure_id)
  and invited_by = (select auth.uid())
  and status = 'pending'
);

create policy adventure_invitations_update_invitee on public.adventure_invitations for update to authenticated
using (
  status = 'pending'
  and lower(invitee_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
)
with check (
  lower(invitee_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
  and status in ('accepted', 'declined')
);

create policy adventure_members_insert_invitee on public.adventure_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'accepted'
  and role in ('editor', 'viewer')
  and exists (
    select 1
    from public.adventure_invitations invitation
    where invitation.adventure_id = adventure_members.adventure_id
      and lower(invitation.invitee_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
      and invitation.status = 'pending'
      and invitation.role = adventure_members.role
  )
);

create policy adventure_members_delete_owner on public.adventure_members for delete to authenticated
using (role <> 'owner' and private.can_manage_adventure(adventure_id));

alter function public.invite_adventure_member(text, text, text) security invoker;
alter function public.respond_to_adventure_invitation(uuid, boolean) security invoker;
alter function public.remove_adventure_member(text, uuid) security invoker;

create or replace function public.respond_to_adventure_invitation(
  target_invitation_id uuid,
  accept_invitation boolean
)
returns text
language plpgsql
security invoker
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
    or lower(invitation_record.invitee_email) <> lower(coalesce(((select auth.jwt()) ->> 'email'), '')) then
    raise exception 'This invitation is not available to the signed-in user.';
  end if;

  if accept_invitation then
    insert into public.adventure_members (adventure_id, user_id, role, status, added_by)
    values (invitation_record.adventure_id, (select auth.uid()), invitation_record.role, 'accepted', invitation_record.invited_by)
    on conflict (adventure_id, user_id) do nothing;
  end if;

  update public.adventure_invitations
  set status = case when accept_invitation then 'accepted' else 'declined' end,
      responded_at = now()
  where id = target_invitation_id;

  return invitation_record.adventure_id;
end;
$$;

grant insert, delete on public.adventure_members to authenticated;
grant insert on public.adventure_invitations to authenticated;
grant update (status, responded_at) on public.adventure_invitations to authenticated;
