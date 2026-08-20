"use client";

import { Check, CirclePlus, LoaderCircle, Pencil, Search, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { GearVisual } from "@/components/logistics/GearVisual";
import type { GearCatalogCategory, GearCatalogCategoryDraft, GearCatalogItem, GearCatalogItemDraft } from "@/types/gear";

const imageOptions = [
  "bike", "bag", "helmet", "light", "lock", "wrench", "tube", "patch", "chain", "tent", "sleep", "cooking", "fuel", "food", "mug", "utensils", "water", "filter", "navigation", "map", "phone", "battery", "shirt", "clothing", "jacket", "shoe", "hat", "hygiene", "medical", "safety", "documents", "wallet", "camera", "package",
];

export default function GearSettingsPanel({ categories, items, saving, onCreateCategory, onUpdateCategory, onSaveItem }: {
  categories: GearCatalogCategory[];
  items: GearCatalogItem[];
  saving: boolean;
  onCreateCategory: (draft: GearCatalogCategoryDraft) => Promise<void>;
  onUpdateCategory: (category: GearCatalogCategory, draft: GearCatalogCategoryDraft) => Promise<void>;
  onSaveItem: (item: GearCatalogItem | undefined, draft: GearCatalogItemDraft) => Promise<boolean>;
}) {
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [search, setSearch] = useState("");
  const editingItem = editingId && editingId !== "new" ? items.find((item) => item.id === editingId) : undefined;
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filteredItems = items.filter((item) => `${item.name} ${categoryById.get(item.categoryId)?.name ?? ""}`.toLowerCase().includes(search.trim().toLowerCase()));

  async function addCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) return;
    await onCreateCategory({ slug: name, name, iconKey: String(form.get("iconKey") ?? "package"), sortOrder: categories.length * 10 + 10, isActive: true });
    event.currentTarget.reset();
    setShowNewCategory(false);
  }

  async function saveCategory(event: React.FormEvent<HTMLFormElement>, category: GearCatalogCategory) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await onUpdateCategory(category, {
      slug: category.slug,
      name: String(form.get("name") ?? category.name),
      iconKey: String(form.get("iconKey") ?? category.iconKey),
      sortOrder: category.sortOrder,
      isActive: form.get("isActive") === "on",
    });
  }

  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const rawWeight = String(form.get("weight") ?? "").trim();
    const name = String(form.get("name") ?? "").trim();
    const categoryId = String(form.get("categoryId") ?? "");
    if (!name || !categoryId) return;
    const sourceKey = editingItem?.sourceKey ?? `custom-${crypto.randomUUID()}`;
    const saved = await onSaveItem(editingItem, {
      sourceKey,
      categoryId,
      name,
      description: String(form.get("description") ?? ""),
      imageKey: String(form.get("imageKey") ?? "package"),
      defaultScope: String(form.get("scope") ?? "personal") as GearCatalogItemDraft["defaultScope"],
      defaultQuantity: Math.max(1, Math.min(100, Number(form.get("quantity") ?? 1))),
      estimatedUnitWeightGrams: rawWeight === "" ? undefined : Math.max(0, Number(rawWeight)),
      weightKind: String(form.get("weightKind") ?? "fixed") as GearCatalogItemDraft["weightKind"],
      isCritical: form.get("isCritical") === "on",
      isOptional: form.get("isOptional") === "on",
      takealotSearchTerm: String(form.get("takealotSearchTerm") ?? ""),
      isActive: form.get("isActive") === "on",
      sortOrder: editingItem?.sortOrder ?? items.length * 10 + 10,
    });
    if (saved) setEditingId(null);
  }

  return (
    <div className="grid gap-4 2xl:grid-cols-[0.78fr_1.22fr]">
      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><Settings2 className="size-4" /></span><div className="mr-auto"><h3 className="text-sm font-semibold text-white">Categories</h3><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/40">Rename, hide or extend your private catalogue.</p></div><button onClick={() => setShowNewCategory((value) => !value)} className="grid size-9 place-items-center rounded-xl border border-[#86b9b0]/20 text-[#86b9b0]" aria-label="Add category"><CirclePlus className="size-4" /></button></div>

        {showNewCategory && <form onSubmit={addCategory} className="mt-4 grid gap-2 rounded-2xl border border-[#86b9b0]/14 bg-[#041421]/35 p-3 sm:grid-cols-[1fr_0.7fr_auto]"><input name="name" required maxLength={100} className="gear-input" placeholder="New category name" /><select name="iconKey" className="gear-input">{imageOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select><button disabled={saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]"><Check className="size-4" /> Add</button></form>}

        <div className="mt-4 space-y-2">{categories.map((category) => <form key={`${category.id}-${category.updatedAt}`} onSubmit={(event) => void saveCategory(event, category)} className="grid gap-2 rounded-2xl border border-white/[0.06] bg-[#041421]/28 p-3 sm:grid-cols-[1fr_0.7fr_auto_auto]"><input name="name" defaultValue={category.name} maxLength={100} required className="gear-input" /><select name="iconKey" defaultValue={category.iconKey} className="gear-input">{imageOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select><label className="flex h-10 items-center justify-between gap-3 rounded-xl border border-white/[0.07] px-3 text-[9px] font-semibold text-[#d0d6d6]/50">Visible<input name="isActive" type="checkbox" defaultChecked={category.isActive} className="size-4 accent-[#86b9b0]" /></label><button disabled={saving} className="grid size-10 place-items-center rounded-xl border border-[#86b9b0]/18 text-[#86b9b0]" aria-label={`Save ${category.name}`}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}</button></form>)}</div>
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="mr-auto"><h3 className="text-sm font-semibold text-white">Catalogue items</h3><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/40">Edit defaults here; trip copies remain unchanged.</p></div><button onClick={() => setEditingId("new")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]"><CirclePlus className="size-4" /> Custom item</button></div>

        <label className="relative mt-4 block"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#86b9b0]/50" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="gear-input gear-input-with-icon h-10 w-full" placeholder="Search catalogue settings" /></label>

        {editingId && <CatalogItemForm key={editingId} item={editingItem} categories={categories} saving={saving} onSubmit={saveItem} onCancel={() => setEditingId(null)} />}

        <div className="mt-4 grid max-h-[620px] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{filteredItems.map((item) => <article key={item.id} className={`flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-[#041421]/28 p-3 ${item.isActive ? "" : "opacity-45"}`}><GearVisual imageKey={item.imageKey} label={item.name} compact /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-white">{item.name}</p><p className="mt-1 truncate text-[9px] text-[#d0d6d6]/35">{categoryById.get(item.categoryId)?.name ?? "Unknown category"} · {item.estimatedUnitWeightGrams === undefined ? "no weight" : `~${item.estimatedUnitWeightGrams} g`}</p></div><button onClick={() => setEditingId(item.id)} className="grid size-8 shrink-0 place-items-center rounded-lg border border-white/[0.07] text-[#86b9b0]" aria-label={`Edit ${item.name}`}><Pencil className="size-3.5" /></button></article>)}</div>
      </section>
    </div>
  );
}

function CatalogItemForm({ item, categories, saving, onSubmit, onCancel }: { item?: GearCatalogItem; categories: GearCatalogCategory[]; saving: boolean; onSubmit: (event: React.FormEvent<HTMLFormElement>) => void; onCancel: () => void }) {
  const activeCategories = categories.filter((category) => category.isActive || category.id === item?.categoryId);
  return <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-2xl border border-[#86b9b0]/16 bg-[#041421]/40 p-4 md:grid-cols-2 xl:grid-cols-3">
    <SettingField label="Item name"><input name="name" defaultValue={item?.name} required maxLength={160} className="gear-input w-full" /></SettingField>
    <SettingField label="Category"><select name="categoryId" defaultValue={item?.categoryId ?? activeCategories[0]?.id} required className="gear-input w-full">{activeCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></SettingField>
    <SettingField label="Visual"><select name="imageKey" defaultValue={item?.imageKey ?? "package"} className="gear-input w-full">{imageOptions.map((key) => <option key={key} value={key}>{key}</option>)}</select></SettingField>
    <SettingField label="Estimated unit weight (g)"><input name="weight" type="number" min={0} max={100000} defaultValue={item?.estimatedUnitWeightGrams} className="gear-input w-full" /></SettingField>
    <SettingField label="Default quantity"><input name="quantity" type="number" min={1} max={100} defaultValue={item?.defaultQuantity ?? 1} className="gear-input w-full" /></SettingField>
    <SettingField label="Weight type"><select name="weightKind" defaultValue={item?.weightKind ?? "fixed"} className="gear-input w-full"><option value="fixed">Fixed gear</option><option value="consumable">Consumable</option></select></SettingField>
    <SettingField label="Default responsibility"><select name="scope" defaultValue={item?.defaultScope ?? "personal"} className="gear-input w-full"><option value="personal">Personal</option><option value="shared">Shared</option></select></SettingField>
    <SettingField label="Takealot search phrase"><input name="takealotSearchTerm" defaultValue={item?.takealotSearchTerm} maxLength={160} className="gear-input w-full" placeholder="Leave blank to hide shopping link" /></SettingField>
    <SettingField label="Short note"><input name="description" defaultValue={item?.description} className="gear-input w-full" /></SettingField>
    <label className="flex h-10 items-center justify-between rounded-xl border border-white/[0.07] px-3 text-[9px] font-semibold text-[#d0d6d6]/50">Essential<input name="isCritical" type="checkbox" defaultChecked={item?.isCritical} className="size-4 accent-[#86b9b0]" /></label>
    <label className="flex h-10 items-center justify-between rounded-xl border border-white/[0.07] px-3 text-[9px] font-semibold text-[#d0d6d6]/50">Optional<input name="isOptional" type="checkbox" defaultChecked={item?.isOptional} className="size-4 accent-[#86b9b0]" /></label>
    <label className="flex h-10 items-center justify-between rounded-xl border border-white/[0.07] px-3 text-[9px] font-semibold text-[#d0d6d6]/50">Visible<input name="isActive" type="checkbox" defaultChecked={item?.isActive ?? true} className="size-4 accent-[#86b9b0]" /></label>
    <div className="flex gap-2 md:col-span-2 xl:col-span-3"><button disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421] disabled:opacity-45">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save catalogue item</button><button type="button" onClick={onCancel} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs text-[#d0d6d6]/55">Cancel</button></div>
  </form>;
}

function SettingField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55"><span className="mb-1 block">{label}</span>{children}</label>;
}
