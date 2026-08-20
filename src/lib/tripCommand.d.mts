import type { AdventurePlan } from "@/types/adventure";
import type { AdventureFundItem } from "@/types/funds";
import type { AdventureGearItem } from "@/types/gear";
import type { ItineraryWarning } from "@/types/itinerary";
import type { AdventureStay } from "@/types/stay";

export type TripCommandDay = {
  day: number;
  date?: string;
  title: string;
  summary: string;
  targetDistanceKm: number;
  stay?: AdventureStay;
  estimatedCost: number;
};

export type TripCommandSnapshot = {
  days: TripCommandDay[];
  blockers: string[];
  warnings: string[];
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
): TripCommandSnapshot;
