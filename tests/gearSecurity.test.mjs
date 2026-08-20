import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip gear stays private and respects contributor permissions", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260814075528_phase_b_gear.sql", import.meta.url), "utf8");

  assert.match(migration, /alter table public\.adventure_gear_items enable row level security/);
  assert.match(migration, /using \(private\.can_access_adventure\(adventure_id\)\)/);
  assert.match(migration, /using \(private\.can_edit_adventure\(adventure_id\)\)/);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /member\.status = 'accepted'/);
  assert.match(migration, /prevent_adventure_gear_scope_change/);
  assert.match(migration, /adventure_members_unassign_gear/);
  assert.match(migration, /revoke all on public\.adventure_gear_items from anon/);
  assert.doesNotMatch(migration, /grant .*adventure_gear_items to anon/);
});

test("public route visitors do not load trip packing data", async () => {
  const workspace = await readFile(new URL("../src/components/logistics/GearWorkspace.tsx", import.meta.url), "utf8");

  assert.match(workspace, /adventure\.access\.isMember/);
  assert.match(workspace, /Gear is private to trip members/);
  assert.match(workspace, /only its creator and contributors can add equipment/);
});

test("private personal gear catalogue uses owner-isolated RLS", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260820063651_gear_catalogue.sql", import.meta.url), "utf8");

  for (const table of ["gear_catalog_profiles", "gear_catalog_categories", "gear_catalog_items"]) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon`));
  }
  assert.match(migration, /using \(\(select auth\.uid\(\)\) = owner_id\)/);
  assert.match(migration, /with check \(\(select auth\.uid\(\)\) = owner_id\)/);
  assert.match(migration, /foreign key \(category_id, owner_id\)/);
  assert.match(migration, /add column catalog_item_id uuid references public\.gear_catalog_items\(id\) on delete set null/);
  assert.match(migration, /add column acquisition_status text not null default 'owned'/);
  assert.doesNotMatch(migration, /grant .*gear_catalog_.* to anon/);
});

test("gear catalogue is visual, multi-select and retailer-safe", async () => {
  const defaults = await readFile(new URL("../src/lib/gearCatalogDefaults.ts", import.meta.url), "utf8");
  const catalogue = await readFile(new URL("../src/components/logistics/GearCataloguePanel.tsx", import.meta.url), "utf8");
  const workspace = await readFile(new URL("../src/components/logistics/GearWorkspace.tsx", import.meta.url), "utf8");

  assert.ok((defaults.match(/\n  item\("/g) ?? []).length >= 80);
  assert.match(defaults, /weightKind: "consumable"/);
  assert.match(catalogue, /Select essentials/);
  assert.match(catalogue, /Add selected to trip/);
  assert.match(workspace, /Gear settings/);
  assert.match(workspace, /https:\/\/www\.takealot\.com\/all\?qsearch=/);
  assert.doesNotMatch(workspace, /fetch\([^)]*takealot/i);
});
