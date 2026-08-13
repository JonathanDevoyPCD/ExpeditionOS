import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Strava credentials stay encrypted and unavailable to browser roles", async () => {
  const schema = await readFile(new URL("../supabase/migrations/20260813080318_strava_connections_and_activities.sql", import.meta.url), "utf8");
  const denial = await readFile(new URL("../supabase/migrations/20260813080417_deny_client_strava_connection_access.sql", import.meta.url), "utf8");
  const environment = await readFile(new URL("../.env.example", import.meta.url), "utf8");

  assert.match(schema, /access_token_ciphertext text not null/);
  assert.match(schema, /refresh_token_ciphertext text not null/);
  assert.match(schema, /revoke all on public\.strava_connections, public\.strava_activities from anon, authenticated/);
  assert.match(denial, /using \(false\)/);
  assert.doesNotMatch(environment, /NEXT_PUBLIC_STRAVA/);
});
