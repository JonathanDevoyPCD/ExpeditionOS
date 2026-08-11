import type { RoutePoi } from "@/types/poi";

export type ItineraryEntry = {
  poi: RoutePoi;
  legDistanceKm: number;
  arrivalMinutes: number;
  departureMinutes: number;
};

export type ItineraryWarning = {
  severity: "medium" | "high";
  title: string;
  detail: string;
  startKm: number;
  endKm: number;
};
