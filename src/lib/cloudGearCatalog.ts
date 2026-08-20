import { DEFAULT_GEAR_CATALOG, DEFAULT_GEAR_CATEGORIES, GEAR_CATALOG_STARTER_VERSION } from "@/lib/gearCatalogDefaults";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type {
  GearCatalogCategory,
  GearCatalogCategoryDraft,
  GearCatalogItem,
  GearCatalogItemDraft,
} from "@/types/gear";

type CategoryRow = Database["public"]["Tables"]["gear_catalog_categories"]["Row"];
type ItemRow = Database["public"]["Tables"]["gear_catalog_items"]["Row"];

function optionalNumber(value: number | null) {
  return value === null ? undefined : value;
}

function optionalText(value: string | null) {
  return value ?? undefined;
}

function mapCategory(row: CategoryRow): GearCatalogCategory {
  return {
    id: row.id,
    ownerId: row.owner_id,
    slug: row.slug,
    name: row.name,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapItem(row: ItemRow): GearCatalogItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    categoryId: row.category_id,
    sourceKey: row.source_key,
    name: row.name,
    description: optionalText(row.description),
    imageKey: row.image_key,
    defaultScope: row.default_scope as GearCatalogItem["defaultScope"],
    defaultQuantity: row.default_quantity,
    estimatedUnitWeightGrams: optionalNumber(row.estimated_unit_weight_grams),
    weightKind: row.weight_kind as GearCatalogItem["weightKind"],
    isCritical: row.is_critical,
    isOptional: row.is_optional,
    takealotSearchTerm: optionalText(row.takealot_search_term),
    isActive: row.is_active,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function categoryValues(ownerId: string, draft: GearCatalogCategoryDraft) {
  return {
    owner_id: ownerId,
    slug: draft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
    name: draft.name.trim(),
    icon_key: draft.iconKey.trim() || "package",
    sort_order: draft.sortOrder,
    is_active: draft.isActive,
  };
}

function itemValues(ownerId: string, draft: GearCatalogItemDraft) {
  return {
    owner_id: ownerId,
    category_id: draft.categoryId,
    source_key: draft.sourceKey.trim(),
    name: draft.name.trim(),
    description: draft.description?.trim() || null,
    image_key: draft.imageKey.trim() || "package",
    default_scope: draft.defaultScope,
    default_quantity: draft.defaultQuantity,
    estimated_unit_weight_grams: draft.estimatedUnitWeightGrams ?? null,
    weight_kind: draft.weightKind,
    is_critical: draft.isCritical,
    is_optional: draft.isOptional,
    takealot_search_term: draft.takealotSearchTerm?.trim() || null,
    is_active: draft.isActive,
    sort_order: draft.sortOrder,
  };
}

export async function loadGearCatalog(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const [categoryResult, itemResult] = await Promise.all([
    supabase.from("gear_catalog_categories").select("*").eq("owner_id", userId).order("sort_order").order("name"),
    supabase.from("gear_catalog_items").select("*").eq("owner_id", userId).order("sort_order").order("name"),
  ]);
  if (categoryResult.error) throw categoryResult.error;
  if (itemResult.error) throw itemResult.error;
  return {
    categories: categoryResult.data.map(mapCategory),
    items: itemResult.data.map(mapItem),
  };
}

export async function ensureGearCatalog(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const { data: profile, error: profileError } = await supabase
    .from("gear_catalog_profiles")
    .select("starter_version")
    .eq("user_id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if ((profile?.starter_version ?? 0) >= GEAR_CATALOG_STARTER_VERSION) return loadGearCatalog(userId);

  const { error: categoryError } = await supabase
    .from("gear_catalog_categories")
    .upsert(DEFAULT_GEAR_CATEGORIES.map((draft) => categoryValues(userId, draft)), {
      onConflict: "owner_id,slug",
      ignoreDuplicates: true,
    });
  if (categoryError) throw categoryError;

  const { data: categories, error: loadCategoryError } = await supabase
    .from("gear_catalog_categories")
    .select("*")
    .eq("owner_id", userId);
  if (loadCategoryError) throw loadCategoryError;
  const categoryIds = new Map(categories.map((row) => [row.slug, row.id]));
  const starterRows = DEFAULT_GEAR_CATALOG.flatMap((draft) => {
    const categoryId = categoryIds.get(draft.categorySlug);
    if (!categoryId) return [];
    const { categorySlug: _categorySlug, ...itemDraft } = draft;
    void _categorySlug;
    return [itemValues(userId, { ...itemDraft, categoryId })];
  });

  const { error: itemError } = await supabase
    .from("gear_catalog_items")
    .upsert(starterRows, { onConflict: "owner_id,source_key", ignoreDuplicates: true });
  if (itemError) throw itemError;

  const { error: versionError } = await supabase
    .from("gear_catalog_profiles")
    .upsert({ user_id: userId, starter_version: GEAR_CATALOG_STARTER_VERSION }, { onConflict: "user_id" });
  if (versionError) throw versionError;
  return loadGearCatalog(userId);
}

export async function createGearCatalogCategory(userId: string, draft: GearCatalogCategoryDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("gear_catalog_categories")
    .insert(categoryValues(userId, draft))
    .select("*")
    .single();
  if (error) throw error;
  return mapCategory(data);
}

export async function updateGearCatalogCategory(userId: string, categoryId: string, draft: GearCatalogCategoryDraft) {
  const values = categoryValues(userId, draft);
  const { owner_id: _ownerId, ...updates } = values;
  void _ownerId;
  const { data, error } = await getSupabaseBrowserClient()
    .from("gear_catalog_categories")
    .update(updates)
    .eq("id", categoryId)
    .eq("owner_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapCategory(data);
}

export async function createGearCatalogItem(userId: string, draft: GearCatalogItemDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("gear_catalog_items")
    .insert(itemValues(userId, draft))
    .select("*")
    .single();
  if (error) throw error;
  return mapItem(data);
}

export async function updateGearCatalogItem(userId: string, itemId: string, draft: GearCatalogItemDraft) {
  const values = itemValues(userId, draft);
  const { owner_id: _ownerId, ...updates } = values;
  void _ownerId;
  const { data, error } = await getSupabaseBrowserClient()
    .from("gear_catalog_items")
    .update(updates)
    .eq("id", itemId)
    .eq("owner_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return mapItem(data);
}
