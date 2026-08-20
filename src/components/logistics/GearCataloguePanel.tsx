"use client";

import { Check, LoaderCircle, PackagePlus, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { GearVisual } from "@/components/logistics/GearVisual";
import type { GearCatalogCategory, GearCatalogItem } from "@/types/gear";

function grams(value: number | undefined) {
  if (value === undefined) return "Weight unknown";
  return value >= 1000 ? `~${(value / 1000).toFixed(1)} kg` : `~${value} g`;
}

export default function GearCataloguePanel({
  categories,
  items,
  addedCatalogIds,
  saving,
  onAdd,
}: {
  categories: GearCatalogCategory[];
  items: GearCatalogItem[];
  addedCatalogIds: Set<string>;
  saving: boolean;
  onAdd: (items: GearCatalogItem[]) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activeCategories = categories.filter((category) => category.isActive);
  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => item.isActive
      && categoryById.get(item.categoryId)?.isActive
      && (categoryId === "all" || item.categoryId === categoryId)
      && (!query || `${item.name} ${item.description ?? ""} ${categoryById.get(item.categoryId)?.name ?? ""}`.toLowerCase().includes(query)));
  }, [categoryById, categoryId, items, search]);

  function toggle(itemId: string) {
    if (addedCatalogIds.has(itemId)) return;
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function selectEssentials() {
    setSelected(new Set(visibleItems.filter((item) => item.isCritical && !addedCatalogIds.has(item.id)).map((item) => item.id)));
  }

  async function addSelected() {
    const chosen = items.filter((item) => selected.has(item.id) && !addedCatalogIds.has(item.id));
    if (!chosen.length) return;
    await onAdd(chosen);
    setSelected(new Set());
  }

  return (
    <section className="glass-panel rounded-[22px] p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="mr-auto">
          <div className="flex items-center gap-2"><PackagePlus className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Add gear from your catalogue</h3></div>
          <p className="mt-1 max-w-2xl text-[10px] leading-5 text-[#d0d6d6]/42">Select several items at once. Estimated weights and defaults are copied into this trip and can be adjusted without changing your catalogue.</p>
        </div>
        <button onClick={selectEssentials} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 px-4 text-xs font-semibold text-[#86b9b0]"><Sparkles className="size-4" /> Select essentials</button>
      </div>

      <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center">
        <label className="relative block min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-[#86b9b0]/55" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search helmet, stove, water filter…" className="gear-input gear-input-with-icon h-10 w-full" /></label>
        <div className="flex gap-2 overflow-x-auto pb-1 xl:max-w-[68%]">
          <CategoryChip active={categoryId === "all"} onClick={() => setCategoryId("all")}>All</CategoryChip>
          {activeCategories.map((category) => <CategoryChip key={category.id} active={categoryId === category.id} onClick={() => setCategoryId(category.id)}>{category.name}</CategoryChip>)}
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
        {visibleItems.map((item) => {
          const isAdded = addedCatalogIds.has(item.id);
          const isSelected = selected.has(item.id);
          const category = categoryById.get(item.categoryId);
          return (
            <button key={item.id} type="button" disabled={isAdded} onClick={() => toggle(item.id)} className={`group relative rounded-2xl border p-3 text-left transition ${isAdded ? "cursor-default border-white/[0.05] opacity-45" : isSelected ? "border-[#86b9b0]/48 bg-[#86b9b0]/[0.08]" : "border-white/[0.07] bg-[#041421]/32 hover:border-[#86b9b0]/24 hover:bg-[#86b9b0]/[0.035]"}`}>
              <GearVisual imageKey={item.imageKey} label={item.name} />
              <div className="mt-3 flex items-start gap-2">
                <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{item.name}</p><p className="mt-1 truncate text-[9px] text-[#d0d6d6]/38">{category?.name ?? "Gear"} · {grams(item.estimatedUnitWeightGrams)}</p></div>
                <span className={`grid size-6 shrink-0 place-items-center rounded-full border ${isAdded || isSelected ? "border-[#86b9b0]/35 bg-[#86b9b0]/16 text-[#86b9b0]" : "border-white/[0.1] text-transparent"}`}><Check className="size-3.5" /></span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">{item.isCritical && <Tag tone="critical">Essential</Tag>}{item.isOptional && <Tag>Optional</Tag>}<Tag>{item.defaultScope}</Tag>{isAdded && <Tag tone="added">On trip</Tag>}</div>
            </button>
          );
        })}
      </div>

      {!visibleItems.length && <div className="mt-5 rounded-2xl border border-dashed border-white/[0.08] p-8 text-center text-xs text-[#d0d6d6]/45">No catalogue items match this search.</div>}

      <div className="sticky bottom-4 mt-5 grid grid-cols-[auto_1fr] items-center gap-2 rounded-2xl border border-[#86b9b0]/20 bg-[#071b28]/95 p-3 shadow-2xl backdrop-blur sm:flex sm:gap-3">
        <p className="col-span-2 mr-auto text-[10px] text-[#d0d6d6]/50 sm:col-span-1"><strong className="text-white">{selected.size}</strong> items selected</p>
        <button onClick={() => setSelected(new Set())} disabled={!selected.size || saving} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs text-[#d0d6d6]/55 disabled:opacity-35">Clear</button>
        <button onClick={() => void addSelected()} disabled={!selected.size || saving} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421] disabled:opacity-40">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <PackagePlus className="size-4" />} Add selected to trip</button>
      </div>
    </section>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-full border px-3 py-2 text-[9px] font-semibold transition ${active ? "border-[#86b9b0]/35 bg-[#86b9b0]/12 text-[#b9d9d3]" : "border-white/[0.07] text-[#d0d6d6]/40 hover:text-white"}`}>{children}</button>;
}

function Tag({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "critical" | "added" }) {
  const className = tone === "critical" ? "bg-amber-300/10 text-amber-100/70" : tone === "added" ? "bg-[#86b9b0]/12 text-[#86b9b0]" : "bg-white/[0.045] text-[#d0d6d6]/42";
  return <span className={`rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${className}`}>{children}</span>;
}
