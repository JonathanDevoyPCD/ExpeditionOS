export const FUND_CATEGORIES = [
  "accommodation",
  "food",
  "groceries",
  "transport_fuel",
  "permits_activities",
  "repairs",
  "gear",
  "emergency_buffer",
  "other",
] as const;

export type FundCategory = (typeof FUND_CATEGORIES)[number];
export type FundCostStatus = "estimate" | "confirmed" | "paid";
export type FundSplitMethod = "equal" | "custom";

export type AdventureFundItem = {
  id: string;
  adventureId: string;
  createdBy: string;
  name: string;
  category: FundCategory;
  costStatus: FundCostStatus;
  estimatedAmount: number;
  actualAmount?: number;
  currency: string;
  payerId?: string;
  participantIds: string[];
  splitMethod: FundSplitMethod;
  splitWeights: Record<string, number>;
  stageDay?: number;
  occurredOn?: string;
  bookingReference?: string;
  templateKey?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type AdventureFundDraft = Omit<AdventureFundItem, "id" | "adventureId" | "createdBy" | "createdAt" | "updatedAt">;

export const fundCategoryLabels: Record<FundCategory, string> = {
  accommodation: "Accommodation",
  food: "Meals and cafés",
  groceries: "Groceries",
  transport_fuel: "Transport and fuel",
  permits_activities: "Permits and activities",
  repairs: "Repairs",
  gear: "Gear",
  emergency_buffer: "Emergency buffer",
  other: "Other",
};

export const fundStatusLabels: Record<FundCostStatus, string> = {
  estimate: "Estimated",
  confirmed: "Confirmed cost",
  paid: "Paid",
};
