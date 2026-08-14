create table public.adventure_fund_items (
  id uuid primary key default gen_random_uuid(),
  adventure_id text not null references public.adventures(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(trim(name)) between 1 and 160),
  category text not null default 'other'
    check (category in ('accommodation', 'food', 'groceries', 'transport_fuel', 'permits_activities', 'repairs', 'gear', 'emergency_buffer', 'other')),
  cost_status text not null default 'estimate'
    check (cost_status in ('estimate', 'confirmed', 'paid')),
  estimated_amount numeric(12, 2) not null default 0 check (estimated_amount >= 0),
  actual_amount numeric(12, 2) check (actual_amount is null or actual_amount >= 0),
  currency text not null default 'ZAR' check (currency ~ '^[A-Z]{3}$'),
  payer_id uuid references public.profiles(id) on delete set null,
  participant_ids uuid[] not null,
  split_method text not null default 'equal' check (split_method in ('equal', 'custom')),
  split_weights jsonb not null default '{}'::jsonb,
  stage_day integer check (stage_day is null or stage_day between 1 and 365),
  occurred_on date,
  booking_reference text,
  template_key text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(participant_ids) between 1 and 50),
  check (cost_status = 'estimate' or actual_amount is not null),
  check (cost_status <> 'paid' or payer_id is not null)
);

create index adventure_fund_items_adventure_idx
  on public.adventure_fund_items (adventure_id, category, cost_status);

create index adventure_fund_items_payer_idx
  on public.adventure_fund_items (payer_id)
  where payer_id is not null;

create index adventure_fund_items_participants_idx
  on public.adventure_fund_items using gin (participant_ids);

create unique index adventure_fund_items_template_unique
  on public.adventure_fund_items (adventure_id, template_key)
  where template_key is not null and template_key <> '';

create or replace function private.prevent_adventure_fund_scope_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.adventure_id is distinct from old.adventure_id
    or new.created_by is distinct from old.created_by then
    raise exception 'A fund item cannot be moved to another trip or reassigned to another creator.';
  end if;
  return new;
end;
$$;

create or replace function private.validate_adventure_fund_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  participant_id uuid;
begin
  if cardinality(new.participant_ids) is null or cardinality(new.participant_ids) = 0 then
    raise exception 'Select at least one trip participant for this cost.';
  end if;

  if (select count(*) from unnest(new.participant_ids) item)
    <> (select count(distinct item) from unnest(new.participant_ids) item) then
    raise exception 'A participant can only appear once on a cost.';
  end if;

  if exists (
    select 1
    from unnest(new.participant_ids) participant
    where not exists (
      select 1
      from public.adventure_members member
      where member.adventure_id = new.adventure_id
        and member.user_id = participant
        and member.status = 'accepted'
    )
  ) then
    raise exception 'Costs can only be shared with accepted members of this trip.';
  end if;

  if new.payer_id is not null and not exists (
    select 1
    from public.adventure_members member
    where member.adventure_id = new.adventure_id
      and member.user_id = new.payer_id
      and member.status = 'accepted'
  ) then
    raise exception 'The payer must be an accepted member of this trip.';
  end if;

  if new.split_method = 'equal' then
    new.split_weights = '{}'::jsonb;
  else
    if jsonb_typeof(new.split_weights) <> 'object' then
      raise exception 'Custom split weights must be an object.';
    end if;

    foreach participant_id in array new.participant_ids loop
      if not (new.split_weights ? participant_id::text)
        or jsonb_typeof(new.split_weights -> participant_id::text) <> 'number'
        or (new.split_weights ->> participant_id::text)::numeric <= 0 then
        raise exception 'Every participant needs a positive custom split weight.';
      end if;
    end loop;

    if (select count(*) from jsonb_object_keys(new.split_weights)) <> cardinality(new.participant_ids) then
      raise exception 'Custom split weights must match the selected participants.';
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.remove_departed_member_from_funds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  adventure_owner uuid;
begin
  select adventure.owner_id into adventure_owner
  from public.adventures adventure
  where adventure.id = old.adventure_id;

  update public.adventure_fund_items item
  set participant_ids = case
        when cardinality(array_remove(item.participant_ids, old.user_id)) = 0 then array[adventure_owner]
        else array_remove(item.participant_ids, old.user_id)
      end,
      split_method = case when old.user_id = any(item.participant_ids) then 'equal' else item.split_method end,
      split_weights = case when old.user_id = any(item.participant_ids) then '{}'::jsonb else item.split_weights end,
      payer_id = case when item.payer_id = old.user_id then null else item.payer_id end,
      cost_status = case when item.payer_id = old.user_id and item.cost_status = 'paid' then 'confirmed' else item.cost_status end
  where item.adventure_id = old.adventure_id
    and (old.user_id = any(item.participant_ids) or item.payer_id = old.user_id);

  return old;
end;
$$;

create trigger adventure_fund_items_prevent_scope_change
before update on public.adventure_fund_items
for each row execute function private.prevent_adventure_fund_scope_change();

create trigger adventure_fund_items_validate_members
before insert or update of adventure_id, payer_id, participant_ids, split_method, split_weights
on public.adventure_fund_items
for each row execute function private.validate_adventure_fund_members();

create trigger adventure_fund_items_touch_updated_at
before update on public.adventure_fund_items
for each row execute function private.touch_updated_at();

create trigger adventure_members_remove_from_funds
after delete on public.adventure_members
for each row execute function private.remove_departed_member_from_funds();

alter table public.adventure_fund_items enable row level security;

create policy adventure_fund_items_select on public.adventure_fund_items
for select to authenticated
using (private.can_access_adventure(adventure_id));

create policy adventure_fund_items_insert on public.adventure_fund_items
for insert to authenticated
with check (
  private.can_edit_adventure(adventure_id)
  and created_by = (select auth.uid())
);

create policy adventure_fund_items_update on public.adventure_fund_items
for update to authenticated
using (private.can_edit_adventure(adventure_id))
with check (private.can_edit_adventure(adventure_id));

create policy adventure_fund_items_delete on public.adventure_fund_items
for delete to authenticated
using (private.can_edit_adventure(adventure_id));

grant select, insert, update, delete on public.adventure_fund_items to authenticated;
revoke all on public.adventure_fund_items from anon;

revoke all on function private.prevent_adventure_fund_scope_change() from public, anon, authenticated;
revoke all on function private.validate_adventure_fund_members() from public, anon, authenticated;
revoke all on function private.remove_departed_member_from_funds() from public, anon, authenticated;

comment on table public.adventure_fund_items is
  'Private trip budget lines, actual costs and member splits for accepted trip members.';
