import { XMLParser } from "fast-xml-parser";
import type { RouteDataset, RoutePoint } from "@/types/route";

type RawTrackPoint = {
  lat?: string | number;
  lon?: string | number;
  ele?: string | number;
};

const EARTH_RADIUS_KM = 6371.0088;

function asArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function haversineKm(a: Pick<RoutePoint, "lat" | "lon">, b: Pick<RoutePoint, "lat" | "lon">) {
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

function samplePoints(points: RoutePoint[], maximum: number) {
  if (points.length <= maximum) return points;
  const step = Math.ceil(points.length / maximum);
  const sampled = points.filter((_, index) => index % step === 0);
  const last = points.at(-1);
  if (last && sampled.at(-1) !== last) sampled.push(last);
  return sampled;
}

export function parseGpx(xml: string): RouteDataset {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    trimValues: true,
  });
  const document = parser.parse(xml);
  const gpx = document?.gpx;

  if (!gpx) throw new Error("This file does not contain a GPX document.");

  const rawPoints: RawTrackPoint[] = [];
  for (const track of asArray(gpx.trk)) {
    for (const segment of asArray(track?.trkseg)) {
      rawPoints.push(...asArray<RawTrackPoint>(segment?.trkpt));
    }
  }

  if (rawPoints.length < 2) {
    for (const route of asArray(gpx.rte)) {
      rawPoints.push(...asArray<RawTrackPoint>(route?.rtept));
    }
  }

  if (rawPoints.length < 2) throw new Error("The GPX file contains fewer than two route points.");

  let distanceKm = 0;
  let ascentM = 0;
  let descentM = 0;
  let maxGradePct = 0;

  const points: RoutePoint[] = [];

  rawPoints.forEach((raw, index) => {
    const lat = Number(raw.lat);
    const lon = Number(raw.lon);
    const elevationM = Number(raw.ele ?? 0);

    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(elevationM)) {
      throw new Error(`The GPX file contains an invalid point at position ${index + 1}.`);
    }

    const point = { lat, lon, elevationM, distanceKm };
    const previous = points.at(-1);

    if (previous) {
      const segmentKm = haversineKm(previous, point);
      distanceKm += segmentKm;
      point.distanceKm = distanceKm;

      const elevationChange = elevationM - previous.elevationM;
      if (elevationChange > 0) ascentM += elevationChange;
      if (elevationChange < 0) descentM += Math.abs(elevationChange);

      const segmentM = segmentKm * 1000;
      if (segmentM >= 15 && elevationChange > 0) {
        maxGradePct = Math.max(maxGradePct, (elevationChange / segmentM) * 100);
      }
    }

    points.push(point);
  });

  const elevations = points.map((point) => point.elevationM);
  const lats = points.map((point) => point.lat);
  const lons = points.map((point) => point.lon);
  const trackName = asArray(gpx.trk)[0]?.name ?? asArray(gpx.rte)[0]?.name;

  return {
    id: "summit-leg-breaker",
    name: typeof trackName === "string" ? trackName : "The Summit Leg Breaker",
    source: "The Summit Leg Breaker.gpx",
    points: samplePoints(points, 1800),
    elevationProfile: samplePoints(points, 220),
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
      estimatedMovingMinutes: Math.round((distanceKm / 15) * 60),
    },
  };
}
