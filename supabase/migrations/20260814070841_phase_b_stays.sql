create table public.adventure_stays (
  id uuid primary key default gen_random_uuid(),
  adventure_id text not null references public.adventures(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  accommodation_type text not null default 'other'
    check (accommodation_type in ('backpackers', 'guest_house', 'bed_and_breakfast', 'self_catering', 'camping', 'hotel', 'other')),
  placement text not null default 'candidate'
    check (placement in ('candidate', 'selected', 'backup')),
  reservation_status text not null default 'researching'
    check (reservation_status in ('researching', 'contacted', 'reserved', 'paid', 'confirmed')),
  stage_day integer check (stage_day is null or stage_day between 1 and 365),
  check_in date,
  check_out date,
  adults integer not null default 1 check (adults between 1 and 50),
  rooms integer not null default 1 check (rooms between 1 and 25),
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  nightly_price numeric(12, 2) check (nightly_price is null or nightly_price >= 0),
  total_price numeric(12, 2) check (total_price is null or total_price >= 0),
  rating numeric(3, 2) check (rating is null or rating between 0 and 5),
  distance_from_route_km numeric(8, 2) check (distance_from_route_km is null or distance_from_route_km >= 0),
  address text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  contact_phone text,
  contact_email text,
  source text not null default 'manual' check (source in ('manual', 'openstreetmap', 'google', 'provider')),
  source_reference text,
  source_url text,
  booking_reference text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_in is null or check_out is null or check_out > check_in)
);

create index adventure_stays_adventure_idx
  on public.adventure_stays (adventure_id, stage_day, placement, total_price);

create unique index adventure_stays_source_unique
  on public.adventure_stays (adventure_id, source, source_reference)
  where source_reference is not null and source_reference <> '';

create or replace function private.prevent_adventure_stay_scope_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.adventure_id is distinct from old.adventure_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A stay cannot be moved to another trip or reassigned.';
  end if;
  return new;
end;
$$;

create trigger adventure_stays_prevent_scope_change
before update on public.adventure_stays
for each row execute function private.prevent_adventure_stay_scope_change();

create trigger adventure_stays_touch_updated_at
before update on public.adventure_stays
for each row execute function private.touch_updated_at();

alter table public.adventure_stays enable row level security;

create policy adventure_stays_select on public.adventure_stays
for select to authenticated
using (private.can_access_adventure(adventure_id));

create policy adventure_stays_insert on public.adventure_stays
for insert to authenticated
with check (
  private.can_edit_adventure(adventure_id)
  and created_by = (select auth.uid())
);

create policy adventure_stays_update on public.adventure_stays
for update to authenticated
using (private.can_edit_adventure(adventure_id))
with check (private.can_edit_adventure(adventure_id));

create policy adventure_stays_delete on public.adventure_stays
for delete to authenticated
using (private.can_edit_adventure(adventure_id));

grant select, insert, update, delete on public.adventure_stays to authenticated;
revoke all on public.adventure_stays from anon;

comment on table public.adventure_stays is
  'Private trip accommodation candidates and reservation progress shared only with accepted trip members.';
