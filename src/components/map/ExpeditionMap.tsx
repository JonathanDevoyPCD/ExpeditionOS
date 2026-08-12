"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import BaseLayerPicker from "@/components/map/BaseLayerPicker";
import { applyBaseMapLayer, BASE_MAP_STYLE } from "@/lib/baseMapStyle";
import type { BaseMapLayer, MapLayerAvailability } from "@/types/baseMap";
import type { PoiCategory, RoutePoi } from "@/types/poi";
import type { RouteDataset, RoutePoint } from "@/types/route";

type ExpeditionMapProps = {
  route: RouteDataset;
  focusPoint: RoutePoint | null;
  terrainEnabled: boolean;
  pois: RoutePoi[];
  visiblePoiCategories: PoiCategory[];
  selectedPoiId: string | null;
  plannedPoiIds: string[];
  onSelectPoi: (poi: RoutePoi | null) => void;
};

const MAP_MAX_ZOOM = 22;
const TERRAIN_TILES = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const POI_COLORS: Record<PoiCategory, string> = {
  fuel: "#f2b766",
  food: "#d87979",
  groceries: "#86b9b0",
  shopping: "#e4a6c8",
  water: "#55a8d7",
  repair: "#9d83c6",
  pharmacy: "#e66b7b",
  toilets: "#d0d6d6",
  attraction: "#b8d36b",
  lodging: "#c9a277",
};

function poiData(pois: RoutePoi[], visibleCategories: PoiCategory[], plannedPoiIds: string[]) {
  return {
    type: "FeatureCollection" as const,
    features: pois
      .filter((poi) => visibleCategories.includes(poi.category) || plannedPoiIds.includes(poi.id))
      .map((poi) => ({
        type: "Feature" as const,
        properties: { id: poi.id, category: poi.category, name: poi.name, planned: plannedPoiIds.includes(poi.id) },
        geometry: { type: "Point" as const, coordinates: [poi.lon, poi.lat] },
      })),
  };
}

export default function ExpeditionMap({
  route,
  focusPoint,
  terrainEnabled,
  pois,
  visiblePoiCategories,
  selectedPoiId,
  plannedPoiIds,
  onSelectPoi,
}: ExpeditionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const poisRef = useRef(pois);
  const categoriesRef = useRef(visiblePoiCategories);
  const plannedPoiIdsRef = useRef(plannedPoiIds);
  const selectPoiRef = useRef(onSelectPoi);
  const initialTerrainEnabled = useRef(terrainEnabled);
  const [baseLayer, setBaseLayer] = useState<BaseMapLayer>("default");
  const [googleTilesAvailable, setGoogleTilesAvailable] = useState(false);

  useEffect(() => {
    poisRef.current = pois;
    categoriesRef.current = visiblePoiCategories;
    plannedPoiIdsRef.current = plannedPoiIds;
    selectPoiRef.current = onSelectPoi;
  }, [pois, visiblePoiCategories, plannedPoiIds, onSelectPoi]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE,
      center: [route.start.lon, route.start.lat],
      zoom: 11,
      maxZoom: MAP_MAX_ZOOM,
      pitch: initialTerrainEnabled.current ? 56 : 0,
      bearing: initialTerrainEnabled.current ? -18 : 0,
    });

    mapRef.current = map;
    map.on("error", (event) => console.error("[ExpeditionMap]", event.error));
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, showZoom: true, visualizePitch: true }),
      "bottom-right",
    );

    const markers: maplibregl.Marker[] = [];

    map.on("load", () => {
      map.addSource("expedition-route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: route.points.map((point) => [point.lon, point.lat]) },
        },
      });

      map.addLayer({
        id: "expedition-route-glow",
        type: "line",
        source: "expedition-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#041421", "line-width": 11, "line-opacity": 0.56 },
      });
      map.addLayer({
        id: "expedition-route-line",
        type: "line",
        source: "expedition-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#86b9b0",
          "line-width": ["interpolate", ["linear"], ["zoom"], 8, 3, 14, 6],
          "line-opacity": 0.98,
        },
      });

      map.addSource("expedition-pois", {
        type: "geojson",
        data: poiData(poisRef.current, categoriesRef.current, plannedPoiIdsRef.current),
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 42,
      });
      map.addLayer({
        id: "poi-clusters",
        type: "circle",
        source: "expedition-pois",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#042630",
          "circle-radius": ["step", ["get", "point_count"], 17, 10, 21, 35, 25],
          "circle-stroke-color": "#86b9b0",
          "circle-stroke-width": 2,
          "circle-opacity": 0.94,
        },
      });
      map.addLayer({
        id: "poi-cluster-count",
        type: "symbol",
        source: "expedition-pois",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 11 },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "poi-planned-rings",
        type: "circle",
        source: "expedition-pois",
        filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "planned"], true]],
        paint: {
          "circle-radius": 13,
          "circle-color": "rgba(4, 20, 33, 0)",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
          "circle-stroke-opacity": 0.95,
        },
      });
      map.addLayer({
        id: "poi-points",
        type: "circle",
        source: "expedition-pois",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-color": [
            "match", ["get", "category"],
            "fuel", POI_COLORS.fuel,
            "food", POI_COLORS.food,
            "groceries", POI_COLORS.groceries,
            "shopping", POI_COLORS.shopping,
            "water", POI_COLORS.water,
            "repair", POI_COLORS.repair,
            "pharmacy", POI_COLORS.pharmacy,
            "toilets", POI_COLORS.toilets,
            "attraction", POI_COLORS.attraction,
            "lodging", POI_COLORS.lodging,
            "#86b9b0",
          ],
          "circle-stroke-color": "#041421",
          "circle-stroke-width": 2,
        },
      });

      map.addSource("focus-point", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "focus-point-ring",
        type: "circle",
        source: "focus-point",
        paint: { "circle-radius": 9, "circle-color": "#d0d6d6", "circle-stroke-width": 4, "circle-stroke-color": "#041421" },
      });

      map.addSource("terrain-dem", {
        type: "raster-dem",
        tiles: [TERRAIN_TILES],
        tileSize: 256,
        maxzoom: 15,
        encoding: "terrarium",
        attribution: "Terrain data via AWS Open Data",
      });
      if (initialTerrainEnabled.current) map.setTerrain({ source: "terrain-dem", exaggeration: 1.35 });

      for (const entry of [
        { point: route.start, className: "route-marker route-marker--start", title: "Start" },
        { point: route.finish, className: "route-marker route-marker--finish", title: "Finish" },
      ]) {
        const element = document.createElement("div");
        element.className = entry.className;
        element.title = entry.title;
        markers.push(new maplibregl.Marker({ element }).setLngLat([entry.point.lon, entry.point.lat]).addTo(map));
      }

      map.on("click", "poi-points", (event) => {
        const id = event.features?.[0]?.properties?.id as string | undefined;
        const poi = poisRef.current.find((candidate) => candidate.id === id) ?? null;
        selectPoiRef.current(poi);
      });
      map.on("click", "poi-clusters", async (event) => {
        const feature = event.features?.[0];
        const clusterId = feature?.properties?.cluster_id as number | undefined;
        if (clusterId === undefined || feature?.geometry.type !== "Point") return;
        const zoom = await (map.getSource("expedition-pois") as GeoJSONSource).getClusterExpansionZoom(clusterId);
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 500 });
      });
      for (const layer of ["poi-points", "poi-clusters"]) {
        map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
      }
      map.on("click", (event) => {
        if (map.queryRenderedFeatures(event.point, { layers: ["poi-points", "poi-clusters"] }).length === 0) {
          selectPoiRef.current(null);
        }
      });

      map.fitBounds(route.bounds, { padding: 64, duration: 1100, maxZoom: 14 });
    });

    return () => {
      markers.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [route]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/map/layers", { signal: controller.signal })
      .then((response) => response.json() as Promise<MapLayerAvailability>)
      .then((result) => setGoogleTilesAvailable(result.googleTiles))
      .catch(() => setGoogleTilesAvailable(false));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => applyBaseMapLayer(map, baseLayer, googleTilesAvailable);
    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [baseLayer, googleTilesAvailable]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded() || !map.getSource("terrain-dem")) return;
    map.setTerrain(terrainEnabled ? { source: "terrain-dem", exaggeration: 1.35 } : null);
    map.easeTo({ pitch: terrainEnabled ? 56 : 0, bearing: terrainEnabled ? -18 : 0, duration: 650 });
  }, [terrainEnabled]);

  useEffect(() => {
    const source = mapRef.current?.getSource("focus-point") as GeoJSONSource | undefined;
    if (!source) return;
    source.setData(focusPoint
      ? { type: "Feature", properties: {}, geometry: { type: "Point", coordinates: [focusPoint.lon, focusPoint.lat] } }
      : { type: "FeatureCollection", features: [] });
  }, [focusPoint]);

  useEffect(() => {
    const source = mapRef.current?.getSource("expedition-pois") as GeoJSONSource | undefined;
    source?.setData(poiData(pois, visiblePoiCategories, plannedPoiIds));
  }, [pois, visiblePoiCategories, plannedPoiIds]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("poi-points")) return;
    map.setPaintProperty("poi-points", "circle-radius", ["case", ["==", ["get", "id"], selectedPoiId ?? ""], 11, 7]);
    map.setPaintProperty("poi-points", "circle-stroke-width", ["case", ["==", ["get", "id"], selectedPoiId ?? ""], 4, 2]);
    if (selectedPoiId) {
      const poi = pois.find((candidate) => candidate.id === selectedPoiId);
      if (poi) map.easeTo({ center: [poi.lon, poi.lat], zoom: Math.max(map.getZoom(), 14), duration: 500 });
    }
  }, [selectedPoiId, pois]);

  return <div className="relative h-full min-h-[420px] w-full"><div ref={containerRef} className="h-full min-h-[420px] w-full" aria-label="Interactive expedition route map" /><BaseLayerPicker active={baseLayer} googleAvailable={googleTilesAvailable} onChange={setBaseLayer} /></div>;
}
