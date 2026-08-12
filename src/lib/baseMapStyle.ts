import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import type { BaseMapLayer } from "@/types/baseMap";

export const BASE_LAYER_IDS = ["base-osm", "base-topographic", "base-google-roadmap", "base-google-terrain", "base-google-satellite"] as const;

export const BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 19, attribution: "© OpenStreetMap contributors" },
    topographic: { type: "raster", tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"], tileSize: 256, maxzoom: 17, attribution: "Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap (CC-BY-SA)" },
    "google-roadmap": { type: "raster", tiles: ["/api/map/tiles/google/roadmap/{z}/{x}/{y}"], tileSize: 256, maxzoom: 22, attribution: "© Google" },
    "google-terrain": { type: "raster", tiles: ["/api/map/tiles/google/terrain/{z}/{x}/{y}"], tileSize: 256, maxzoom: 22, attribution: "© Google" },
    "google-satellite": { type: "raster", tiles: ["/api/map/tiles/google/satellite/{z}/{x}/{y}"], tileSize: 256, maxzoom: 22, attribution: "© Google" },
  },
  layers: [
    { id: "base-osm", type: "raster", source: "osm", layout: { visibility: "visible" } },
    { id: "base-topographic", type: "raster", source: "topographic", layout: { visibility: "none" } },
    { id: "base-google-roadmap", type: "raster", source: "google-roadmap", layout: { visibility: "none" } },
    { id: "base-google-terrain", type: "raster", source: "google-terrain", layout: { visibility: "none" } },
    { id: "base-google-satellite", type: "raster", source: "google-satellite", layout: { visibility: "none" } },
  ],
};

export function isGoogleBaseLayer(layer: BaseMapLayer, googleAvailable: boolean) {
  return googleAvailable && layer !== "topographic";
}

export function applyBaseMapLayer(map: MapLibreMap, layer: BaseMapLayer, googleAvailable: boolean) {
  const target = layer === "topographic"
    ? "base-topographic"
    : layer === "terrain" && googleAvailable
      ? "base-google-terrain"
      : layer === "satellite" && googleAvailable
        ? "base-google-satellite"
        : googleAvailable
          ? "base-google-roadmap"
          : layer === "terrain" || layer === "satellite"
            ? "base-topographic"
            : "base-osm";
  for (const id of BASE_LAYER_IDS) if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", id === target ? "visible" : "none");
  map.setProjection({ type: layer === "global" ? "globe" : "mercator" });
}
