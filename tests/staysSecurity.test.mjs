import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip stays stay private and respect contributor permissions", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260814070841_phase_b_stays.sql", import.meta.url), "utf8");

  assert.match(migration, /alter table public\.adventure_stays enable row level security/);
  assert.match(migration, /using \(private\.can_access_adventure\(adventure_id\)\)/);
  assert.match(migration, /using \(private\.can_edit_adventure\(adventure_id\)\)/);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke all on public\.adventure_stays from anon/);
  assert.match(migration, /prevent_adventure_stay_scope_change/);
  assert.doesNotMatch(migration, /grant .*adventure_stays to anon/);
});
