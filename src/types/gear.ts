export const GEAR_CATEGORIES = [
  "bike_bags",
  "repair_spares",
  "shelter_sleep",
  "cooking_food",
  "water",
  "navigation_power",
  "riding_clothing",
  "camp_clothing",
  "hygiene",
  "first_aid_safety",
  "documents_misc",
] as const;

export type GearCategory = string;
export type GearScope = "personal" | "shared";
export type GearPackingStatus = "needed" | "assigned" | "packed" | "missing";
export type GearAcquisitionStatus = "owned" | "need" | "borrow" | "buy";
export type GearWeightKind = "fixed" | "consumable";

export type AdventureGearItem = {
  id: string;
  adventureId: string;
  createdBy: string;
  catalogItemId?: string;
  name: string;
  category: GearCategory;
  scope: GearScope;
  packingStatus: GearPackingStatus;
  acquisitionStatus: GearAcquisitionStatus;
  quantity: number;
  packedQuantity: number;
  assignedTo?: string;
  unitWeightGrams?: number;
  weightIsEstimate: boolean;
  weightKind: GearWeightKind;
  imageKey?: string;
  takealotSearchTerm?: string;
  isCritical: boolean;
  templateKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdventureGearDraft = Omit<AdventureGearItem, "id" | "adventureId" | "createdBy" | "createdAt" | "updatedAt">;

export type GearCatalogCategory = {
  id: string;
  ownerId: string;
  slug: string;
  name: string;
  iconKey: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GearCatalogCategoryDraft = Pick<GearCatalogCategory, "slug" | "name" | "iconKey" | "sortOrder" | "isActive">;

export type GearCatalogItem = {
  id: string;
  ownerId: string;
  categoryId: string;
  sourceKey: string;
  name: string;
  description?: string;
  imageKey: string;
  defaultScope: GearScope;
  defaultQuantity: number;
  estimatedUnitWeightGrams?: number;
  weightKind: GearWeightKind;
  isCritical: boolean;
  isOptional: boolean;
  takealotSearchTerm?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type GearCatalogItemDraft = Omit<GearCatalogItem, "id" | "ownerId" | "createdAt" | "updatedAt">;

export const gearCategoryLabels: Record<string, string> = {
  bike_bags: "Bike and bags",
  repair_spares: "Repair and spares",
  shelter_sleep: "Shelter and sleep",
  cooking_food: "Cooking and food",
  water: "Water",
  navigation_power: "Navigation and power",
  riding_clothing: "Riding clothing",
  camp_clothing: "Camp clothing",
  hygiene: "Hygiene",
  first_aid_safety: "First aid and safety",
  documents_misc: "Documents and miscellaneous",
  bike_repairs: "Bike and repairs",
  sleep_shelter: "Sleep and shelter",
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

export const gearAcquisitionLabels: Record<GearAcquisitionStatus, string> = {
  owned: "Owned",
  need: "Need",
  borrow: "Borrow",
  buy: "Buy",
};
