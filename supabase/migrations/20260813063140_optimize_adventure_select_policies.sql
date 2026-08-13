drop policy adventures_select on public.adventures;
drop policy adventures_select_public on public.adventures;

create policy adventures_select on public.adventures
for select to authenticated
using (visibility = 'public' or private.can_access_adventure(id));

create policy adventures_select_public on public.adventures
for select to anon
using (visibility = 'public');
