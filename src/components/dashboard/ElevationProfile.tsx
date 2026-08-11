"use client";

import type { MouseEvent } from "react";
import type { RoutePoint } from "@/types/route";

type ElevationProfileProps = {
  points: RoutePoint[];
  onHover: (point: RoutePoint | null) => void;
};

export default function ElevationProfile({ points, onHover }: ElevationProfileProps) {
  const width = 1000;
  const height = 170;
  const floor = 150;
  const min = Math.min(...points.map((point) => point.elevationM));
  const max = Math.max(...points.map((point) => point.elevationM));
  const spread = Math.max(max - min, 1);
  const totalDistance = points.at(-1)?.distanceKm ?? 1;

  const coordinates = points.map((point) => ({
    x: (point.distanceKm / totalDistance) * width,
    y: 18 + ((max - point.elevationM) / spread) * 108,
  }));
  const line = coordinates.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const area = `0,${floor} ${line} ${width},${floor}`;

  function handleMove(event: MouseEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
    const targetDistance = ratio * totalDistance;
    let nearest = points[0];
    for (const point of points) {
      if (Math.abs(point.distanceKm - targetDistance) < Math.abs(nearest.distanceKm - targetDistance)) nearest = point;
    }
    onHover(nearest);
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="h-32 w-full cursor-crosshair overflow-visible"
      onMouseMove={handleMove}
      onMouseLeave={() => onHover(null)}
      role="img"
      aria-label="Route elevation profile"
    >
      <defs>
        <linearGradient id="elevation-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#86b9b0" stopOpacity="0.48" />
          <stop offset="100%" stopColor="#86b9b0" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <line x1="0" y1={floor} x2={width} y2={floor} stroke="#4c7273" strokeOpacity="0.35" />
      <polygon points={area} fill="url(#elevation-fill)" />
      <polyline points={line} fill="none" stroke="#d0d6d6" strokeWidth="3.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
