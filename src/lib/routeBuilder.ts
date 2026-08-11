import type { RouteDataset, RoutePoint } from "@/types/route";

const EARTH_RADIUS_KM = 6371.0088;

export function haversineKm(
  a: Pick<RoutePoint, "lat" | "lon">,
  b: Pick<RoutePoint, "lat" | "lon">,
) {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(b.lat - a.lat);
  const dLon = radians(b.lon - a.lon);
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(value));
}

export function sampleRoutePoints(points: RoutePoint[], maximum: number) {
  if (points.length <= maximum) return points;
  const step = (points.length - 1) / (maximum - 1);
  return Array.from({ length: maximum }, (_, index) => points[Math.round(index * step)]);
}

export function decodePolyline6(encoded: string) {
  const coordinates: Array<{ lat: number; lon: number }> = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lon += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ lat: lat / 1e6, lon: lon / 1e6 });
  }

  return coordinates;
}

export function createRouteDataset({
  id,
  name,
  source,
  coordinates,
  estimatedMovingMinutes,
}: {
  id: string;
  name: string;
  source: string;
  coordinates: Array<{ lat: number; lon: number; elevationM?: number }>;
  estimatedMovingMinutes?: number;
}): RouteDataset {
  if (coordinates.length < 2) throw new Error("A route needs at least two points.");

  let distanceKm = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxGradePct = 0;
  const points: RoutePoint[] = [];

  for (const coordinate of coordinates) {
    const point: RoutePoint = {
      lat: coordinate.lat,
      lon: coordinate.lon,
      elevationM: Number.isFinite(coordinate.elevationM) ? coordinate.elevationM! : 0,
      distanceKm,
    };
    const previous = points.at(-1);
    if (previous) {
      const segmentKm = haversineKm(previous, point);
      distanceKm += segmentKm;
      point.distanceKm = distanceKm;
      const elevationChange = point.elevationM - previous.elevationM;
      if (elevationChange > 0) ascentM += elevationChange;
      if (elevationChange < 0) descentM += Math.abs(elevationChange);
      if (segmentKm * 1000 >= 20) {
        maxGradePct = Math.max(maxGradePct, Math.abs(elevationChange) / (segmentKm * 10));
      }
    }
    points.push(point);
  }

  const elevations = points.map((point) => point.elevationM);
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const mapPoints = sampleRoutePoints(points, 1800);

  return {
    id,
    name,
    source,
    points: mapPoints,
    elevationProfile: sampleRoutePoints(points, 220),
    bounds: [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ],
    start: points[0],
    finish: points.at(-1)!,
    metrics: {
      distanceKm: Number(distanceKm.toFixed(1)),
      ascentM: Math.round(ascentM),
      descentM: Math.round(descentM),
      minElevationM: Math.round(Math.min(...elevations)),
      maxElevationM: Math.round(Math.max(...elevations)),
      maxGradePct: Number(Math.min(maxGradePct, 40).toFixed(1)),
      estimatedMovingMinutes: estimatedMovingMinutes ?? Math.round((distanceKm / 15) * 60),
    },
  };
}
