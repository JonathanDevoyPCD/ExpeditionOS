alter table public.strava_activities
  add column stream_sample_count integer not null default 0 check (stream_sample_count >= 0),
  add column heart_rate_drift_pct double precision check (heart_rate_drift_pct between -100 and 300),
  add column power_fade_pct double precision check (power_fade_pct between -100 and 300),
  add column aerobic_decoupling_pct double precision check (aerobic_decoupling_pct between -100 and 300),
  add column stream_analyzed_at timestamptz;

comment on column public.strava_activities.stream_sample_count is
  'Number of moving samples used to derive private readiness insights. Raw Strava streams are not persisted.';
comment on column public.strava_activities.heart_rate_drift_pct is
  'Second-half heart-rate change relative to the first half of the moving stream.';
comment on column public.strava_activities.power_fade_pct is
  'First-half power minus second-half power as a percentage of first-half power.';
comment on column public.strava_activities.aerobic_decoupling_pct is
  'Second-half heart-rate-to-power ratio change relative to the first half.';
