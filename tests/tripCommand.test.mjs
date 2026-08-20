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
    [{ currency: "ZAR", estimatedAmount: 500, actualAmount: undefined, stageDay: 1, category: "emergency_buffer" }],
    [{ severity: "high", title: "gap", detail: "gap", startKm: 0, endKm: 60 }],
    new Date("2026-08-20T08:00:00Z"),
  );

  assert.deepEqual(result.days.map((day) => day.date), ["2026-09-02", "2026-09-03", "2026-09-04"]);
  assert.equal(result.days[0].targetDistanceKm, 50);
  assert.equal(result.days[0].estimatedCost, 500);
  assert.equal(result.requiredNights, 2);
  assert.equal(result.estimatedBudget, 500);
  assert.equal(result.status, "blocked");
  assert.equal(result.forecastStatus, "not_yet_available");
  assert.equal(result.forecastLabel, "Not available yet");
  assert.deepEqual(result.blockers, [
    "Choose 1 more overnight stay",
    "Resolve 1 critical gear item",
    "Resolve 1 high-risk resupply gap",
  ]);
  assert.deepEqual(result.warnings, [
    "Live weather is not available yet; review it closer to departure",
    "Confirm selected accommodation bookings",
  ]);
  assert.deepEqual(result.findings.map(({ id, workspace, actionLabel }) => ({ id, workspace, actionLabel })), [
    { id: "forecast-pending", workspace: "Weather", actionLabel: "Review weather" },
    { id: "stays-missing", workspace: "Stays", actionLabel: "Choose stays" },
    { id: "critical-gear-open", workspace: "Gear", actionLabel: "Resolve gear" },
    { id: "resupply-high-risk", workspace: "Route", actionLabel: "Review route" },
    { id: "stays-unconfirmed", workspace: "Stays", actionLabel: "Review stays" },
  ]);
});

test("buildTripCommandSnapshot reports ready only when blockers and warnings are resolved", () => {
  const result = buildTripCommandSnapshot(
    { ...adventure, days: 2, startsOn: "2026-08-22" },
    [{ placement: "selected", stageDay: 1, reservationStatus: "confirmed", currency: "ZAR" }],
    [{ isCritical: true, packingStatus: "packed", packedQuantity: 1, quantity: 1, acquisitionStatus: "owned" }],
    [{ currency: "ZAR", estimatedAmount: 1_000, actualAmount: undefined, category: "emergency_buffer" }],
    [],
    new Date("2026-08-20T08:00:00Z"),
  );

  assert.equal(result.status, "ready");
  assert.equal(result.forecastStatus, "available");
  assert.equal(result.forecastLabel, "Available now");
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.days.map((day) => day.forecastStatus), ["available", "available"]);
});
