"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteAnchor } from "@/types/adventure";
import type { RouteDataset } from "@/types/route";

const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
};

function routeData(route: RouteDataset | null) {
  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "LineString" as const,
      coordinates: route?.points.map((point) => [point.lon, point.lat]) ?? [],
    },
  };
}

export default function RouteBuilderMap({
  anchors,
  route,
  onMapClick,
}: {
  anchors: RouteAnchor[];
  route: RouteDataset | null;
  onMapClick: (lat: number, lon: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const clickRef = useRef(onMapClick);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [24.5, -33.75],
      zoom: 6.5,
      maxZoom: 19,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right");
    map.on("load", () => {
      map.addSource("builder-route", { type: "geojson", data: routeData(null) });
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
        paint: { "line-color": "#86b9b0", "line-width": 5 },
      });
    });
    map.on("click", (event) => clickRef.current(event.lngLat.lat, event.lngLat.lng));
    map.getCanvas().style.cursor = "crosshair";
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const update = () => {
      (map.getSource("builder-route") as GeoJSONSource | undefined)?.setData(routeData(route));
      if (route) map.fitBounds(route.bounds, { padding: 64, duration: 700, maxZoom: 14 });
      else if (anchors.length) {
        const bounds = new maplibregl.LngLatBounds();
        anchors.forEach((anchor) => bounds.extend([anchor.lon, anchor.lat]));
        map.fitBounds(bounds, { padding: 72, duration: 500, maxZoom: 13 });
      }
    };
    if (map.isStyleLoaded()) update(); else map.once("load", update);
  }, [route, anchors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = anchors.map((anchor, index) => {
      const element = document.createElement("button");
      element.className = "builder-anchor-marker";
      element.textContent = String(index + 1);
      element.title = anchor.name;
      return new maplibregl.Marker({ element, anchor: "center" }).setLngLat([anchor.lon, anchor.lat]).addTo(map);
    });
  }, [anchors]);

  return <div ref={containerRef} className="h-full min-h-[510px] w-full" aria-label="Manual cycling route builder map" />;
}
