import assert from "node:assert/strict";
import test from "node:test";

import { buildTripCommandSnapshot } from "../src/lib/tripCommand.mjs";

const adventure = {
  id: "trip-1",
  name: "Coast ride",
  description: "",
  source: "manual",
  createdAt: "2026-08-20T00:00:00Z",
  updatedAt: "2026-08-20T00:00:00Z",
  days: 3,
  startsOn: "2026-09-02",
  route: { metrics: { distanceKm: 150 } },
};

test("buildTripCommandSnapshot maps dates and exposes real readiness gaps", () => {
  const result = buildTripCommandSnapshot(
    adventure,
    [{ placement: "selected", stageDay: 1, reservationStatus: "researching", currency: "ZAR" }],
    [{ isCritical: true, packingStatus: "needed", packedQuantity: 0, quantity: 1, acquisitionStatus: "need" }],
    [{ currency: "ZAR", estimatedAmount: 500, actualAmount: undefined, stageDay: 1 }],
    [{ severity: "high", title: "gap", detail: "gap", startKm: 0, endKm: 60 }],
  );

  assert.deepEqual(result.days.map((day) => day.date), ["2026-09-02", "2026-09-03", "2026-09-04"]);
  assert.equal(result.days[0].targetDistanceKm, 50);
  assert.equal(result.days[0].estimatedCost, 500);
  assert.equal(result.requiredNights, 2);
  assert.equal(result.estimatedBudget, 500);
  assert.deepEqual(result.blockers, [
    "Choose 1 more overnight stay",
    "Resolve 1 critical gear item",
    "Resolve 1 high-risk resupply gap",
  ]);
  assert.deepEqual(result.warnings, ["Confirm selected accommodation bookings"]);
});
