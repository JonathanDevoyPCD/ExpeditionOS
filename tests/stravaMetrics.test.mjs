import assert from "node:assert/strict";
import test from "node:test";
import { buildRouteReadinessReport, buildStravaReadinessSummary } from "../src/lib/strava/metrics.mjs";

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

test("builds an inspectable route-specific readiness report", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const activities = [
    activity(1, "Century prep", "2026-08-03T08:00:00Z", 110, 1_300, 420),
    activity(2, "Hilly Saturday", "2026-07-27T08:00:00Z", 82, 1_500, 330),
    activity(3, "Long gravel", "2026-07-20T08:00:00Z", 95, 900, 360),
    activity(4, "Endurance ride", "2026-07-12T08:00:00Z", 70, 700, 270),
    activity(5, "Tempo ride", "2026-07-05T08:00:00Z", 55, 500, 180),
    activity(6, "Winter base", "2026-06-28T08:00:00Z", 65, 650, 240),
  ];
  const report = buildRouteReadinessReport(activities, {
    id: "summit-leg-breaker",
    name: "The Summit Leg Breaker",
    days: 1,
    distanceKm: 105.4,
    ascentM: 1_117,
    estimatedMovingMinutes: 422,
  }, now);

  assert.equal(report.ruleVersion, "readiness-v3");
  assert.equal(report.route.dailyDistanceKm, 105.4);
  assert.equal(report.factors.some((factor) => factor.id === "consecutive_days"), false);
  assert.equal(report.comparableActivities[0].name, "Century prep");
  assert.equal(report.confidence.level, "moderate");
  assert.ok(report.overallScore >= 70);
});

test("sparse history lowers confidence instead of inventing readiness", () => {
  const report = buildRouteReadinessReport([
    activity(1, "One short ride", "2026-08-10T08:00:00Z", 20, 100, 60),
  ], { id: "large-route", name: "Large route", days: 1, distanceKm: 160, ascentM: 2_500, estimatedMovingMinutes: 600 }, new Date("2026-08-13T12:00:00Z"));

  assert.equal(report.verdict, "insufficient_information");
  assert.equal(report.confidence.level, "low");
  assert.ok(report.factors.find((factor) => factor.id === "distance").score < 30);
  assert.ok(report.unknowns.some((item) => item.includes("small activity history")));
});

test("multi-day plans preserve a consecutive-day gap", () => {
  const report = buildRouteReadinessReport([
    activity(1, "Long solo", "2026-08-10T08:00:00Z", 120, 1_200, 420),
    activity(2, "Long solo two", "2026-07-20T08:00:00Z", 110, 1_100, 390),
    activity(3, "Long solo three", "2026-06-20T08:00:00Z", 100, 1_000, 360),
    activity(4, "Long solo four", "2026-05-20T08:00:00Z", 90, 900, 330),
    activity(5, "Long solo five", "2026-04-20T08:00:00Z", 80, 800, 300),
    activity(6, "Long solo six", "2026-03-20T08:00:00Z", 70, 700, 270),
  ], { id: "four-day", name: "Four-day tour", days: 4, distanceKm: 320, ascentM: 3_200, estimatedMovingMinutes: 1_200 }, new Date("2026-08-13T12:00:00Z"));

  const consecutive = report.factors.find((factor) => factor.id === "consecutive_days");
  assert.ok(consecutive);
  assert.equal(consecutive.status, "gap");
  assert.equal(report.criticalFactorId, "consecutive_days");
  assert.ok(report.overallScore <= consecutive.score + 25);
});

test("stage-aware readiness surfaces a hard day instead of averaging it away", () => {
  const activities = [
    activity(1, "Steady 70", "2026-08-10T08:00:00Z", 70, 700, 260),
    activity(2, "Steady 65", "2026-08-03T08:00:00Z", 65, 650, 240),
    activity(3, "Steady 60", "2026-07-27T08:00:00Z", 60, 600, 220),
    activity(4, "Steady 55", "2026-07-20T08:00:00Z", 55, 550, 200),
    activity(5, "Steady 50", "2026-07-13T08:00:00Z", 50, 500, 180),
    activity(6, "Steady 45", "2026-07-06T08:00:00Z", 45, 450, 165),
  ];
  const report = buildRouteReadinessReport(activities, {
    id: "uneven-tour",
    name: "Uneven tour",
    days: 3,
    distanceKm: 180,
    ascentM: 2_400,
    estimatedMovingMinutes: 720,
    stageSource: "overnight_anchors",
    stages: [
      { day: 1, startKm: 0, endKm: 40, distanceKm: 40, ascentM: 300, descentM: 200, estimatedMovingMinutes: 150 },
      { day: 2, startKm: 40, endKm: 140, distanceKm: 100, ascentM: 1_800, descentM: 1_500, estimatedMovingMinutes: 420 },
      { day: 3, startKm: 140, endKm: 180, distanceKm: 40, ascentM: 300, descentM: 400, estimatedMovingMinutes: 150 },
    ],
  }, new Date("2026-08-13T12:00:00Z"));

  assert.equal(report.route.hardestStage.day, 2);
  assert.equal(report.route.stageSource, "overnight_anchors");
  assert.equal(report.route.dailyDistanceKm, 60);
  assert.match(report.factors.find((factor) => factor.id === "distance").summary, /Day 2/);
  assert.ok(report.factors.find((factor) => factor.id === "distance").score < 85);
  assert.equal(report.unknowns.some((item) => item.includes("equal route split")), false);
});

test("terrain relevance prefers demonstrated rides that match the planned bicycle context", () => {
  const now = new Date("2026-08-13T12:00:00Z");
  const roadHistory = Array.from({ length: 6 }, (_, index) => activity(index + 1, `Road ${index + 1}`, `2026-08-0${index + 1}T08:00:00Z`, 70, 700, 240));
  const mountainHistory = roadHistory.map((item) => ({ ...item, sport_type: "MountainBikeRide" }));
  const target = { id: "trail", name: "Trail route", days: 1, distanceKm: 65, ascentM: 1_000, estimatedMovingMinutes: 300, bicycleType: "Mountain", terrainProfile: "off_road" };

  const roadReport = buildRouteReadinessReport(roadHistory, target, now);
  const mountainReport = buildRouteReadinessReport(mountainHistory, target, now);

  assert.ok(mountainReport.factors.find((factor) => factor.id === "terrain").score > roadReport.factors.find((factor) => factor.id === "terrain").score);
  assert.equal(mountainReport.route.bicycleType, "Mountain");
  assert.equal(mountainReport.route.terrainProfile, "off_road");
});

test("summarizes optional physiology drift without allowing it to invent a readiness score", () => {
  const activities = [
    activity(1, "Sensor one", "2026-08-10T08:00:00Z", 80, 800, 260, { stream_sample_count: 120, heart_rate_drift_pct: 4, power_fade_pct: 3, aerobic_decoupling_pct: 5 }),
    activity(2, "Sensor two", "2026-08-03T08:00:00Z", 75, 750, 250, { stream_sample_count: 110, heart_rate_drift_pct: 6, power_fade_pct: 5, aerobic_decoupling_pct: 7 }),
    activity(3, "Sensor three", "2026-07-27T08:00:00Z", 70, 700, 240, { stream_sample_count: 100, heart_rate_drift_pct: 8, power_fade_pct: 7, aerobic_decoupling_pct: 9 }),
  ];
  const report = buildRouteReadinessReport(activities, { id: "sensor-route", name: "Sensor route", days: 1, distanceKm: 70, ascentM: 700, estimatedMovingMinutes: 240, bicycleType: "Road", terrainProfile: "road" }, new Date("2026-08-13T12:00:00Z"));

  assert.equal(report.physiology.analyzedActivities, 3);
  assert.equal(report.physiology.medianHeartRateDriftPct, 6);
  assert.equal(report.physiology.medianPowerFadePct, 5);
  assert.equal(report.physiology.medianAerobicDecouplingPct, 7);
  assert.equal(report.physiology.status, "stable");
});

test("builds a compact Copilot packet without identity, route traces, or raw streams", () => {
  const report = buildRouteReadinessReport([
    activity(1, "Private activity name", "2026-08-10T08:00:00Z", 60, 600, 210),
    activity(2, "Another private name", "2026-08-03T08:00:00Z", 55, 550, 195),
    activity(3, "Third private name", "2026-07-27T08:00:00Z", 50, 500, 180),
  ], { id: "packet-route", name: "Packet route", days: 1, distanceKm: 60, ascentM: 600, estimatedMovingMinutes: 210 }, new Date("2026-08-13T12:00:00Z"));

  assert.equal(report.copilotEvidence.schemaVersion, "copilot-readiness-evidence-v1");
  assert.deepEqual(report.copilotEvidence.dataBoundary, { rawActivityStreamsIncluded: false, routeTraceIncluded: false, athleteIdentityIncluded: false });
  assert.equal("name" in report.copilotEvidence.comparableEfforts[0], false);
  assert.equal("activityId" in report.copilotEvidence.comparableEfforts[0], false);
  assert.equal(JSON.stringify(report.copilotEvidence).includes("Private activity name"), false);
});

function activity(activity_id, name, start_date, distanceKm, ascentM, movingMinutes, insight = {}) {
  return {
    activity_id,
    name,
    sport_type: "Ride",
    start_date,
    distance_m: distanceKm * 1000,
    total_elevation_gain_m: ascentM,
    moving_time_s: movingMinutes * 60,
    ...insight,
  };
}
