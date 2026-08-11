import type { ItineraryEntry, ItineraryWarning } from "@/types/itinerary";
import type { PoiCategory, RoutePoi } from "@/types/poi";
import type { RouteDataset } from "@/types/route";

const RESUPPLY_CATEGORIES = new Set<PoiCategory>(["fuel", "food", "groceries", "water"]);
const SUGGESTION_WEIGHTS: Partial<Record<PoiCategory, number>> = {
  water: 0,
  groceries: 0.3,
  food: 0.7,
  fuel: 1.2,
};

function startMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 7 * 60;
}

export function formatClock(totalMinutes: number) {
  const normalized = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
}

export function buildItinerary(
  stops: RoutePoi[],
  route: RouteDataset,
  startTime: string,
  breakMinutes = 10,
): { entries: ItineraryEntry[]; finishMinutes: number } {
  const ordered = [...stops].sort((a, b) => a.distanceIntoRouteKm - b.distanceIntoRouteKm);
  const minutesPerKm = route.metrics.estimatedMovingMinutes / route.metrics.distanceKm;
  const departure = startMinutes(startTime);

  const entries = ordered.map((poi, index) => {
    const previousKm = index === 0 ? 0 : ordered[index - 1].distanceIntoRouteKm;
    const arrivalMinutes = departure + poi.distanceIntoRouteKm * minutesPerKm + index * breakMinutes;
    return {
      poi,
      legDistanceKm: Number((poi.distanceIntoRouteKm - previousKm).toFixed(1)),
      arrivalMinutes,
      departureMinutes: arrivalMinutes + breakMinutes,
    };
  });

  return {
    entries,
    finishMinutes: departure + route.metrics.estimatedMovingMinutes + ordered.length * breakMinutes,
  };
}

export function findItineraryWarnings(stops: RoutePoi[], routeDistanceKm: number): ItineraryWarning[] {
  const resupplyPoints = stops
    .filter((poi) => RESUPPLY_CATEGORIES.has(poi.category))
    .map((poi) => poi.distanceIntoRouteKm)
    .sort((a, b) => a - b);
  const anchors = [0, ...resupplyPoints, routeDistanceKm];
  const warnings: ItineraryWarning[] = [];

  for (let index = 1; index < anchors.length; index += 1) {
    const startKm = anchors[index - 1];
    const endKm = anchors[index];
    const gap = endKm - startKm;
    if (gap > 35) {
      warnings.push({
        severity: gap > 50 ? "high" : "medium",
        title: `${gap.toFixed(1)} km without planned resupply`,
        detail: `No selected fuel, food, grocery or water stop between ${startKm.toFixed(1)} km and ${endKm.toFixed(1)} km.`,
        startKm,
        endKm,
      });
    }
  }

  if (!stops.some((poi) => poi.category === "water")) {
    warnings.push({
      severity: "medium",
      title: "No dedicated water point selected",
      detail: "Food, grocery and fuel stops may sell drinks, but none is mapped specifically as drinking water in this itinerary.",
      startKm: 0,
      endKm: routeDistanceKm,
    });
  }

  return warnings;
}

export function suggestRouteStops(pois: RoutePoi[], routeDistanceKm: number) {
  const candidates = pois.filter((poi) => RESUPPLY_CATEGORIES.has(poi.category) && poi.distanceFromRouteKm <= 1);
  const selected: RoutePoi[] = [];

  for (let targetKm = 25; targetKm < routeDistanceKm - 8; targetKm += 27) {
    const best = candidates
      .filter((poi) => !selected.some((selectedPoi) => selectedPoi.id === poi.id))
      .filter((poi) => Math.abs(poi.distanceIntoRouteKm - targetKm) <= 15)
      .sort((a, b) => {
        const aScore = Math.abs(a.distanceIntoRouteKm - targetKm) + a.distanceFromRouteKm * 4 + (SUGGESTION_WEIGHTS[a.category] ?? 3);
        const bScore = Math.abs(b.distanceIntoRouteKm - targetKm) + b.distanceFromRouteKm * 4 + (SUGGESTION_WEIGHTS[b.category] ?? 3);
        return aScore - bScore;
      })[0];
    if (best) selected.push(best);
  }

  const waterPoints = candidates
    .filter((poi) => poi.category === "water")
    .filter((poi) => !selected.some((selectedPoi) => selectedPoi.id === poi.id));
  if (waterPoints.length && !selected.some((poi) => poi.category === "water")) selected.push(waterPoints[0]);

  return selected.sort((a, b) => a.distanceIntoRouteKm - b.distanceIntoRouteKm).slice(0, 8);
}

function xmlEscape(value: string) {
  return value.replace(/[<>&"']/g, (character) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[character]!);
}

export function buildItineraryGpx(route: RouteDataset, stops: RoutePoi[]) {
  const waypoints = [...stops]
    .sort((a, b) => a.distanceIntoRouteKm - b.distanceIntoRouteKm)
    .map((poi) => `  <wpt lat="${poi.lat}" lon="${poi.lon}"><name>${xmlEscape(poi.name)}</name><type>${xmlEscape(poi.category)}</type><desc>${poi.distanceIntoRouteKm.toFixed(1)} km into route; ${poi.distanceFromRouteKm.toFixed(1)} km from track</desc></wpt>`)
    .join("\n");
  const trackPoints = route.points
    .map((point) => `      <trkpt lat="${point.lat}" lon="${point.lon}"><ele>${point.elevationM}</ele></trkpt>`)
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ExpeditionOS" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${xmlEscape(`${route.name} itinerary`)}</name></metadata>
${waypoints}
  <trk><name>${xmlEscape(route.name)}</name><trkseg>
${trackPoints}
  </trkseg></trk>
</gpx>`;
}
