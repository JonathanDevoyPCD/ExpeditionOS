import type { TripMember } from "@/lib/cloudAdventures";
import type { AdventureFundItem } from "@/types/funds";

export type MemberFundBalance = {
  userId: string;
  name: string;
  amount: number;
};

export function fundAmount(item: AdventureFundItem): number;
export function fundAllocations(item: AdventureFundItem): Map<string, number>;
export function memberFundBalances(items: AdventureFundItem[], members: TripMember[]): MemberFundBalance[];
