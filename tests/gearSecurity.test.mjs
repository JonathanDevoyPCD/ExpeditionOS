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

  assert.match(workspace, /adventure\.access && !adventure\.access\.isMember/);
  assert.match(workspace, /Gear is private to trip members/);
  assert.match(workspace, /Viewers can review the list but cannot change it/);
});
