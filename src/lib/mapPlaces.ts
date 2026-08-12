import "server-only";
import { mapPlaceFromElement, placeOverpassQuery, type OverpassPlaceResponse } from "@/lib/placeData";
import { googleApiKey } from "@/lib/googlePlaces";
import type { MapPlaceDataset } from "@/types/mapPlace";

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; dataset: MapPlaceDataset }>();
const pending = new Map<string, Promise<MapPlaceDataset>>();

export async function getMapPlaces(
  bounds: [[number, number], [number, number]],
  zoom: number,
): Promise<MapPlaceDataset> {
  const [[west, south], [east, north]] = bounds;
  const width = east - west;
  const height = north - south;
  const zoomRequired = zoom < 10 || width > 1.1 || height > 0.8;
  const base: Omit<MapPlaceDataset, "items" | "osmTimestamp"> = {
    generatedAt: new Date().toISOString(),
    bounds,
    zoom,
    zoomRequired,
    providers: {
      openstreetmap: "active",
      geoapify: process.env.GEOAPIFY_API_KEY ? "configured" : "not_configured",
      google: googleApiKey() ? "configured" : "not_configured",
      booking: process.env.BOOKING_API_KEY && process.env.BOOKING_AFFILIATE_ID ? "configured" : "not_configured",
    },
  };
  if (zoomRequired) return { ...base, items: [], osmTimestamp: null };

  const centerStepLon = Math.max(0.03, width * 0.5);
  const centerStepLat = Math.max(0.03, height * 0.5);
  const centerLon = Math.round(((west + east) / 2) / centerStepLon) * centerStepLon;
  const centerLat = Math.round(((south + north) / 2) / centerStepLat) * centerStepLat;
  const queryWidth = Math.min(1.1, Math.max(0.12, width * 1.75));
  const queryHeight = Math.min(0.8, Math.max(0.12, height * 1.75));
  const queryBounds = {
    west: centerLon - queryWidth / 2,
    south: centerLat - queryHeight / 2,
    east: centerLon + queryWidth / 2,
    north: centerLat + queryHeight / 2,
  };
  const key = [queryBounds.west, queryBounds.south, queryBounds.east, queryBounds.north].map((value) => value.toFixed(3)).join(":");
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return { ...cached.dataset, bounds, zoom };
  const active = pending.get(key);
  if (active) return active;

  const request = (async () => {
    const query = placeOverpassQuery(`${queryBounds.south},${queryBounds.west},${queryBounds.north},${queryBounds.east}`);
    let data: OverpassPlaceResponse | null = null;
    let lastStatus = 502;
    for (const endpoint of ENDPOINTS) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "ExpeditionOS-development/0.3",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(40_000),
        });
        lastStatus = response.status;
        if (!response.ok) continue;
        data = (await response.json()) as OverpassPlaceResponse;
        break;
      } catch {
        continue;
      }
    }
    if (!data) throw new Error(`OpenStreetMap place service returned ${lastStatus}.`);
    const seen = new Set<string>();
    const items = (data.elements ?? []).flatMap((element) => {
      const place = mapPlaceFromElement(element);
      if (!place || seen.has(place.id)) return [];
      seen.add(place.id);
      return [place];
    }).slice(0, 1200);
    const dataset: MapPlaceDataset = {
      ...base,
      items,
      osmTimestamp: data.osm3s?.timestamp_osm_base ?? null,
    };
    cache.set(key, { expiresAt: Date.now() + CACHE_MS, dataset });
    return dataset;
  })().finally(() => pending.delete(key));
  pending.set(key, request);
  return request;
}
