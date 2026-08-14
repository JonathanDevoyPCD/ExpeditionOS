import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fundAllocations, memberFundBalances } from "../src/lib/funds.mjs";

const members = [
  { userId: "rider-a", name: "Rider A" },
  { userId: "rider-b", name: "Rider B" },
];

function fundItem(overrides = {}) {
  return {
    estimatedAmount: 80,
    actualAmount: 100,
    costStatus: "paid",
    payerId: "rider-a",
    participantIds: ["rider-a", "rider-b"],
    splitMethod: "equal",
    splitWeights: {},
    ...overrides,
  };
}

test("paid costs create deterministic equal and custom member balances", () => {
  const equal = memberFundBalances([fundItem()], members);
  assert.deepEqual(equal.map((item) => item.amount), [50, -50]);

  const custom = memberFundBalances([fundItem({ payerId: "rider-b", splitMethod: "custom", splitWeights: { "rider-a": 70, "rider-b": 30 } })], members);
  assert.deepEqual(custom.map((item) => item.amount), [-70, 70]);

  const thirds = [...fundAllocations(fundItem({ actualAmount: 100, participantIds: ["a", "b", "c"] })).values()];
  assert.equal(thirds.reduce((sum, value) => sum + value, 0), 100);
});

test("estimates and confirmed but unpaid costs do not create debts", () => {
  const balances = memberFundBalances([
    fundItem({ costStatus: "estimate", actualAmount: undefined, payerId: undefined }),
    fundItem({ costStatus: "confirmed", payerId: "rider-a" }),
  ], members);
  assert.deepEqual(balances.map((item) => item.amount), [0, 0]);
});

test("trip funds stay member-private and contributor-controlled", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260814083708_phase_b_funds.sql", import.meta.url), "utf8");
  assert.match(migration, /alter table public\.adventure_fund_items enable row level security/);
  assert.match(migration, /using \(private\.can_access_adventure\(adventure_id\)\)/);
  assert.match(migration, /using \(private\.can_edit_adventure\(adventure_id\)\)/);
  assert.match(migration, /created_by = \(select auth\.uid\(\)\)/);
  assert.match(migration, /member\.status = 'accepted'/);
  assert.match(migration, /Custom split weights must match the selected participants/);
  assert.match(migration, /revoke all on public\.adventure_fund_items from anon/);
  assert.doesNotMatch(migration, /grant .*adventure_fund_items to anon/);
});

test("public route visitors cannot load budgets or member balances", async () => {
  const workspace = await readFile(new URL("../src/components/logistics/FundsWorkspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /adventure\.access && !adventure\.access\.isMember/);
  assert.match(workspace, /Funds is private to trip members/);
  assert.match(workspace, /does not hold or transfer money/);
});
