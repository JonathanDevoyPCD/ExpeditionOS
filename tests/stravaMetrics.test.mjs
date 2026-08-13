import assert from "node:assert/strict";
import test from "node:test";
import { buildStravaReadinessSummary } from "../src/lib/strava/metrics.mjs";

test("builds deterministic cycling readiness windows", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const summary = buildStravaReadinessSummary([
    { start_date: "2026-08-03T08:00:00Z", distance_m: 30_000, moving_time_s: 7_200, total_elevation_gain_m: 300 },
    { start_date: "2026-07-04T08:00:00Z", distance_m: 40_000, moving_time_s: 10_800, total_elevation_gain_m: 400 },
    { start_date: "2026-05-05T08:00:00Z", distance_m: 50_000, moving_time_s: 9_000, total_elevation_gain_m: 500 },
  ], now);

  assert.deepEqual(summary, {
    activityCount: 3,
    lastActivityAt: "2026-08-03T08:00:00Z",
    last30DaysDistanceKm: 30,
    last30DaysAscentM: 300,
    last90DaysDistanceKm: 70,
    last90DaysAscentM: 700,
    longestRideKm: 50,
    biggestClimbM: 500,
    longestMovingMinutes: 180,
  });
});

test("returns zero baselines for an empty history", () => {
  assert.deepEqual(buildStravaReadinessSummary([], new Date("2026-08-13T12:00:00Z")), {
    activityCount: 0,
    lastActivityAt: null,
    last30DaysDistanceKm: 0,
    last30DaysAscentM: 0,
    last90DaysDistanceKm: 0,
    last90DaysAscentM: 0,
    longestRideKm: 0,
    biggestClimbM: 0,
    longestMovingMinutes: 0,
  });
});
