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
    values (invitation_record.adventure_id, (select auth.uid()), invitation_record.role, 'accepted', invitation_record.invited_by);
  end if;

  update public.adventure_invitations
  set status = case when accept_invitation then 'accepted' else 'declined' end,
      responded_at = now()
  where id = target_invitation_id;

  return invitation_record.adventure_id;
end;
$$;
