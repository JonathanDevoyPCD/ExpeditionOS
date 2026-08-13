import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("trip people profiles use the member user relationship", async () => {
  const querySource = await readFile(new URL("../src/lib/tripPeopleQuery.ts", import.meta.url), "utf8");
  assert.match(querySource, /profiles!adventure_members_user_id_fkey\(/);
  assert.doesNotMatch(querySource, /profiles\(/);
});
