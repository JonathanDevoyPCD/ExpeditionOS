"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import BaseLayerPicker from "@/components/map/BaseLayerPicker";
import { applyBaseMapLayer, BASE_MAP_STYLE, installAlternativeBaseLayers, isGoogleBaseLayer } from "@/lib/baseMapStyle";
import type { RouteAnchor } from "@/types/adventure";
import type { BaseMapLayer, MapLayerAvailability } from "@/types/baseMap";
import type { MapPlace, MapViewport } from "@/types/mapPlace";
import type { PoiCategory } from "@/types/poi";
import type { RouteDataset } from "@/types/route";

const PLACE_COLORS: Record<PoiCategory, string> = {
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

export const DAY_COLORS = ["#86b9b0", "#f2b766", "#d87979", "#9d83c6", "#55a8d7", "#b8d36b", "#c9a277"];

export type DayRange = { day: number; startKm: number; endKm: number };

function routeData(route: RouteDataset | null, dayRanges: DayRange[]) {
  if (!route) return { type: "FeatureCollection" as const, features: [] };
  const ranges = dayRanges.length ? dayRanges : [{ day: 1, startKm: 0, endKm: route.metrics.distanceKm }];
  return {
    type: "FeatureCollection" as const,
    features: ranges.map((range) => ({
      type: "Feature" as const,
      properties: { day: range.day },
      geometry: {
        type: "LineString" as const,
        coordinates: route.points
          .filter((point, index) => point.distanceKm >= range.startKm && (point.distanceKm <= range.endKm || index === route.points.length - 1))
          .map((point) => [point.lon, point.lat]),
      },
    })).filter((feature) => feature.geometry.coordinates.length >= 2),
  };
}

function placeData(places: MapPlace[], visibleCategories: PoiCategory[]) {
  return {
    type: "FeatureCollection" as const,
    features: places.filter((place) => visibleCategories.includes(place.category)).map((place) => ({
      type: "Feature" as const,
      properties: { id: place.id, category: place.category, name: place.name },
      geometry: { type: "Point" as const, coordinates: [place.lon, place.lat] },
    })),
  };
}

export default function RouteBuilderMap({
  anchors,
  route,
  dayRanges,
  places,
  visibleCategories,
  selectedPlaceId,
  onMapClick,
  onMoveAnchor,
  onViewportChange,
  onSelectPlace,
  onGoogleBaseMapChange,
  baseLayersOpen,
  onBaseLayersOpenChange,
}: {
  anchors: RouteAnchor[];
  route: RouteDataset | null;
  dayRanges: DayRange[];
  places: MapPlace[];
  visibleCategories: PoiCategory[];
  selectedPlaceId: string | null;
  onMapClick: (lat: number, lon: number) => void;
  onMoveAnchor: (id: string, lat: number, lon: number) => void;
  onViewportChange: (viewport: MapViewport) => void;
  onSelectPlace: (place: MapPlace | null) => void;
  onGoogleBaseMapChange?: (active: boolean) => void;
  baseLayersOpen?: boolean;
  onBaseLayersOpenChange?: (open: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const callbacksRef = useRef({ onMapClick, onMoveAnchor, onViewportChange, onSelectPlace });
  const placesRef = useRef(places);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const [baseLayer, setBaseLayer] = useState<BaseMapLayer>("default");
  const [googleTilesAvailable, setGoogleTilesAvailable] = useState(false);

  useEffect(() => {
    callbacksRef.current = { onMapClick, onMoveAnchor, onViewportChange, onSelectPlace };
    placesRef.current = places;
  }, [onMapClick, onMoveAnchor, onViewportChange, onSelectPlace, places]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASE_MAP_STYLE,
      center: [25.56, -33.96],
      zoom: 11,
      maxZoom: 22,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    const reportViewport = () => {
      const bounds = map.getBounds();
      callbacksRef.current.onViewportChange({
        bounds: [[bounds.getWest(), bounds.getSouth()], [bounds.getEast(), bounds.getNorth()]],
        zoom: map.getZoom(),
      });
    };
    map.on("load", () => {
      installAlternativeBaseLayers(map);
      map.addSource("builder-route", { type: "geojson", data: routeData(null, []) });
      map.addLayer({
        id: "builder-route-glow",
        type: "line",
        source: "builder-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": "#041421", "line-width": 10, "line-opacity": 0.62 },
      });
      map.addLayer({
        id: "builder-route-line",
        type: "line",
        source: "builder-route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": ["match", ["get", "day"], 1, DAY_COLORS[0], 2, DAY_COLORS[1], 3, DAY_COLORS[2], 4, DAY_COLORS[3], 5, DAY_COLORS[4], 6, DAY_COLORS[5], 7, DAY_COLORS[6], DAY_COLORS[0]],
          "line-width": 5,
        },
      });
      map.addSource("explore-places", { type: "geojson", data: placeData([], []), cluster: true, clusterRadius: 44, clusterMaxZoom: 14 });
      map.addLayer({
        id: "explore-place-clusters",
        type: "circle",
        source: "explore-places",
        filter: ["has", "point_count"],
        paint: { "circle-color": "#042630", "circle-radius": ["step", ["get", "point_count"], 17, 20, 21, 75, 26], "circle-stroke-color": "#86b9b0", "circle-stroke-width": 2 },
      });
      map.addLayer({
        id: "explore-place-cluster-count",
        type: "symbol",
        source: "explore-places",
        filter: ["has", "point_count"],
        layout: { "text-field": ["get", "point_count_abbreviated"], "text-font": ["Noto Sans Bold"], "text-size": 11 },
        paint: { "text-color": "#ffffff" },
      });
      map.addLayer({
        id: "explore-place-points",
        type: "circle",
        source: "explore-places",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius": 7,
          "circle-color": ["match", ["get", "category"], "fuel", PLACE_COLORS.fuel, "food", PLACE_COLORS.food, "groceries", PLACE_COLORS.groceries, "shopping", PLACE_COLORS.shopping, "water", PLACE_COLORS.water, "repair", PLACE_COLORS.repair, "pharmacy", PLACE_COLORS.pharmacy, "toilets", PLACE_COLORS.toilets, "attraction", PLACE_COLORS.attraction, "lodging", PLACE_COLORS.lodging, "#86b9b0"],
          "circle-stroke-color": "#041421",
          "circle-stroke-width": 2,
        },
      });
      reportViewport();
    });
    map.on("moveend", reportViewport);
    map.on("click", "explore-place-points", (event) => {
      const id = event.features?.[0]?.properties?.id as string | undefined;
      callbacksRef.current.onSelectPlace(placesRef.current.find((place) => place.id === id) ?? null);
    });
    map.on("click", "explore-place-clusters", async (event) => {
      const feature = event.features?.[0];
      const clusterId = feature?.properties?.cluster_id as number | undefined;
      if (clusterId === undefined || feature?.geometry.type !== "Point") return;
      const zoom = await (map.getSource("explore-places") as GeoJSONSource).getClusterExpansionZoom(clusterId);
      map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom, duration: 450 });
    });
    map.on("click", (event) => {
      if (map.queryRenderedFeatures(event.point, { layers: ["explore-place-points", "explore-place-clusters"] }).length) return;
      callbacksRef.current.onSelectPlace(null);
      callbacksRef.current.onMapClick(event.lngLat.lat, event.lngLat.lng);
    });
    for (const layer of ["explore-place-points", "explore-place-clusters"]) {
      map.on("mouseenter", layer, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", layer, () => { map.getCanvas().style.cursor = ""; });
    }
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

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
    onGoogleBaseMapChange?.(isGoogleBaseLayer(baseLayer, googleTilesAvailable));
  }, [baseLayer, googleTilesAvailable, onGoogleBaseMapChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource("builder-route") as GeoJSONSource | undefined)?.setData(routeData(route, dayRanges));
      if (route) map.fitBounds(route.bounds, { padding: 64, duration: 700, maxZoom: 13 });
      else if (anchors.length) {
        const bounds = new maplibregl.LngLatBounds();
        anchors.forEach((anchor) => bounds.extend([anchor.lon, anchor.lat]));
        map.fitBounds(bounds, { padding: 72, duration: 500, maxZoom: 13 });
      }
    };
    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [route, anchors, dayRanges]);

  useEffect(() => {
    const source = mapRef.current?.getSource("explore-places") as GeoJSONSource | undefined;
    source?.setData(placeData(places, visibleCategories));
  }, [places, visibleCategories]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("explore-place-points")) return;
    map.setPaintProperty("explore-place-points", "circle-radius", ["case", ["==", ["get", "id"], selectedPlaceId ?? ""], 11, 7]);
    map.setPaintProperty("explore-place-points", "circle-stroke-width", ["case", ["==", ["get", "id"], selectedPlaceId ?? ""], 4, 2]);
  }, [selectedPlaceId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = anchors.map((anchor, index) => {
      const element = document.createElement("button");
      element.className = "builder-anchor-marker";
      element.textContent = String(index + 1);
      element.title = `${anchor.name} · drag to adjust`;
      const marker = new maplibregl.Marker({ element, anchor: "center", draggable: true }).setLngLat([anchor.lon, anchor.lat]).addTo(map);
      marker.on("dragend", () => {
        const coordinate = marker.getLngLat();
        callbacksRef.current.onMoveAnchor(anchor.id, coordinate.lat, coordinate.lng);
      });
      return marker;
    });
  }, [anchors]);

  return <div className="relative h-full min-h-[620px] w-full"><div ref={containerRef} className="h-full min-h-[620px] w-full" aria-label="Editable cycling route and place discovery map" /><BaseLayerPicker active={baseLayer} googleAvailable={googleTilesAvailable} open={baseLayersOpen} onOpenChange={onBaseLayersOpenChange} onChange={setBaseLayer} /></div>;
}
