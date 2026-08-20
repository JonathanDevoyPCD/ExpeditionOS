import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { AdventureGearDraft, AdventureGearItem } from "@/types/gear";

type GearRow = Database["public"]["Tables"]["adventure_gear_items"]["Row"];

function optionalNumber(value: number | null) {
  return value === null ? undefined : value;
}

function optionalText(value: string | null) {
  return value ?? undefined;
}

function mapGearItem(row: GearRow): AdventureGearItem {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    createdBy: row.created_by,
    catalogItemId: optionalText(row.catalog_item_id),
    name: row.name,
    category: row.category as AdventureGearItem["category"],
    scope: row.item_scope as AdventureGearItem["scope"],
    packingStatus: row.packing_status as AdventureGearItem["packingStatus"],
    acquisitionStatus: row.acquisition_status as AdventureGearItem["acquisitionStatus"],
    quantity: row.quantity,
    packedQuantity: row.packed_quantity,
    assignedTo: optionalText(row.assigned_to),
    unitWeightGrams: optionalNumber(row.unit_weight_grams),
    weightIsEstimate: row.weight_is_estimate,
    weightKind: row.weight_kind as AdventureGearItem["weightKind"],
    imageKey: optionalText(row.image_key),
    takealotSearchTerm: optionalText(row.takealot_search_term),
    isCritical: row.is_critical,
    templateKey: optionalText(row.template_key),
    notes: optionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function gearValues(draft: AdventureGearDraft) {
  return {
    catalog_item_id: draft.catalogItemId ?? null,
    name: draft.name.trim(),
    category: draft.category,
    item_scope: draft.scope,
    packing_status: draft.packingStatus,
    acquisition_status: draft.acquisitionStatus,
    quantity: draft.quantity,
    packed_quantity: draft.packedQuantity,
    assigned_to: draft.assignedTo ?? null,
    unit_weight_grams: draft.unitWeightGrams ?? null,
    weight_is_estimate: draft.weightIsEstimate,
    weight_kind: draft.weightKind,
    image_key: draft.imageKey?.trim() || null,
    takealot_search_term: draft.takealotSearchTerm?.trim() || null,
    is_critical: draft.isCritical,
    template_key: draft.templateKey?.trim() || null,
    notes: draft.notes?.trim() || null,
  };
}

export async function loadAdventureGear(adventureId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_gear_items")
    .select("*")
    .eq("adventure_id", adventureId)
    .order("category")
    .order("is_critical", { ascending: false })
    .order("name");
  if (error) throw error;
  return data.map(mapGearItem);
}

export async function createAdventureGearItem(adventureId: string, userId: string, draft: AdventureGearDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_gear_items")
    .insert({ adventure_id: adventureId, created_by: userId, ...gearValues(draft) })
    .select("*")
    .single();
  if (error) throw error;
  return mapGearItem(data);
}

export async function createAdventureGearItems(adventureId: string, userId: string, drafts: AdventureGearDraft[]) {
  if (!drafts.length) return [];
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_gear_items")
    .insert(drafts.map((draft) => ({ adventure_id: adventureId, created_by: userId, ...gearValues(draft) })))
    .select("*");
  if (error) throw error;
  return data.map(mapGearItem);
}

export async function updateAdventureGearItem(itemId: string, adventureId: string, draft: AdventureGearDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_gear_items")
    .update(gearValues(draft))
    .eq("id", itemId)
    .eq("adventure_id", adventureId)
    .select("*")
    .single();
  if (error) throw error;
  return mapGearItem(data);
}

export async function deleteAdventureGearItem(itemId: string, adventureId: string) {
  const { error } = await getSupabaseBrowserClient()
    .from("adventure_gear_items")
    .delete()
    .eq("id", itemId)
    .eq("adventure_id", adventureId);
  if (error) throw error;
}
