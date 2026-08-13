const EARTH_RADIUS_KM = 6371.0088;

export function buildRouteStages(route, days, anchors = [], blueprint = null) {
  if (!route || !Number.isFinite(route.metrics?.distanceKm) || route.metrics.distanceKm <= 0) {
    return { source: "equal_split", stages: [] };
  }

  const count = clamp(Math.round(days || 1), 1, 30);
  const anchorBoundaries = overnightBoundaries(route, count, anchors);
  const targetBoundaries = blueprintBoundaries(route, count, blueprint);
  const source = anchorBoundaries ? "overnight_anchors" : targetBoundaries ? "copilot_targets" : "equal_split";
  const boundaries = anchorBoundaries ?? targetBoundaries ?? equalBoundaries(route.metrics.distanceKm, count);

  return {
    source,
    stages: boundaries.slice(0, -1).map((startKm, index) => {
      const endKm = boundaries[index + 1];
      const elevation = elevationStats(route.elevationProfile ?? route.points ?? [], startKm, endKm);
      const distanceKm = endKm - startKm;
      return {
        day: index + 1,
        startKm: round(startKm, 2),
        endKm: round(endKm, 2),
        distanceKm: round(distanceKm, 1),
        ascentM: Math.round(elevation.ascentM),
        descentM: Math.round(elevation.descentM),
        estimatedMovingMinutes: Math.max(1, Math.round(route.metrics.estimatedMovingMinutes * (distanceKm / route.metrics.distanceKm))),
      };
    }),
  };
}

function overnightBoundaries(route, count, anchors) {
  if (count === 1) return [0, route.metrics.distanceKm];
  const overnight = [];
  for (let day = 1; day < count; day += 1) {
    const anchor = anchors.find((candidate) => candidate.kind === "overnight" && candidate.day === day);
    if (!anchor) return null;
    const projected = projectPointOntoRoute(anchor, route.points ?? []);
    if (!Number.isFinite(projected.distanceIntoRouteKm) || projected.distanceFromRouteKm > 10) return null;
    overnight.push(projected.distanceIntoRouteKm);
  }
  if (overnight.some((value, index) => value <= 0.1 || value >= route.metrics.distanceKm - 0.1 || (index > 0 && value <= overnight[index - 1]))) return null;
  return [0, ...overnight, route.metrics.distanceKm];
}

function blueprintBoundaries(route, count, blueprint) {
  if (!blueprint || blueprint.dailyPlan?.length !== count) return null;
  const weights = blueprint.dailyPlan.map((day) => Number(day.targetDistanceKm));
  if (weights.some((weight) => !Number.isFinite(weight) || weight <= 0)) return null;
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const boundaries = [0];
  let completedWeight = 0;
  for (let index = 0; index < count - 1; index += 1) {
    completedWeight += weights[index];
    boundaries.push(route.metrics.distanceKm * (completedWeight / totalWeight));
  }
  boundaries.push(route.metrics.distanceKm);
  return boundaries;
}

function equalBoundaries(distanceKm, count) {
  return Array.from({ length: count + 1 }, (_, index) => distanceKm * (index / count));
}

function elevationStats(points, startKm, endKm) {
  const ordered = [...points].filter((point) => Number.isFinite(point.distanceKm) && Number.isFinite(point.elevationM)).sort((a, b) => a.distanceKm - b.distanceKm);
  if (!ordered.length) return { ascentM: 0, descentM: 0 };
  const samples = [sampleElevation(ordered, startKm), ...ordered.filter((point) => point.distanceKm > startKm && point.distanceKm < endKm).map((point) => point.elevationM), sampleElevation(ordered, endKm)];
  let ascentM = 0;
  let descentM = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const change = samples[index] - samples[index - 1];
    if (change > 0) ascentM += change;
    else descentM += Math.abs(change);
  }
  return { ascentM, descentM };
}

function sampleElevation(points, distanceKm) {
  if (distanceKm <= points[0].distanceKm) return points[0].elevationM;
  if (distanceKm >= points[points.length - 1].distanceKm) return points[points.length - 1].elevationM;
  const finishIndex = points.findIndex((point) => point.distanceKm >= distanceKm);
  const start = points[finishIndex - 1];
  const finish = points[finishIndex];
  const span = finish.distanceKm - start.distanceKm;
  const ratio = span <= 0 ? 0 : (distanceKm - start.distanceKm) / span;
  return start.elevationM + (finish.elevationM - start.elevationM) * ratio;
}

function projectPointOntoRoute(point, route) {
  if (route.length < 2) return { distanceFromRouteKm: Number.POSITIVE_INFINITY, distanceIntoRouteKm: 0 };
  const radians = Math.PI / 180;
  const referenceLat = point.lat * radians;
  const toLocal = (candidate) => ({
    x: (candidate.lon - point.lon) * radians * EARTH_RADIUS_KM * Math.cos(referenceLat),
    y: (candidate.lat - point.lat) * radians * EARTH_RADIUS_KM,
  });
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;
  for (let index = 0; index < route.length - 1; index += 1) {
    const start = toLocal(route[index]);
    const finish = toLocal(route[index + 1]);
    const dx = finish.x - start.x;
    const dy = finish.y - start.y;
    const segmentLengthSquared = dx * dx + dy * dy;
    const rawT = segmentLengthSquared === 0 ? 0 : -(start.x * dx + start.y * dy) / segmentLengthSquared;
    const t = clamp(rawT, 0, 1);
    const distance = Math.hypot(start.x + t * dx, start.y + t * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestRouteDistance = route[index].distanceKm + t * (route[index + 1].distanceKm - route[index].distanceKm);
    }
  }
  return { distanceFromRouteKm: bestDistance, distanceIntoRouteKm: bestRouteDistance };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
