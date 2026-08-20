create table public.gear_catalog_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  starter_version integer not null default 0 check (starter_version >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gear_catalog_categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text not null check (char_length(trim(slug)) between 1 and 80),
  name text not null check (char_length(trim(name)) between 1 and 100),
  icon_key text not null default 'package' check (char_length(trim(icon_key)) between 1 and 60),
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug),
  unique (id, owner_id)
);

create table public.gear_catalog_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null,
  source_key text not null check (char_length(trim(source_key)) between 1 and 120),
  name text not null check (char_length(trim(name)) between 1 and 160),
  description text,
  image_key text not null default 'package' check (char_length(trim(image_key)) between 1 and 60),
  default_scope text not null default 'personal'
    check (default_scope in ('personal', 'shared')),
  default_quantity integer not null default 1 check (default_quantity between 1 and 100),
  estimated_unit_weight_grams integer
    check (estimated_unit_weight_grams is null or estimated_unit_weight_grams between 0 and 100000),
  weight_kind text not null default 'fixed'
    check (weight_kind in ('fixed', 'consumable')),
  is_critical boolean not null default false,
  is_optional boolean not null default false,
  takealot_search_term text check (takealot_search_term is null or char_length(trim(takealot_search_term)) between 1 and 160),
  is_active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, source_key),
  foreign key (category_id, owner_id)
    references public.gear_catalog_categories(id, owner_id)
    on delete restrict
);

create index gear_catalog_categories_owner_idx
  on public.gear_catalog_categories (owner_id, is_active, sort_order);

create index gear_catalog_items_owner_idx
  on public.gear_catalog_items (owner_id, is_active, category_id, sort_order);

create index gear_catalog_items_category_idx
  on public.gear_catalog_items (category_id);

create trigger gear_catalog_profiles_touch_updated_at
before update on public.gear_catalog_profiles
for each row execute function private.touch_updated_at();

create trigger gear_catalog_categories_touch_updated_at
before update on public.gear_catalog_categories
for each row execute function private.touch_updated_at();

create trigger gear_catalog_items_touch_updated_at
before update on public.gear_catalog_items
for each row execute function private.touch_updated_at();

alter table public.gear_catalog_profiles enable row level security;
alter table public.gear_catalog_categories enable row level security;
alter table public.gear_catalog_items enable row level security;

create policy gear_catalog_profiles_select on public.gear_catalog_profiles
for select to authenticated
using ((select auth.uid()) = user_id);

create policy gear_catalog_profiles_insert on public.gear_catalog_profiles
for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy gear_catalog_profiles_update on public.gear_catalog_profiles
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy gear_catalog_categories_select on public.gear_catalog_categories
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy gear_catalog_categories_insert on public.gear_catalog_categories
for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy gear_catalog_categories_update on public.gear_catalog_categories
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy gear_catalog_categories_delete on public.gear_catalog_categories
for delete to authenticated
using ((select auth.uid()) = owner_id);

create policy gear_catalog_items_select on public.gear_catalog_items
for select to authenticated
using ((select auth.uid()) = owner_id);

create policy gear_catalog_items_insert on public.gear_catalog_items
for insert to authenticated
with check ((select auth.uid()) = owner_id);

create policy gear_catalog_items_update on public.gear_catalog_items
for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy gear_catalog_items_delete on public.gear_catalog_items
for delete to authenticated
using ((select auth.uid()) = owner_id);

grant select, insert, update on public.gear_catalog_profiles to authenticated;
grant select, insert, update, delete on public.gear_catalog_categories to authenticated;
grant select, insert, update, delete on public.gear_catalog_items to authenticated;

revoke all on public.gear_catalog_profiles from anon;
revoke all on public.gear_catalog_categories from anon;
revoke all on public.gear_catalog_items from anon;

alter table public.adventure_gear_items
  drop constraint adventure_gear_items_category_check,
  add constraint adventure_gear_items_category_check
    check (char_length(trim(category)) between 1 and 80),
  add column catalog_item_id uuid references public.gear_catalog_items(id) on delete set null,
  add column acquisition_status text not null default 'owned'
    check (acquisition_status in ('owned', 'need', 'borrow', 'buy')),
  add column weight_is_estimate boolean not null default true,
  add column weight_kind text not null default 'fixed'
    check (weight_kind in ('fixed', 'consumable')),
  add column image_key text,
  add column takealot_search_term text;

create index adventure_gear_items_catalog_idx
  on public.adventure_gear_items (catalog_item_id)
  where catalog_item_id is not null;

comment on table public.gear_catalog_profiles is
  'Private per-user metadata for versioned starter gear catalogue synchronization.';

comment on table public.gear_catalog_categories is
  'Private reusable gear categories owned and editable by one ExpeditionOS user.';

comment on table public.gear_catalog_items is
  'Private reusable gear catalogue definitions. Trip packing rows retain independent snapshots.';
