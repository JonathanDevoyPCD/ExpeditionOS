import type { GearCatalogCategoryDraft, GearCatalogItemDraft, GearScope, GearWeightKind } from "@/types/gear";

export const GEAR_CATALOG_STARTER_VERSION = 1;

export const DEFAULT_GEAR_CATEGORIES: GearCatalogCategoryDraft[] = [
  { slug: "bike_bags", name: "Bike and bags", iconKey: "bike", sortOrder: 10, isActive: true },
  { slug: "repair_spares", name: "Repair and spares", iconKey: "wrench", sortOrder: 20, isActive: true },
  { slug: "shelter_sleep", name: "Shelter and sleep", iconKey: "tent", sortOrder: 30, isActive: true },
  { slug: "cooking_food", name: "Cooking and food", iconKey: "cooking", sortOrder: 40, isActive: true },
  { slug: "water", name: "Water", iconKey: "water", sortOrder: 50, isActive: true },
  { slug: "navigation_power", name: "Navigation and power", iconKey: "navigation", sortOrder: 60, isActive: true },
  { slug: "riding_clothing", name: "Riding clothing", iconKey: "shirt", sortOrder: 70, isActive: true },
  { slug: "camp_clothing", name: "Camp clothing", iconKey: "camp-clothing", sortOrder: 80, isActive: true },
  { slug: "hygiene", name: "Hygiene", iconKey: "hygiene", sortOrder: 90, isActive: true },
  { slug: "first_aid_safety", name: "First aid and safety", iconKey: "medical", sortOrder: 100, isActive: true },
  { slug: "documents_misc", name: "Documents and miscellaneous", iconKey: "documents", sortOrder: 110, isActive: true },
];

function item(
  sourceKey: string,
  categorySlug: string,
  name: string,
  estimatedUnitWeightGrams: number | undefined,
  imageKey: string,
  options: {
    critical?: boolean;
    optional?: boolean;
    scope?: GearScope;
    quantity?: number;
    weightKind?: GearWeightKind;
    search?: string;
    description?: string;
  } = {},
): Omit<GearCatalogItemDraft, "categoryId"> & { categorySlug: string } {
  return {
    sourceKey,
    categorySlug,
    name,
    description: options.description,
    imageKey,
    defaultScope: options.scope ?? "personal",
    defaultQuantity: options.quantity ?? 1,
    estimatedUnitWeightGrams,
    weightKind: options.weightKind ?? "fixed",
    isCritical: options.critical ?? false,
    isOptional: options.optional ?? false,
    takealotSearchTerm: options.search,
    isActive: true,
    sortOrder: 0,
  };
}

export const DEFAULT_GEAR_CATALOG = [
  item("bike", "bike_bags", "Expedition bicycle", undefined, "bike", { critical: true }),
  item("helmet", "bike_bags", "Cycling helmet", 300, "helmet", { critical: true, search: "cycling helmet" }),
  item("frame-bag", "bike_bags", "Frame bag", 350, "bag", { search: "bikepacking frame bag" }),
  item("handlebar-bag", "bike_bags", "Handlebar roll or bag", 550, "bag", { search: "bikepacking handlebar bag" }),
  item("seat-bag", "bike_bags", "Seat pack", 500, "bag", { search: "bikepacking saddle bag" }),
  item("dry-bags", "bike_bags", "Waterproof dry bags", 180, "bag", { optional: true, search: "waterproof dry bag" }),
  item("front-light", "bike_bags", "Front light", 130, "light", { critical: true, search: "rechargeable bicycle front light" }),
  item("rear-light", "bike_bags", "Rear light", 70, "light", { critical: true, search: "rechargeable bicycle rear light" }),
  item("bike-lock", "bike_bags", "Compact bike lock", 650, "lock", { optional: true, scope: "shared", search: "compact bicycle lock" }),

  item("spare-tube", "repair_spares", "Spare inner tube", 210, "tube", { critical: true, quantity: 2, search: "bicycle inner tube" }),
  item("patch-kit", "repair_spares", "Tube patch kit", 45, "patch", { critical: true, scope: "shared", search: "bicycle puncture repair kit" }),
  item("tyre-plugs", "repair_spares", "Tubeless tyre plug kit", 55, "patch", { optional: true, scope: "shared", search: "tubeless bicycle tyre repair kit" }),
  item("bike-pump", "repair_spares", "Mini pump", 160, "pump", { critical: true, scope: "shared", search: "bicycle mini pump presta schrader" }),
  item("co2-inflator", "repair_spares", "CO2 inflator and cartridges", 180, "pump", { optional: true, scope: "shared", search: "bicycle CO2 inflator" }),
  item("tyre-levers", "repair_spares", "Tyre levers", 55, "wrench", { critical: true, scope: "shared", search: "bicycle tyre levers" }),
  item("bike-multitool", "repair_spares", "Bike multi-tool", 220, "wrench", { critical: true, scope: "shared", search: "bicycle multi tool chain breaker" }),
  item("quick-links", "repair_spares", "Spare chain quick links", 20, "chain", { critical: true, scope: "shared", search: "bicycle chain quick link" }),
  item("chain-tool", "repair_spares", "Chain tool", 110, "chain", { scope: "shared", search: "bicycle chain tool" }),
  item("chain-lube", "repair_spares", "Small chain lubricant", 85, "chain", { scope: "shared", search: "bicycle chain lube" }),
  item("spare-spokes", "repair_spares", "Spare spokes", 35, "wrench", { optional: true, scope: "shared" }),
  item("spare-cable", "repair_spares", "Spare shift or brake cable", 45, "wrench", { optional: true, scope: "shared" }),
  item("duct-tape", "repair_spares", "Duct tape wrap", 80, "patch", { scope: "shared", search: "duct tape" }),
  item("cable-ties", "repair_spares", "Cable ties", 35, "patch", { scope: "shared", search: "cable ties" }),

  item("tent", "shelter_sleep", "Tent", 2200, "tent", { critical: true, scope: "shared", search: "lightweight hiking tent" }),
  item("tarp-bivy", "shelter_sleep", "Tarp, bivy or hammock", 900, "tent", { optional: true, scope: "shared", search: "lightweight camping tarp bivy" }),
  item("stakes-guylines", "shelter_sleep", "Tent stakes and guylines", 260, "tent", { scope: "shared", search: "lightweight tent stakes" }),
  item("groundsheet", "shelter_sleep", "Groundsheet", 220, "tent", { optional: true, scope: "shared", search: "camping groundsheet" }),
  item("sleeping-bag", "shelter_sleep", "Sleeping bag", 950, "sleep", { critical: true, search: "lightweight sleeping bag" }),
  item("sleeping-pad", "shelter_sleep", "Sleeping pad", 520, "sleep", { critical: true, search: "lightweight camping sleeping mat" }),
  item("camp-pillow", "shelter_sleep", "Inflatable camp pillow", 90, "sleep", { optional: true, search: "inflatable camping pillow" }),

  item("camp-stove", "cooking_food", "Camp stove", 110, "cooking", { scope: "shared", search: "compact camping stove" }),
  item("stove-fuel", "cooking_food", "Stove fuel", 230, "fuel", { scope: "shared", weightKind: "consumable", search: "camping gas canister" }),
  item("lighter", "cooking_food", "Lighter or waterproof matches", 30, "fire", { critical: true, scope: "shared", search: "waterproof matches camping" }),
  item("cook-pot", "cooking_food", "Cooking pot", 280, "cooking", { scope: "shared", search: "lightweight camping cooking pot" }),
  item("camp-mug", "cooking_food", "Camp mug", 110, "mug", { search: "lightweight camping mug" }),
  item("spork", "cooking_food", "Spork or cutlery", 25, "utensils", { search: "camping spork" }),
  item("trip-meals", "cooking_food", "Trip meals", 650, "food", { critical: true, weightKind: "consumable" }),
  item("ride-snacks", "cooking_food", "Ride snacks", 450, "food", { critical: true, weightKind: "consumable" }),

  item("water-bottles", "water", "Water bottles", 90, "water", { critical: true, quantity: 2, search: "cycling water bottle" }),
  item("hydration-reservoir", "water", "Hydration reservoir", 190, "water", { optional: true, search: "hydration bladder 2 litre" }),
  item("water-load", "water", "Carried water", 1000, "water", { critical: true, quantity: 2, weightKind: "consumable" }),
  item("water-filter", "water", "Water filter", 120, "filter", { critical: true, scope: "shared", search: "portable water filter hiking" }),
  item("purification-tablets", "water", "Water purification tablets", 30, "filter", { scope: "shared", search: "water purification tablets" }),

  item("paper-map", "navigation_power", "Paper map", 80, "map", { optional: true, scope: "shared" }),
  item("compass", "navigation_power", "Compass", 55, "navigation", { scope: "shared", search: "hiking compass" }),
  item("route-notes", "navigation_power", "Offline route notes", undefined, "documents", { critical: true, scope: "shared" }),
  item("mobile-phone", "navigation_power", "Mobile phone with offline maps", 220, "phone", { critical: true }),
  item("gps-device", "navigation_power", "GPS cycling computer", 120, "navigation", { optional: true, search: "GPS cycling computer navigation" }),
  item("power-bank", "navigation_power", "Power bank", 360, "battery", { critical: true, scope: "shared", search: "20000mAh power bank" }),
  item("charging-cables", "navigation_power", "Charging cables and adaptors", 160, "battery", { critical: true, scope: "shared", search: "USB charging cable travel adaptor" }),
  item("solar-charger", "navigation_power", "Portable solar charger", 520, "battery", { optional: true, scope: "shared", search: "portable solar charger camping" }),
  item("locator-beacon", "navigation_power", "Satellite locator or beacon", 150, "navigation", { optional: true, scope: "shared", search: "satellite emergency locator beacon" }),
  item("headlamp", "navigation_power", "Headlamp", 95, "light", { critical: true, search: "rechargeable headlamp" }),
  item("spare-batteries", "navigation_power", "Spare batteries", 90, "battery", { optional: true, scope: "shared", search: "AA AAA batteries" }),

  item("cycling-top", "riding_clothing", "Cycling jersey or riding top", 180, "shirt", { critical: true }),
  item("padded-shorts", "riding_clothing", "Padded cycling shorts", 210, "shorts", { critical: true, search: "padded cycling shorts" }),
  item("sports-bra", "riding_clothing", "Sports bra", 110, "shirt", { optional: true }),
  item("riding-socks", "riding_clothing", "Riding socks", 55, "sock", { critical: true, quantity: 2 }),
  item("cycling-shoes", "riding_clothing", "Cycling shoes", 760, "shoe", { critical: true }),
  item("rain-jacket", "riding_clothing", "Waterproof rain jacket", 340, "jacket", { critical: true, search: "waterproof cycling jacket" }),
  item("cycling-gloves", "riding_clothing", "Cycling gloves", 65, "glove", { search: "cycling gloves" }),
  item("wind-jacket", "riding_clothing", "Wind jacket or vest", 160, "jacket", { optional: true, search: "cycling wind vest" }),
  item("arm-leg-warmers", "riding_clothing", "Arm or leg warmers", 180, "clothing", { optional: true, search: "cycling arm leg warmers" }),
  item("neck-gaiter", "riding_clothing", "Neck gaiter", 45, "clothing", { optional: true, search: "neck gaiter" }),

  item("camp-underwear", "camp_clothing", "Camp underwear", 80, "clothing", { quantity: 2 }),
  item("thermal-base-layer", "camp_clothing", "Thermal base layer", 320, "clothing", { optional: true, search: "thermal base layer" }),
  item("warm-hat", "camp_clothing", "Warm hat", 80, "hat", { optional: true, search: "warm beanie" }),
  item("sleep-socks", "camp_clothing", "Warm sleep socks", 75, "sock", { optional: true }),
  item("insulated-jacket", "camp_clothing", "Insulated jacket", 480, "jacket", { optional: true, search: "lightweight puffer jacket" }),
  item("sun-cap", "camp_clothing", "Sun cap", 75, "hat", { optional: true, search: "sun cap" }),
  item("camp-sandals", "camp_clothing", "Camp sandals", 380, "shoe", { optional: true, search: "lightweight sandals" }),

  item("sunscreen", "hygiene", "Sunscreen", 120, "hygiene", { critical: true, weightKind: "consumable", search: "SPF 50 sunscreen" }),
  item("lip-balm", "hygiene", "SPF lip balm", 20, "hygiene", { search: "SPF lip balm" }),
  item("hand-sanitiser", "hygiene", "Hand sanitiser", 80, "hygiene", { weightKind: "consumable", search: "travel hand sanitiser" }),
  item("toothbrush-paste", "hygiene", "Toothbrush and toothpaste", 90, "hygiene", { critical: true, search: "travel toothbrush toothpaste" }),
  item("biodegradable-soap", "hygiene", "Biodegradable soap", 90, "hygiene", { optional: true, weightKind: "consumable", search: "biodegradable camping soap" }),
  item("toilet-paper", "hygiene", "Toilet paper", 100, "hygiene", { weightKind: "consumable" }),
  item("wet-wipes", "hygiene", "Wet wipes", 160, "hygiene", { weightKind: "consumable", search: "biodegradable wet wipes" }),
  item("trowel", "hygiene", "Waste trowel", 85, "hygiene", { optional: true, scope: "shared", search: "camping trowel" }),
  item("chamois-cream", "hygiene", "Chamois cream", 120, "hygiene", { optional: true, weightKind: "consumable", search: "cycling chamois cream" }),
  item("personal-medication", "hygiene", "Personal prescriptions", undefined, "medical", { critical: true }),

  item("first-aid-kit", "first_aid_safety", "First-aid kit", 420, "medical", { critical: true, scope: "shared", search: "compact first aid kit" }),
  item("blister-care", "first_aid_safety", "Blister care", 45, "medical", { critical: true, scope: "shared", search: "blister plasters" }),
  item("bandages-gauze", "first_aid_safety", "Bandages and gauze", 100, "medical", { scope: "shared", search: "first aid bandages gauze" }),
  item("antiseptic", "first_aid_safety", "Antiseptic or antibiotic ointment", 55, "medical", { scope: "shared", weightKind: "consumable" }),
  item("pain-relief", "first_aid_safety", "Personal pain relief", 30, "medical", { optional: true }),
  item("emergency-blanket", "first_aid_safety", "Emergency blanket", 60, "medical", { critical: true, scope: "shared", search: "emergency thermal blanket" }),
  item("sunglasses", "first_aid_safety", "Cycling sunglasses", 40, "glasses", { critical: true, search: "cycling sunglasses" }),
  item("reflective-vest", "first_aid_safety", "Reflective vest", 140, "safety", { optional: true, search: "reflective cycling vest" }),

  item("identity-document", "documents_misc", "ID or passport", undefined, "documents", { critical: true }),
  item("bank-card-cash", "documents_misc", "Bank card and emergency cash", undefined, "wallet", { critical: true }),
  item("permits", "documents_misc", "Permits and access documents", undefined, "documents", { optional: true, scope: "shared" }),
  item("medical-emergency-card", "documents_misc", "Medical and emergency information card", 10, "documents", { critical: true }),
  item("itinerary-copy", "documents_misc", "Trip itinerary copy", 20, "documents", { optional: true, scope: "shared" }),
  item("notebook-pen", "documents_misc", "Notebook and pen", 150, "documents", { optional: true, scope: "shared", search: "pocket notebook pen" }),
  item("camera", "documents_misc", "Camera", 450, "camera", { optional: true }),
] satisfies Array<Omit<GearCatalogItemDraft, "categoryId"> & { categorySlug: string }>;
