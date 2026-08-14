export const GEAR_CATEGORIES = [
  "bike_repairs",
  "sleep_shelter",
  "navigation_power",
  "food_water",
  "clothing",
  "safety_medical",
  "documents",
  "other",
] as const;

export type GearCategory = (typeof GEAR_CATEGORIES)[number];
export type GearScope = "personal" | "shared";
export type GearPackingStatus = "needed" | "assigned" | "packed" | "missing";

export type AdventureGearItem = {
  id: string;
  adventureId: string;
  createdBy: string;
  name: string;
  category: GearCategory;
  scope: GearScope;
  packingStatus: GearPackingStatus;
  quantity: number;
  packedQuantity: number;
  assignedTo?: string;
  unitWeightGrams?: number;
  isCritical: boolean;
  templateKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdventureGearDraft = Omit<AdventureGearItem, "id" | "adventureId" | "createdBy" | "createdAt" | "updatedAt">;

export const gearCategoryLabels: Record<GearCategory, string> = {
  bike_repairs: "Bike and repairs",
  sleep_shelter: "Sleep and shelter",
  navigation_power: "Navigation and power",
  food_water: "Food and water",
  clothing: "Clothing",
  safety_medical: "Safety and medical",
  documents: "Documents and access",
  other: "Other",
};

export const gearStatusLabels: Record<GearPackingStatus, string> = {
  needed: "Needed",
  assigned: "Assigned",
  packed: "Packed",
  missing: "Missing",
};
