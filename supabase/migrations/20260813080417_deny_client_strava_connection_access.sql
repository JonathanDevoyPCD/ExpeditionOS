create policy strava_connections_deny_client_access on public.strava_connections
for all to authenticated
using (false)
with check (false);
