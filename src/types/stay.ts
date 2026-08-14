export const ACCOMMODATION_TYPES = [
  "backpackers",
  "guest_house",
  "bed_and_breakfast",
  "self_catering",
  "camping",
  "hotel",
  "other",
] as const;

export type AccommodationType = (typeof ACCOMMODATION_TYPES)[number];
export type StayPlacement = "candidate" | "selected" | "backup";
export type ReservationStatus = "researching" | "contacted" | "reserved" | "paid" | "confirmed";
export type StaySource = "manual" | "openstreetmap" | "google" | "provider";

export type AdventureStay = {
  id: string;
  adventureId: string;
  createdBy: string;
  name: string;
  accommodationType: AccommodationType;
  placement: StayPlacement;
  reservationStatus: ReservationStatus;
  stageDay?: number;
  checkIn?: string;
  checkOut?: string;
  adults: number;
  rooms: number;
  currency: string;
  nightlyPrice?: number;
  totalPrice?: number;
  rating?: number;
  distanceFromRouteKm?: number;
  address?: string;
  lat?: number;
  lon?: number;
  contactPhone?: string;
  contactEmail?: string;
  source: StaySource;
  sourceReference?: string;
  sourceUrl?: string;
  bookingReference?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdventureStayDraft = Omit<AdventureStay, "id" | "adventureId" | "createdBy" | "createdAt" | "updatedAt">;

export const accommodationTypeLabels: Record<AccommodationType, string> = {
  backpackers: "Backpackers / hostel",
  guest_house: "Guest house",
  bed_and_breakfast: "Bed and breakfast",
  self_catering: "Self-catering",
  camping: "Camping",
  hotel: "Hotel",
  other: "Other",
};
