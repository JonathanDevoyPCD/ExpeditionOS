import type { AdventurePlan } from "@/types/adventure";
import type { AdventureFundItem } from "@/types/funds";
import type { AdventureGearItem } from "@/types/gear";
import type { ItineraryWarning } from "@/types/itinerary";
import type { AdventureStay } from "@/types/stay";

export type TripCommandWorkspace = "Weather" | "Stays" | "Gear" | "Funds" | "Route";
export type TripCommandStatus = "blocked" | "attention" | "ready";
export type TripCommandForecastStatus = "dates_needed" | "past" | "not_yet_available" | "partial" | "available";

export type TripCommandFinding = {
  id: string;
  severity: "blocker" | "warning";
  message: string;
  workspace: TripCommandWorkspace;
  actionLabel: string;
};

export type TripCommandDay = {
  day: number;
  date?: string;
  forecastStatus: Exclude<TripCommandForecastStatus, "partial">;
  title: string;
  summary: string;
  targetDistanceKm: number;
  stay?: AdventureStay;
  estimatedCost: number;
};

export type TripCommandSnapshot = {
  days: TripCommandDay[];
  status: TripCommandStatus;
  findings: TripCommandFinding[];
  blockers: string[];
  warnings: string[];
  forecastStatus: TripCommandForecastStatus;
  forecastLabel: string;
  selectedStays: number;
  requiredNights: number;
  packedCritical: number;
  criticalTotal: number;
  estimatedBudget: number;
  currency: string;
};

export function buildTripCommandSnapshot(
  adventure: AdventurePlan,
  stays: AdventureStay[],
  gear: AdventureGearItem[],
  funds: AdventureFundItem[],
  itineraryWarnings: ItineraryWarning[],
  now?: Date,
): TripCommandSnapshot;
