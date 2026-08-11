import { readFile } from "node:fs/promises";
import path from "node:path";
import { projectPointOntoRoute } from "@/lib/geo";
import { parseGpx } from "@/lib/gpx";
import type { PoiCategory, PoiDataset, RoutePoi } from "@/types/poi";
import type { RouteAnchor } from "@/types/adventure";
import type { RouteDataset } from "@/types/route";

type OsmElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type OverpassResponse = {
  osm3s?: { timestamp_osm_base?: string };
  elements?: OsmElement[];
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const OVERPASS_FALLBACK_URL = "https://overpass.kumi.systems/api/interpreter";
const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; elements: OsmElement[]; timestamp: string | null }>();
const pending = new Map<string, Promise<{ elements: OsmElement[]; timestamp: string | null }>>();

function categoryFor(tags: Record<string, string>): PoiCategory | null {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const tourism = tags.tourism;

  if (amenity === "fuel") return "fuel";
  if (["restaurant", "cafe", "fast_food", "marketplace"].includes(amenity) || ["bakery", "deli"].includes(shop)) return "food";
  if (["supermarket", "convenience"].includes(shop)) return "groceries";
  if (amenity === "drinking_water") return "water";
  if (amenity === "bicycle_repair" || shop === "bicycle") return "repair";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "toilets") return "toilets";
  if (["attraction", "viewpoint", "picnic_site"].includes(tourism)) return "attraction";
  if (["hotel", "guest_house", "hostel", "camp_site"].includes(tourism)) return "lodging";
  return null;
}

function fallbackName(category: PoiCategory) {
  return {
    fuel: "Fuel station",
    food: "Food stop",
    groceries: "Grocery stop",
    water: "Drinking water",
    repair: "Bicycle service",
    pharmacy: "Pharmacy",
    toilets: "Public toilets",
    attraction: "Point of interest",
    lodging: "Accommodation",
  }[category];
}

function overpassQuery(bounds: [[number, number], [number, number]], paddingKm: number) {
  const [[west, south], [east, north]] = bounds;
  const middleLat = (south + north) / 2;
  const latPadding = paddingKm / 111.32;
  const lonPadding = paddingKm / (111.32 * Math.max(Math.cos((middleLat * Math.PI) / 180), 0.2));
  const bbox = `${south - latPadding},${west - lonPadding},${north + latPadding},${east + lonPadding}`;
  return `[out:json][timeout:35];(
    nwr[amenity~"^(fuel|restaurant|cafe|fast_food|drinking_water|marketplace|toilets|pharmacy|bicycle_repair)$"](${bbox});
    nwr[shop~"^(supermarket|convenience|bakery|deli|bicycle)$"](${bbox});
    nwr[tourism~"^(attraction|viewpoint|picnic_site|hotel|guest_house|hostel|camp_site)$"](${bbox});
  );out center tags;`;
}

function routeOverpassQuery(route: RouteDataset, anchors: RouteAnchor[] = []) {
  const uniqueAnchors = anchors.filter((anchor, index, all) => all.findIndex((candidate) =>
    Math.abs(candidate.lat - anchor.lat) < 0.001 && Math.abs(candidate.lon - anchor.lon) < 0.001,
  ) === index);
  const maximum = 6;
  const step = Math.max(1, Math.ceil(route.points.length / maximum));
  const centers = uniqueAnchors.length >= 2
    ? uniqueAnchors.slice(0, 8)
    : route.points.filter((_, index) => index % step === 0).slice(0, maximum);
  const statements = centers.flatMap((point) => [
    `nwr[amenity~"^(fuel|restaurant|cafe|fast_food|drinking_water|marketplace|toilets|pharmacy|bicycle_repair)$"](around:5000,${point.lat},${point.lon});`,
    `nwr[shop~"^(supermarket|convenience|bakery|deli|bicycle)$"](around:5000,${point.lat},${point.lon});`,
    `nwr[tourism~"^(attraction|viewpoint|picnic_site|hotel|guest_house|hostel|camp_site)$"](around:5000,${point.lat},${point.lon});`,
  ]).join("\n");
  return `[out:json][timeout:40];(${statements});out center tags;`;
}

async function fetchElements(route: RouteDataset, anchors: RouteAnchor[] = []) {
  const anchorKey = anchors.map((anchor) => `${anchor.lat.toFixed(2)},${anchor.lon.toFixed(2)}`).join(";");
  const key = `${route.id}:${route.bounds.flat().map((value) => value.toFixed(3)).join(":")}:${anchorKey}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const active = pending.get(key);
  if (active) return active;

  const request = (async () => {
    const query = route.metrics.distanceKm > 140 ? routeOverpassQuery(route, anchors) : overpassQuery(route.bounds, 5);
    let data: OverpassResponse | null = null;
    let lastStatus = 502;
    for (const endpoint of [OVERPASS_URL, OVERPASS_FALLBACK_URL]) {
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "User-Agent": "ExpeditionOS-development/0.2",
          },
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(45_000),
        });
        lastStatus = response.status;
        if (!response.ok) continue;
        data = (await response.json()) as OverpassResponse;
        if ((data.elements?.length ?? 0) > 0 || route.metrics.distanceKm <= 140) break;
      } catch {
        continue;
      }
    }
    if (!data) throw new Error(`OpenStreetMap service returned ${lastStatus}.`);
    const result = {
      elements: data.elements ?? [],
      timestamp: data.osm3s?.timestamp_osm_base ?? null,
      expiresAt: Date.now() + CACHE_MS,
    };
    if (result.elements.length > 0 || route.metrics.distanceKm <= 140) cache.set(key, result);
    return result;
  })().finally(() => {
    pending.delete(key);
  });

  pending.set(key, request);
  return request;
}

export async function getRoutePois(corridorKm = 1.5): Promise<PoiDataset> {
  const xml = await readFile(path.join(process.cwd(), "The Summit Leg Breaker.gpx"), "utf8");
  const route = parseGpx(xml);
  return getRoutePoisForRoute(route, corridorKm);
}

export async function getRoutePoisForRoute(route: RouteDataset, corridorKm = 1.5, anchors: RouteAnchor[] = []): Promise<PoiDataset> {
  const { elements, timestamp } = await fetchElements(route, anchors);

  const items = elements.flatMap<RoutePoi>((element) => {
    const lat = element.lat ?? element.center?.lat;
    const lon = element.lon ?? element.center?.lon;
    const tags = element.tags ?? {};
    const category = categoryFor(tags);
    if (lat === undefined || lon === undefined || !category) return [];

    const projected = projectPointOntoRoute({ lat, lon }, route.points);
    if (projected.distanceFromRouteKm > corridorKm) return [];

    const subcategory = tags.amenity ?? tags.shop ?? tags.tourism ?? category;
    return [{
      id: `osm-${element.type}-${element.id}`,
      osmType: element.type,
      osmId: element.id,
      name: tags.name ?? tags.brand ?? tags.operator ?? fallbackName(category),
      category,
      subcategory,
      lat,
      lon,
      ...projected,
      openingHours: tags.opening_hours,
      phone: tags.phone ?? tags["contact:phone"],
      website: tags.website ?? tags["contact:website"],
      source: "openstreetmap",
    }];
  });

  items.sort((a, b) => a.distanceIntoRouteKm - b.distanceIntoRouteKm || a.distanceFromRouteKm - b.distanceFromRouteKm);

  return {
    items,
    generatedAt: new Date().toISOString(),
    osmTimestamp: timestamp,
    corridorKm,
    providers: {
      openstreetmap: "active",
      google: process.env.GOOGLE_MAPS_API_KEY ? "configured" : "not_configured",
    },
  };
}
