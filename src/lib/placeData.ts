import type { MapPlace } from "@/types/mapPlace";
import type { PoiCategory } from "@/types/poi";

export type OsmPlaceElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassPlaceResponse = {
  osm3s?: { timestamp_osm_base?: string };
  elements?: OsmPlaceElement[];
};

export function categoryFor(tags: Record<string, string>): PoiCategory | null {
  const amenity = tags.amenity;
  const shop = tags.shop;
  const tourism = tags.tourism;
  const natural = tags.natural;
  const leisure = tags.leisure;
  if (amenity === "fuel") return "fuel";
  if (["restaurant", "cafe", "fast_food", "marketplace", "bar", "pub"].includes(amenity) || ["bakery", "deli"].includes(shop)) return "food";
  if (["supermarket", "convenience", "general"].includes(shop)) return "groceries";
  if (["mall", "department_store", "outdoor", "sports", "clothes", "shoes", "hardware", "mobile_phone", "chemist"].includes(shop)) return "shopping";
  if (["drinking_water", "water_point"].includes(amenity)) return "water";
  if (amenity === "bicycle_repair" || shop === "bicycle") return "repair";
  if (amenity === "pharmacy") return "pharmacy";
  if (amenity === "toilets") return "toilets";
  if (["attraction", "viewpoint", "picnic_site", "museum", "information"].includes(tourism)
    || ["peak", "beach", "waterfall", "spring", "cave_entrance"].includes(natural)
    || ["park", "nature_reserve"].includes(leisure)
    || Boolean(tags.historic)) return "attraction";
  if (["hotel", "guest_house", "hostel", "camp_site", "motel", "chalet", "apartment", "caravan_site"].includes(tourism)) return "lodging";
  return null;
}

export function fallbackName(category: PoiCategory) {
  return {
    fuel: "Fuel station",
    food: "Food stop",
    groceries: "Grocery stop",
    shopping: "Shop",
    water: "Drinking water",
    repair: "Bicycle service",
    pharmacy: "Pharmacy",
    toilets: "Public toilets",
    attraction: "Point of interest",
    lodging: "Accommodation",
  }[category];
}

function cleanUrl(value?: string) {
  if (!value) return undefined;
  try {
    const candidate = value.startsWith("http") ? value : `https://${value}`;
    return new URL(candidate).toString();
  } catch {
    return undefined;
  }
}

function addressFor(tags: Record<string, string>) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const place = tags["addr:city"] ?? tags["addr:town"] ?? tags["addr:village"];
  return [street, place].filter(Boolean).join(", ") || undefined;
}

export function mapPlaceFromElement(element: OsmPlaceElement): MapPlace | null {
  const lat = element.lat ?? element.center?.lat;
  const lon = element.lon ?? element.center?.lon;
  const tags = element.tags ?? {};
  const category = categoryFor(tags);
  if (lat === undefined || lon === undefined || !category) return null;
  const mappedName = tags.name ?? tags.brand ?? tags.operator;
  const name = mappedName ?? fallbackName(category);
  const address = addressFor(tags);
  const stars = Number(tags.stars);
  return {
    id: `osm-${element.type}-${element.id}`,
    osmType: element.type,
    osmId: element.id,
    name,
    hasMappedName: Boolean(mappedName),
    category,
    subcategory: tags.amenity ?? tags.shop ?? tags.tourism ?? tags.natural ?? tags.leisure ?? tags.historic ?? category,
    lat,
    lon,
    address,
    openingHours: tags.opening_hours,
    phone: tags.phone ?? tags["contact:phone"],
    website: cleanUrl(tags.website ?? tags["contact:website"]),
    classificationStars: Number.isFinite(stars) && stars > 0 ? stars : undefined,
    bookingSearchUrl: category === "lodging"
      ? `https://www.booking.com/searchresults.html?ss=${encodeURIComponent([name, address].filter(Boolean).join(", "))}`
      : undefined,
    source: "openstreetmap",
  };
}

export function placeOverpassQuery(bbox: string) {
  return `[out:json][timeout:30];(
    nwr[amenity~"^(fuel|restaurant|cafe|fast_food|drinking_water|water_point|marketplace|bar|pub|toilets|pharmacy|bicycle_repair)$"](${bbox});
    nwr[shop~"^(supermarket|convenience|general|bakery|deli|bicycle|mall|department_store|outdoor|sports|clothes|shoes|hardware|mobile_phone|chemist)$"](${bbox});
    nwr[tourism~"^(attraction|viewpoint|picnic_site|museum|information|hotel|guest_house|hostel|camp_site|motel|chalet|apartment|caravan_site)$"](${bbox});
    nwr[natural~"^(peak|beach|waterfall|spring|cave_entrance)$"](${bbox});
    nwr[leisure~"^(park|nature_reserve)$"](${bbox});
    nwr[historic](${bbox});
  );out center tags;`;
}
