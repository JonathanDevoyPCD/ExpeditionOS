create table public.adventure_gear_items (
  id uuid primary key default gen_random_uuid(),
  adventure_id text not null references public.adventures(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text not null default 'other'
    check (category in ('bike_repairs', 'sleep_shelter', 'navigation_power', 'food_water', 'clothing', 'safety_medical', 'documents', 'other')),
  item_scope text not null default 'shared'
    check (item_scope in ('personal', 'shared')),
  packing_status text not null default 'needed'
    check (packing_status in ('needed', 'assigned', 'packed', 'missing')),
  quantity integer not null default 1 check (quantity between 1 and 100),
  packed_quantity integer not null default 0 check (packed_quantity between 0 and quantity),
  assigned_to uuid references public.profiles(id) on delete set null,
  unit_weight_grams integer check (unit_weight_grams is null or unit_weight_grams between 0 and 100000),
  is_critical boolean not null default false,
  template_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (packing_status <> 'packed' or packed_quantity = quantity),
  check (packed_quantity < quantity or packing_status = 'packed'),
  check (packing_status <> 'assigned' or assigned_to is not null)
);

create index adventure_gear_items_adventure_idx
  on public.adventure_gear_items (adventure_id, category, packing_status);

create index adventure_gear_items_assignee_idx
  on public.adventure_gear_items (assigned_to)
  where assigned_to is not null;

create unique index adventure_gear_items_template_unique
  on public.adventure_gear_items (adventure_id, template_key)
  where template_key is not null and template_key <> '';

create or replace function private.prevent_adventure_gear_scope_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.adventure_id is distinct from old.adventure_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A gear item cannot be moved to another trip or reassigned to another creator.';
  end if;
  return new;
end;
$$;

create or replace function private.validate_adventure_gear_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assigned_to is not null and not exists (
    select 1
    from public.adventure_members member
    where member.adventure_id = new.adventure_id
      and member.user_id = new.assigned_to
      and member.status = 'accepted'
  ) then
    raise exception 'Gear can only be assigned to an accepted member of this trip.';
  end if;
  return new;
end;
$$;

create or replace function private.unassign_removed_adventure_member_gear()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.adventure_gear_items
  set assigned_to = null,
      packed_quantity = 0,
      packing_status = 'needed'
  where adventure_id = old.adventure_id
    and assigned_to = old.user_id;
  return old;
end;
$$;

create trigger adventure_gear_items_prevent_scope_change
before update on public.adventure_gear_items
for each row execute function private.prevent_adventure_gear_scope_change();

create trigger adventure_gear_items_validate_assignment
before insert or update of adventure_id, assigned_to on public.adventure_gear_items
for each row execute function private.validate_adventure_gear_assignment();

create trigger adventure_gear_items_touch_updated_at
before update on public.adventure_gear_items
for each row execute function private.touch_updated_at();

create trigger adventure_members_unassign_gear
after delete on public.adventure_members
for each row execute function private.unassign_removed_adventure_member_gear();

alter table public.adventure_gear_items enable row level security;

create policy adventure_gear_items_select on public.adventure_gear_items
for select to authenticated
using (private.can_access_adventure(adventure_id));

create policy adventure_gear_items_insert on public.adventure_gear_items
for insert to authenticated
with check (
  private.can_edit_adventure(adventure_id)
  and created_by = (select auth.uid())
);

create policy adventure_gear_items_update on public.adventure_gear_items
for update to authenticated
using (private.can_edit_adventure(adventure_id))
with check (private.can_edit_adventure(adventure_id));

create policy adventure_gear_items_delete on public.adventure_gear_items
for delete to authenticated
using (private.can_edit_adventure(adventure_id));

grant select, insert, update, delete on public.adventure_gear_items to authenticated;
revoke all on public.adventure_gear_items from anon;

revoke all on function private.prevent_adventure_gear_scope_change() from public, anon, authenticated;
revoke all on function private.validate_adventure_gear_assignment() from public, anon, authenticated;
revoke all on function private.unassign_removed_adventure_member_gear() from public, anon, authenticated;

comment on table public.adventure_gear_items is
  'Trip-specific personal and shared packing items visible to accepted trip members.';
