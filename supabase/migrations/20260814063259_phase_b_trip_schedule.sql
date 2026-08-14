alter table public.adventures
  add column starts_on date,
  add column departure_time time without time zone not null default '07:00';

comment on column public.adventures.starts_on is
  'Optional local start date for route-aware logistics and weather planning.';

comment on column public.adventures.departure_time is
  'Planned local departure time used for stage timing and forecast selection.';
