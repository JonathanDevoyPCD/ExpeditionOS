const MIN_SAMPLES = 20;

export function analyzeActivityStreams(value) {
  const streams = normalizeStreamSet(value);
  const time = numericData(streams.get("time"));
  const moving = booleanData(streams.get("moving"));
  const heartRate = metricHalves(numericData(streams.get("heartrate")), time, moving);
  const power = metricHalves(numericData(streams.get("watts")), time, moving, (item) => item > 0);
  const paired = pairedHalves(numericData(streams.get("heartrate")), numericData(streams.get("watts")), time, moving);

  return {
    sampleCount: Math.max(heartRate?.count ?? 0, power?.count ?? 0),
    heartRateSampleCount: heartRate?.count ?? 0,
    powerSampleCount: power?.count ?? 0,
    heartRateDriftPct: heartRate ? percentageChange(heartRate.first, heartRate.second) : null,
    powerFadePct: power ? percentageFade(power.first, power.second) : null,
    aerobicDecouplingPct: paired
      ? percentageChange(paired.firstHeartRate / paired.firstPower, paired.secondHeartRate / paired.secondPower)
      : null,
  };
}

function normalizeStreamSet(value) {
  const result = new Map();
  if (Array.isArray(value)) {
    for (const stream of value) {
      if (stream && typeof stream === "object" && typeof stream.type === "string") result.set(stream.type, stream);
    }
    return result;
  }
  if (!value || typeof value !== "object") return result;
  for (const [type, stream] of Object.entries(value)) {
    if (stream && typeof stream === "object") result.set(type, stream);
  }
  return result;
}

function numericData(stream) {
  if (!stream || !Array.isArray(stream.data)) return [];
  return stream.data.map(Number);
}

function booleanData(stream) {
  if (!stream || !Array.isArray(stream.data)) return [];
  return stream.data.map((item) => item !== false);
}

function metricHalves(values, time, moving, predicate = (item) => item > 0) {
  const points = values.flatMap((value, index) => Number.isFinite(value) && predicate(value) && moving[index] !== false
    ? [{ position: Number.isFinite(time[index]) ? time[index] : index, value }]
    : []);
  if (points.length < MIN_SAMPLES) return null;
  const midpoint = (points[0].position + points[points.length - 1].position) / 2;
  const first = points.filter((point) => point.position <= midpoint).map((point) => point.value);
  const second = points.filter((point) => point.position > midpoint).map((point) => point.value);
  if (first.length < MIN_SAMPLES / 2 || second.length < MIN_SAMPLES / 2) return null;
  return { count: points.length, first: average(first), second: average(second) };
}

function pairedHalves(heartRate, power, time, moving) {
  const length = Math.min(heartRate.length, power.length);
  const points = [];
  for (let index = 0; index < length; index += 1) {
    if (!Number.isFinite(heartRate[index]) || heartRate[index] <= 0 || !Number.isFinite(power[index]) || power[index] <= 0 || moving[index] === false) continue;
    points.push({
      position: Number.isFinite(time[index]) ? time[index] : index,
      heartRate: heartRate[index],
      power: power[index],
    });
  }
  if (points.length < MIN_SAMPLES) return null;
  const midpoint = (points[0].position + points[points.length - 1].position) / 2;
  const first = points.filter((point) => point.position <= midpoint);
  const second = points.filter((point) => point.position > midpoint);
  if (first.length < MIN_SAMPLES / 2 || second.length < MIN_SAMPLES / 2) return null;
  return {
    firstHeartRate: average(first.map((point) => point.heartRate)),
    secondHeartRate: average(second.map((point) => point.heartRate)),
    firstPower: average(first.map((point) => point.power)),
    secondPower: average(second.map((point) => point.power)),
  };
}

function percentageChange(first, second) {
  if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0) return null;
  return round(clamp(((second - first) / first) * 100, -100, 300), 1);
}

function percentageFade(first, second) {
  if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0) return null;
  return round(clamp(((first - second) / first) * 100, -100, 300), 1);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
