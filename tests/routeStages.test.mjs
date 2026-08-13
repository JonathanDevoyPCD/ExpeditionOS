import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteStages } from "../src/lib/routeStages.mjs";

const route = {
  points: [
    { lat: 0, lon: 0, distanceKm: 0, elevationM: 100 },
    { lat: 0, lon: 0.36, distanceKm: 40, elevationM: 200 },
    { lat: 0, lon: 0.9, distanceKm: 100, elevationM: 150 },
  ],
  elevationProfile: [
    { lat: 0, lon: 0, distanceKm: 0, elevationM: 100 },
    { lat: 0, lon: 0.36, distanceKm: 40, elevationM: 200 },
    { lat: 0, lon: 0.9, distanceKm: 100, elevationM: 150 },
  ],
  metrics: { distanceKm: 100, ascentM: 100, descentM: 50, estimatedMovingMinutes: 600 },
};

test("uses saved overnight anchors as stage boundaries", () => {
  const result = buildRouteStages(route, 2, [
    { id: "night-1", name: "Camp", lat: 0, lon: 0.36, kind: "overnight", day: 1 },
  ]);

  assert.equal(result.source, "overnight_anchors");
  assert.deepEqual(result.stages.map((stage) => stage.distanceKm), [40, 60]);
  assert.equal(result.stages[0].ascentM, 100);
  assert.equal(result.stages[1].descentM, 50);
  assert.deepEqual(result.stages.map((stage) => stage.estimatedMovingMinutes), [240, 360]);
});

test("falls back to Copilot targets and then equal stages", () => {
  const copilot = buildRouteStages(route, 2, [], {
    dailyPlan: [
      { day: 1, targetDistanceKm: 30 },
      { day: 2, targetDistanceKm: 70 },
    ],
  });
  assert.equal(copilot.source, "copilot_targets");
  assert.deepEqual(copilot.stages.map((stage) => stage.distanceKm), [30, 70]);

  const equal = buildRouteStages(route, 2);
  assert.equal(equal.source, "equal_split");
  assert.deepEqual(equal.stages.map((stage) => stage.distanceKm), [50, 50]);
});
