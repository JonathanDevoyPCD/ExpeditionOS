import type { RoutePoint } from "@/types/route";

const EARTH_RADIUS_KM = 6371.0088;

export function projectPointOntoRoute(
  point: Pick<RoutePoint, "lat" | "lon">,
  route: RoutePoint[],
): { distanceFromRouteKm: number; distanceIntoRouteKm: number } {
  if (route.length < 2) return { distanceFromRouteKm: Number.POSITIVE_INFINITY, distanceIntoRouteKm: 0 };

  const radians = Math.PI / 180;
  const referenceLat = point.lat * radians;
  const toLocal = (candidate: Pick<RoutePoint, "lat" | "lon">) => ({
    x: (candidate.lon - point.lon) * radians * EARTH_RADIUS_KM * Math.cos(referenceLat),
    y: (candidate.lat - point.lat) * radians * EARTH_RADIUS_KM,
  });

  let bestDistance = Number.POSITIVE_INFINITY;
  let bestRouteDistance = 0;

  for (let index = 0; index < route.length - 1; index += 1) {
    const start = toLocal(route[index]);
    const finish = toLocal(route[index + 1]);
    const dx = finish.x - start.x;
    const dy = finish.y - start.y;
    const segmentLengthSquared = dx * dx + dy * dy;
    const rawT = segmentLengthSquared === 0 ? 0 : -(start.x * dx + start.y * dy) / segmentLengthSquared;
    const t = Math.max(0, Math.min(1, rawT));
    const projectedX = start.x + t * dx;
    const projectedY = start.y + t * dy;
    const distance = Math.hypot(projectedX, projectedY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestRouteDistance = route[index].distanceKm + t * (route[index + 1].distanceKm - route[index].distanceKm);
    }
  }

  return {
    distanceFromRouteKm: Number(bestDistance.toFixed(2)),
    distanceIntoRouteKm: Number(bestRouteDistance.toFixed(1)),
  };
}
