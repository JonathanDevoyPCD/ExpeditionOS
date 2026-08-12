import "server-only";
import { haversineKm } from "@/lib/routeBuilder";
import type { GooglePlaceDetails, GooglePlaceLookupInput } from "@/types/googlePlace";
import type { MapPlace } from "@/types/mapPlace";
import type { PoiCategory } from "@/types/poi";

type GoogleText = { text?: string };
type GoogleOpeningHours = { openNow?: boolean; weekdayDescriptions?: string[] };
type GooglePlaceResult = {
  id?: string;
  displayName?: GoogleText;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: GoogleOpeningHours;
  currentOpeningHours?: GoogleOpeningHours;
  nationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  businessStatus?: string;
  priceLevel?: string;
  primaryTypeDisplayName?: GoogleText;
};

type GoogleSearchResponse = { places?: GooglePlaceResult[] };

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.regularOpeningHours",
  "places.currentOpeningHours",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.googleMapsUri",
  "places.businessStatus",
  "places.priceLevel",
  "places.primaryTypeDisplayName",
].join(",");

const DETAILS_FIELD_MASK = FIELD_MASK.split(",").map((field) => field.replace(/^places\./, "")).join(",");

export function googleApiKey() {
  return process.env.GOOGLE_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
}

function normalized(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
}

function namePenalty(expected: string, candidate: string) {
  const left = normalized(expected);
  const right = normalized(candidate);
  if (!left || !right) return 2;
  if (left === right) return 0;
  if (left.includes(right) || right.includes(left)) return 0.25;
  const expectedWords = new Set(left.split(" ").filter((word) => word.length > 2));
  const shared = right.split(" ").filter((word) => expectedWords.has(word)).length;
  return shared ? 0.8 / shared : 2;
}

export async function enrichGooglePlace(input: GooglePlaceLookupInput): Promise<GooglePlaceDetails | null> {
  const key = googleApiKey();
  if (!key) throw new Error("Google Places is not configured.");
  if (input.hasMappedName === false) return null;

  const response = await fetch(input.googlePlaceId
    ? `https://places.googleapis.com/v1/places/${encodeURIComponent(input.googlePlaceId)}`
    : "https://places.googleapis.com/v1/places:searchText", {
    method: input.googlePlaceId ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": input.googlePlaceId ? DETAILS_FIELD_MASK : FIELD_MASK,
    },
    body: input.googlePlaceId ? undefined : JSON.stringify({
      textQuery: [input.name, input.address].filter(Boolean).join(", "),
      pageSize: 3,
      locationBias: {
        circle: {
          center: { latitude: input.lat, longitude: input.lon },
          radius: 2500,
        },
      },
    }),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(details?.error?.message ?? `Google Places returned ${response.status}.`);
  }

  const data = await response.json() as GoogleSearchResponse | GooglePlaceResult;
  const resultPlaces = input.googlePlaceId ? [data as GooglePlaceResult] : (data as GoogleSearchResponse).places ?? [];
  const candidates = resultPlaces.flatMap((place) => {
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;
    const displayName = place.displayName?.text;
    if (!place.id || !displayName || !place.googleMapsUri || lat === undefined || lon === undefined) return [];
    const distanceKm = haversineKm(input, { lat, lon });
    return [{ place, displayName, distanceKm, score: distanceKm + namePenalty(input.name, displayName) }];
  }).filter((candidate) => candidate.distanceKm <= 2.5).sort((a, b) => a.score - b.score);

  const match = candidates[0];
  if (!match || match.score > 2.6) return null;
  const hours = match.place.currentOpeningHours ?? match.place.regularOpeningHours;
  return {
    id: match.place.id!,
    displayName: match.displayName,
    formattedAddress: match.place.formattedAddress,
    rating: match.place.rating,
    userRatingCount: match.place.userRatingCount,
    openNow: hours?.openNow,
    openingHours: hours?.weekdayDescriptions ?? [],
    phone: match.place.nationalPhoneNumber,
    website: match.place.websiteUri,
    googleMapsUri: match.place.googleMapsUri!,
    businessStatus: match.place.businessStatus,
    priceLevel: match.place.priceLevel,
    primaryType: match.place.primaryTypeDisplayName?.text,
    matchedDistanceKm: Number(match.distanceKm.toFixed(2)),
    retrievedAt: new Date().toISOString(),
    provider: "google_places",
  };
}

function categoryForGoogle(types: string[]): PoiCategory {
  if (types.some((type) => ["gas_station"].includes(type))) return "fuel";
  if (types.some((type) => ["restaurant", "cafe", "bakery", "bar", "fast_food_restaurant"].includes(type))) return "food";
  if (types.some((type) => ["grocery_store", "supermarket", "convenience_store"].includes(type))) return "groceries";
  if (types.some((type) => ["shopping_mall", "department_store", "clothing_store", "shoe_store", "hardware_store", "sporting_goods_store", "store"].includes(type))) return "shopping";
  if (types.some((type) => ["bicycle_store"].includes(type))) return "repair";
  if (types.some((type) => ["pharmacy", "drugstore"].includes(type))) return "pharmacy";
  if (types.some((type) => ["public_bathroom"].includes(type))) return "toilets";
  if (types.some((type) => ["hotel", "motel", "hostel", "bed_and_breakfast", "guest_house", "campground", "camping_cabin"].includes(type))) return "lodging";
  return "attraction";
}

export async function getGoogleNearbyPlaces(center: { lat: number; lon: number }, radiusM: number): Promise<MapPlace[]> {
  const key = googleApiKey();
  if (!key) return [];
  const response = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.primaryType,places.types",
    },
    body: JSON.stringify({
      maxResultCount: 20,
      rankPreference: "POPULARITY",
      locationRestriction: { circle: { center: { latitude: center.lat, longitude: center.lon }, radius: Math.max(500, Math.min(20_000, radiusM)) } },
    }),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google nearby places returned ${response.status}.`);
  const data = await response.json() as GoogleSearchResponse;
  return (data.places ?? []).flatMap((place) => {
    const lat = place.location?.latitude;
    const lon = place.location?.longitude;
    const name = place.displayName?.text;
    if (!place.id || !name || lat === undefined || lon === undefined) return [];
    const types = (place as GooglePlaceResult & { types?: string[] }).types ?? [place.primaryTypeDisplayName?.text ?? ""];
    const category = categoryForGoogle(types);
    return [{
      id: `google-${place.id}`,
      googlePlaceId: place.id,
      name,
      hasMappedName: true,
      category,
      subcategory: (place as GooglePlaceResult & { primaryType?: string }).primaryType ?? types[0] ?? category,
      lat,
      lon,
      address: place.formattedAddress,
      bookingSearchUrl: category === "lodging" ? `https://www.booking.com/searchresults.html?ss=${encodeURIComponent([name, place.formattedAddress].filter(Boolean).join(", "))}` : undefined,
      source: "google_places" as const,
    }];
  });
}
