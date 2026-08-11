import "server-only";
import { createRouteDataset, decodePolyline6 } from "@/lib/routeBuilder";
import type { GeocodeResult, RouteAnchor } from "@/types/adventure";
import type { RouteDataset } from "@/types/route";

const NOMINATIM_URL = process.env.NOMINATIM_URL ?? "https://nominatim.openstreetmap.org";
const VALHALLA_URL = process.env.VALHALLA_URL ?? "https://valhalla1.openstreetmap.de";
const USER_AGENT = "ExpeditionOS-development/0.2 (local route planner)";
const CLIENT_ID = "expeditionos-local-development";
const geocodeCache = new Map<string, { expiresAt: number; items: GeocodeResult[] }>();
let lastGeocodeAt = 0;
let geocodeQueue: Promise<void> = Promise.resolve();

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function respectNominatimLimit() {
  const job = geocodeQueue.then(async () => {
    const remaining = 1100 - (Date.now() - lastGeocodeAt);
    if (remaining > 0) await wait(remaining);
    lastGeocodeAt = Date.now();
  });
  geocodeQueue = job.catch(() => undefined);
  await job;
}

export async function geocodeLocation(query: string): Promise<GeocodeResult[]> {
  const normalized = query.trim().toLowerCase();
  const cached = geocodeCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  await respectNominatimLimit();

  const url = new URL("/search", NOMINATIM_URL);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "za");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("q", query.trim());
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Place search returned ${response.status}.`);
  const data = (await response.json()) as Array<{
    place_id: number;
    lat: string;
    lon: string;
    name?: string;
    display_name: string;
    address?: { state?: string; province?: string; county?: string };
  }>;
  const items = data.flatMap<GeocodeResult>((item) => {
    const lat = Number(item.lat);
    const lon = Number(item.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [];
    return [{
      id: `osm-place-${item.place_id}`,
      name: item.name ?? item.display_name.split(",")[0],
      displayName: item.display_name,
      lat,
      lon,
      region: item.address?.state ?? item.address?.province ?? item.address?.county,
    }];
  });
  geocodeCache.set(normalized, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, items });
  return items;
}

function sampleIndices(length: number, maximum = 100) {
  if (length <= maximum) return Array.from({ length }, (_, index) => index);
  const step = (length - 1) / (maximum - 1);
  return Array.from({ length: maximum }, (_, index) => Math.round(index * step));
}

async function addElevations(coordinates: Array<{ lat: number; lon: number }>) {
  const indices = sampleIndices(coordinates.length);
  const sampled = indices.map((index) => coordinates[index]);
  const url = new URL("https://api.open-meteo.com/v1/elevation");
  url.searchParams.set("latitude", sampled.map((point) => point.lat.toFixed(6)).join(","));
  url.searchParams.set("longitude", sampled.map((point) => point.lon.toFixed(6)).join(","));

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`Elevation service returned ${response.status}.`);
    const data = (await response.json()) as { elevation?: number[] };
    if (!data.elevation || data.elevation.length !== indices.length) return coordinates;

    const result = coordinates.map((point) => ({ ...point, elevationM: 0 }));
    indices.forEach((coordinateIndex, sampleIndex) => {
      result[coordinateIndex].elevationM = data.elevation![sampleIndex];
    });
    for (let segment = 1; segment < indices.length; segment += 1) {
      const start = indices[segment - 1];
      const finish = indices[segment];
      const startElevation = result[start].elevationM;
      const finishElevation = result[finish].elevationM;
      for (let index = start + 1; index < finish; index += 1) {
        const progress = (index - start) / (finish - start);
        result[index].elevationM = startElevation + (finishElevation - startElevation) * progress;
      }
    }
    return result;
  } catch (error) {
    console.warn("Route elevation enrichment failed", error instanceof Error ? error.message : "Unknown error");
    return coordinates;
  }
}

type ValhallaResponse = {
  trip?: {
    summary?: { length?: number; time?: number };
    legs?: Array<{ shape?: string }>;
  };
  error?: string;
  error_code?: number;
};

export async function buildBicycleRoute(
  anchors: RouteAnchor[],
  name: string,
  source: string,
): Promise<RouteDataset> {
  if (anchors.length < 2) throw new Error("Add at least a start and finish before building the route.");
  if (anchors.length > 12) throw new Error("This planner supports up to 12 route anchors at a time.");

  const decoded: Array<{ lat: number; lon: number }> = [];
  let totalTimeSeconds = 0;
  for (let index = 1; index < anchors.length; index += 1) {
    const legAnchors = [anchors[index - 1], anchors[index]];
    const response = await fetch(new URL("/route", VALHALLA_URL), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Id": CLIENT_ID,
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        locations: legAnchors.map((anchor) => ({ lat: anchor.lat, lon: anchor.lon, type: "break" })),
        costing: "bicycle",
        costing_options: { bicycle: { bicycle_type: "Hybrid", use_hills: 0.35, use_roads: 0.55 } },
        directions_options: { units: "kilometers", language: "en-US" },
      }),
      signal: AbortSignal.timeout(50_000),
    });
    const data = (await response.json()) as ValhallaResponse;
    if (!response.ok || !data.trip?.legs?.length) {
      throw new Error(data.error ?? `No cycleable route could be found from ${legAnchors[0].name} to ${legAnchors[1].name}.`);
    }
    const legPoints = data.trip.legs.flatMap((leg, legIndex) => {
      const points = leg.shape ? decodePolyline6(leg.shape) : [];
      return legIndex > 0 ? points.slice(1) : points;
    });
    decoded.push(...(index > 1 ? legPoints.slice(1) : legPoints));
    totalTimeSeconds += data.trip.summary?.time ?? 0;
  }
  if (decoded.length < 2) throw new Error("The routing provider returned an empty route.");
  const coordinates = await addElevations(decoded);
  return createRouteDataset({
    id: `route-${Date.now().toString(36)}`,
    name,
    source,
    coordinates,
    estimatedMovingMinutes: totalTimeSeconds ? Math.round(totalTimeSeconds / 60) : undefined,
  });
}
