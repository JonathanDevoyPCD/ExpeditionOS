import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";
import type { AdventureFundDraft, AdventureFundItem } from "@/types/funds";

type FundRow = Database["public"]["Tables"]["adventure_fund_items"]["Row"];

function optionalText(value: string | null) {
  return value ?? undefined;
}

function optionalNumber(value: number | null) {
  return value === null ? undefined : Number(value);
}

function splitWeights(value: Json): Record<string, number> {
  if (!value || Array.isArray(value) || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).flatMap(([key, weight]) => typeof weight === "number" ? [[key, weight]] : []));
}

function mapFundItem(row: FundRow): AdventureFundItem {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    createdBy: row.created_by,
    name: row.name,
    category: row.category as AdventureFundItem["category"],
    costStatus: row.cost_status as AdventureFundItem["costStatus"],
    estimatedAmount: Number(row.estimated_amount),
    actualAmount: optionalNumber(row.actual_amount),
    currency: row.currency,
    payerId: optionalText(row.payer_id),
    participantIds: row.participant_ids,
    splitMethod: row.split_method as AdventureFundItem["splitMethod"],
    splitWeights: splitWeights(row.split_weights),
    stageDay: optionalNumber(row.stage_day),
    occurredOn: optionalText(row.occurred_on),
    bookingReference: optionalText(row.booking_reference),
    templateKey: optionalText(row.template_key),
    notes: optionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fundValues(draft: AdventureFundDraft) {
  return {
    name: draft.name.trim(),
    category: draft.category,
    cost_status: draft.costStatus,
    estimated_amount: draft.estimatedAmount,
    actual_amount: draft.actualAmount ?? null,
    currency: draft.currency.toUpperCase(),
    payer_id: draft.payerId ?? null,
    participant_ids: draft.participantIds,
    split_method: draft.splitMethod,
    split_weights: draft.splitWeights,
    stage_day: draft.stageDay ?? null,
    occurred_on: draft.occurredOn ?? null,
    booking_reference: draft.bookingReference?.trim() || null,
    template_key: draft.templateKey?.trim() || null,
    notes: draft.notes?.trim() || null,
  };
}

export async function loadAdventureFunds(adventureId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_fund_items")
    .select("*")
    .eq("adventure_id", adventureId)
    .order("category")
    .order("created_at");
  if (error) throw error;
  return data.map(mapFundItem);
}

export async function createAdventureFundItem(adventureId: string, userId: string, draft: AdventureFundDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_fund_items")
    .insert({ adventure_id: adventureId, created_by: userId, ...fundValues(draft) })
    .select("*")
    .single();
  if (error) throw error;
  return mapFundItem(data);
}

export async function createAdventureFundItems(adventureId: string, userId: string, drafts: AdventureFundDraft[]) {
  if (!drafts.length) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_fund_items")
    .insert(drafts.map((draft) => ({ adventure_id: adventureId, created_by: userId, ...fundValues(draft) })))
    .select("*");
  if (error) throw error;
  return data.map(mapFundItem);
}

export async function updateAdventureFundItem(itemId: string, adventureId: string, draft: AdventureFundDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_fund_items")
    .update(fundValues(draft))
    .eq("id", itemId)
    .eq("adventure_id", adventureId)
    .select("*")
    .single();
  if (error) throw error;
  return mapFundItem(data);
}

export async function deleteAdventureFundItem(itemId: string, adventureId: string) {
  const { error } = await getSupabaseBrowserClient()
    .from("adventure_fund_items")
    .delete()
    .eq("id", itemId)
    .eq("adventure_id", adventureId);
  if (error) throw error;
}
