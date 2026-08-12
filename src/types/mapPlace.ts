import type { PoiCategory } from "@/types/poi";

export type MapPlace = {
  id: string;
  osmType?: "node" | "way" | "relation";
  osmId?: number;
  googlePlaceId?: string;
  name: string;
  hasMappedName: boolean;
  category: PoiCategory;
  subcategory: string;
  lat: number;
  lon: number;
  address?: string;
  openingHours?: string;
  phone?: string;
  website?: string;
  classificationStars?: number;
  bookingSearchUrl?: string;
  source: "openstreetmap" | "google_places";
};

export type MapPlaceDataset = {
  items: MapPlace[];
  generatedAt: string;
  osmTimestamp: string | null;
  bounds: [[number, number], [number, number]];
  zoom: number;
  zoomRequired: boolean;
  providers: {
    openstreetmap: "active";
    geoapify: "configured" | "not_configured";
    google: "configured" | "not_configured";
    booking: "configured" | "not_configured";
  };
};

export type MapViewport = {
  bounds: [[number, number], [number, number]];
  zoom: number;
};
