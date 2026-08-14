import assert from "node:assert/strict";
import test from "node:test";
import { analyzeActivityStreams } from "../src/lib/strava/streamMetrics.mjs";

test("derives heart-rate drift, power fade, and aerobic decoupling without retaining raw streams", () => {
  const time = Array.from({ length: 40 }, (_, index) => index * 60);
  const heartrate = Array.from({ length: 40 }, (_, index) => index < 20 ? 140 : 154);
  const watts = Array.from({ length: 40 }, (_, index) => index < 20 ? 200 : 180);
  const insight = analyzeActivityStreams({
    time: { data: time },
    heartrate: { data: heartrate },
    watts: { data: watts },
    moving: { data: Array(40).fill(true) },
  });

  assert.equal(insight.sampleCount, 40);
  assert.equal(insight.heartRateDriftPct, 10);
  assert.equal(insight.powerFadePct, 10);
  assert.equal(insight.aerobicDecouplingPct, 22.2);
  assert.deepEqual(Object.keys(insight).sort(), [
    "aerobicDecouplingPct",
    "heartRateDriftPct",
    "heartRateSampleCount",
    "powerFadePct",
    "powerSampleCount",
    "sampleCount",
  ]);
});

test("ignores stopped samples and returns unavailable metrics for sparse streams", () => {
  const insight = analyzeActivityStreams([
    { type: "time", data: Array.from({ length: 12 }, (_, index) => index) },
    { type: "heartrate", data: Array(12).fill(145) },
    { type: "moving", data: Array(12).fill(false) },
  ]);

  assert.equal(insight.sampleCount, 0);
  assert.equal(insight.heartRateDriftPct, null);
  assert.equal(insight.powerFadePct, null);
  assert.equal(insight.aerobicDecouplingPct, null);
});
