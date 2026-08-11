export const POI_CATEGORIES = [
  "fuel",
  "food",
  "groceries",
  "water",
  "repair",
  "pharmacy",
  "toilets",
  "attraction",
  "lodging",
] as const;

export type PoiCategory = (typeof POI_CATEGORIES)[number];

export type RoutePoi = {
  id: string;
  osmType: "node" | "way" | "relation";
  osmId: number;
  name: string;
  category: PoiCategory;
  subcategory: string;
  lat: number;
  lon: number;
  distanceFromRouteKm: number;
  distanceIntoRouteKm: number;
  openingHours?: string;
  phone?: string;
  website?: string;
  source: "openstreetmap";
};

export type PoiDataset = {
  items: RoutePoi[];
  generatedAt: string;
  osmTimestamp: string | null;
  corridorKm: number;
  providers: {
    openstreetmap: "active";
    google: "configured" | "not_configured";
  };
};
