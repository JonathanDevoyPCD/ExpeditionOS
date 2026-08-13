create table public.strava_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_id bigint not null unique,
  athlete_name text not null default '',
  athlete_avatar_url text,
  scopes text[] not null default '{}',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  access_token_expires_at timestamptz not null,
  last_synced_at timestamptz,
  last_sync_status text not null default 'idle' check (last_sync_status in ('idle', 'syncing', 'success', 'error')),
  last_sync_error text,
  rate_limit_15m_used integer,
  rate_limit_daily_used integer,
  rate_limit_15m_limit integer,
  rate_limit_daily_limit integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strava_activities (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_id bigint not null,
  athlete_id bigint not null,
  name text not null,
  sport_type text not null,
  start_date timestamptz not null,
  start_date_local timestamp without time zone,
  timezone text,
  distance_m double precision not null default 0 check (distance_m >= 0),
  moving_time_s integer not null default 0 check (moving_time_s >= 0),
  elapsed_time_s integer not null default 0 check (elapsed_time_s >= 0),
  total_elevation_gain_m double precision not null default 0 check (total_elevation_gain_m >= 0),
  average_speed_mps double precision,
  max_speed_mps double precision,
  average_watts double precision,
  weighted_average_watts double precision,
  kilojoules double precision,
  average_heartrate double precision,
  max_heartrate double precision,
  suffer_score double precision,
  trainer boolean not null default false,
  commute boolean not null default false,
  manual boolean not null default false,
  private boolean not null default false,
  achievement_count integer not null default 0,
  kudos_count integer not null default 0,
  imported_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_id)
);

create index strava_activities_user_start_idx
  on public.strava_activities (user_id, start_date desc);

create index strava_activities_user_sport_idx
  on public.strava_activities (user_id, sport_type, start_date desc);

create trigger strava_connections_touch_updated_at before update on public.strava_connections
for each row execute function private.touch_updated_at();

create trigger strava_activities_touch_updated_at before update on public.strava_activities
for each row execute function private.touch_updated_at();

alter table public.strava_connections enable row level security;
alter table public.strava_activities enable row level security;

create policy strava_activities_select_own on public.strava_activities
for select to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.strava_connections, public.strava_activities from anon, authenticated;
grant select on public.strava_activities to authenticated;
grant select, insert, update, delete on public.strava_connections, public.strava_activities to service_role;
