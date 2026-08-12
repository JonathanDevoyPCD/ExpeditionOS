export type GooglePlaceLookupInput = {
  name: string;
  address?: string;
  lat: number;
  lon: number;
  hasMappedName?: boolean;
  googlePlaceId?: string;
};

export type GooglePlaceDetails = {
  id: string;
  displayName: string;
  formattedAddress?: string;
  rating?: number;
  userRatingCount?: number;
  openNow?: boolean;
  openingHours: string[];
  phone?: string;
  website?: string;
  googleMapsUri: string;
  businessStatus?: string;
  priceLevel?: string;
  primaryType?: string;
  matchedDistanceKm: number;
  retrievedAt: string;
  provider: "google_places";
};
