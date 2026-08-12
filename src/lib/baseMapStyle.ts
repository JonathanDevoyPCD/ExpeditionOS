import type { Map as MapLibreMap, VisibilitySpecification } from "maplibre-gl";
import type { BaseMapLayer } from "@/types/baseMap";

export const BASE_MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const ALTERNATIVE_BASE_LAYER_IDS = ["base-topographic", "base-google-terrain", "base-google-satellite"] as const;
const libertyLayerVisibility = new WeakMap<MapLibreMap, Map<string, VisibilitySpecification | undefined>>();

export function installAlternativeBaseLayers(map: MapLibreMap) {
  if (libertyLayerVisibility.has(map)) return;

  libertyLayerVisibility.set(map, new Map(
    map.getStyle().layers.map((layer) => [layer.id, layer.layout?.visibility]),
  ));

  map.addSource("topographic", {
    type: "raster",
    tiles: ["https://tile.opentopomap.org/{z}/{x}/{y}.png"],
    tileSize: 256,
    maxzoom: 17,
    attribution: "Map data © OpenStreetMap contributors, SRTM | Map style © OpenTopoMap (CC-BY-SA)",
  });
  map.addSource("google-terrain", {
    type: "raster",
    tiles: ["/api/map/tiles/google/terrain/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 22,
    attribution: "© Google",
  });
  map.addSource("google-satellite", {
    type: "raster",
    tiles: ["/api/map/tiles/google/satellite/{z}/{x}/{y}"],
    tileSize: 256,
    maxzoom: 22,
    attribution: "© Google",
  });

  map.addLayer({ id: "base-topographic", type: "raster", source: "topographic", layout: { visibility: "none" } });
  map.addLayer({ id: "base-google-terrain", type: "raster", source: "google-terrain", layout: { visibility: "none" } });
  map.addLayer({ id: "base-google-satellite", type: "raster", source: "google-satellite", layout: { visibility: "none" } });
}

export function isGoogleBaseLayer(layer: BaseMapLayer, googleAvailable: boolean) {
  return googleAvailable && (layer === "terrain" || layer === "satellite");
}

export function applyBaseMapLayer(map: MapLibreMap, layer: BaseMapLayer, googleAvailable: boolean) {
  installAlternativeBaseLayers(map);

  const target = layer === "topographic"
    ? "base-topographic"
    : layer === "terrain"
      ? googleAvailable ? "base-google-terrain" : "base-topographic"
      : layer === "satellite"
        ? googleAvailable ? "base-google-satellite" : "base-topographic"
        : null;

  for (const [id, visibility] of libertyLayerVisibility.get(map) ?? []) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", target ? "none" : visibility ?? "visible");
  }
  for (const id of ALTERNATIVE_BASE_LAYER_IDS) {
    if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", id === target ? "visible" : "none");
  }
  map.setProjection({ type: layer === "global" ? "globe" : "mercator" });
}
