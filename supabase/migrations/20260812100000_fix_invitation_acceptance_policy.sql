create or replace function private.has_pending_adventure_invitation(
  target_adventure_id text,
  target_role text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.adventure_invitations invitation
    where invitation.adventure_id = target_adventure_id
      and lower(invitation.invitee_email) = lower(coalesce(((select auth.jwt()) ->> 'email'), ''))
      and invitation.status = 'pending'
      and invitation.role = target_role
  );
$$;

revoke all on function private.has_pending_adventure_invitation(text, text) from public, anon;
grant execute on function private.has_pending_adventure_invitation(text, text) to authenticated;

drop policy adventure_members_insert_invitee on public.adventure_members;
create policy adventure_members_insert_invitee on public.adventure_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'accepted'
  and role in ('editor', 'viewer')
  and private.has_pending_adventure_invitation(adventure_id, role)
);
