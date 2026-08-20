"use client";

import {
  AlertTriangle,
  Backpack,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  LoaderCircle,
  PackagePlus,
  Settings2,
  ShoppingBag,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import GearCataloguePanel from "@/components/logistics/GearCataloguePanel";
import GearSettingsPanel from "@/components/logistics/GearSettingsPanel";
import { GearVisual } from "@/components/logistics/GearVisual";
import { loadTripPeople, type TripMember } from "@/lib/cloudAdventures";
import {
  createGearCatalogCategory,
  createGearCatalogItem,
  ensureGearCatalog,
  updateGearCatalogCategory,
  updateGearCatalogItem,
} from "@/lib/cloudGearCatalog";
import {
  createAdventureGearItems,
  deleteAdventureGearItem,
  loadAdventureGear,
  updateAdventureGearItem,
} from "@/lib/cloudGear";
import type { AdventurePlan } from "@/types/adventure";
import {
  gearAcquisitionLabels,
  gearCategoryLabels,
  gearStatusLabels,
  type AdventureGearDraft,
  type AdventureGearItem,
  type GearAcquisitionStatus,
  type GearCatalogCategory,
  type GearCatalogCategoryDraft,
  type GearCatalogItem,
  type GearCatalogItemDraft,
  type GearPackingStatus,
  type GearScope,
} from "@/types/gear";

type GearView = "checklist" | "catalogue" | "settings";
type GearFilter = "all" | GearPackingStatus;

function databaseMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Gear could not be loaded.";
  if (message.includes("gear_catalog_") || message.includes("adventure_gear_items") || message.includes("schema cache") || message.includes("42P01") || message.includes("42703")) {
    return "The Gear catalogue database migration still needs to be applied in Supabase.";
  }
  return message;
}

function itemDraft(item: AdventureGearItem): AdventureGearDraft {
  return {
    catalogItemId: item.catalogItemId,
    name: item.name,
    category: item.category,
    scope: item.scope,
    packingStatus: item.packingStatus,
    acquisitionStatus: item.acquisitionStatus,
    quantity: item.quantity,
    packedQuantity: item.packedQuantity,
    assignedTo: item.assignedTo,
    unitWeightGrams: item.unitWeightGrams,
    weightIsEstimate: item.weightIsEstimate,
    weightKind: item.weightKind,
    imageKey: item.imageKey,
    takealotSearchTerm: item.takealotSearchTerm,
    isCritical: item.isCritical,
    templateKey: item.templateKey,
    notes: item.notes,
  };
}

function weightLabel(grams: number) {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)} kg`;
  return `${grams} g`;
}

function takealotSearchUrl(term: string) {
  return `https://www.takealot.com/all?qsearch=${encodeURIComponent(term)}`;
}

export default function GearWorkspace({ adventure, userId, canEdit }: { adventure?: AdventurePlan; userId: string; canEdit: boolean }) {
  const [view, setView] = useState<GearView>("checklist");
  const [items, setItems] = useState<AdventureGearItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [categories, setCategories] = useState<GearCatalogCategory[]>([]);
  const [catalogItems, setCatalogItems] = useState<GearCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<GearFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | GearScope>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const isTripMember = Boolean(adventure && (!adventure.access || adventure.access.isMember));

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });

    const tripRequest = adventure && (!adventure.access || adventure.access.isMember)
      ? Promise.all([loadAdventureGear(adventure.id), loadTripPeople(adventure.id)])
      : Promise.resolve<[AdventureGearItem[], { members: TripMember[] }]>([[], { members: [] }]);

    Promise.all([ensureGearCatalog(userId), tripRequest])
      .then(([catalogue, [tripGear, people]]) => {
        if (!active) return;
        setCategories(catalogue.categories);
        setCatalogItems(catalogue.items);
        setItems(tripGear);
        setMembers(people.members);
      })
      .catch((reason) => { if (active) setError(databaseMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure, userId]);

  const categoryBySlug = useMemo(() => new Map(categories.map((category) => [category.slug, category])), [categories]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => (statusFilter === "all" || item.packingStatus === statusFilter)
      && (scopeFilter === "all" || item.scope === scopeFilter)
      && (categoryFilter === "all" || item.category === categoryFilter)
      && (!query || `${item.name} ${item.notes ?? ""}`.toLowerCase().includes(query)));
  }, [categoryFilter, items, scopeFilter, search, statusFilter]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, AdventureGearItem[]>();
    filteredItems.forEach((item) => groups.set(item.category, [...(groups.get(item.category) ?? []), item]));
    return [...groups.entries()]
      .map(([category, groupItems]) => ({ category, items: groupItems }))
      .sort((a, b) => (categoryBySlug.get(a.category)?.sortOrder ?? 9999) - (categoryBySlug.get(b.category)?.sortOrder ?? 9999));
  }, [categoryBySlug, filteredItems]);

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const packedUnits = items.reduce((sum, item) => sum + item.packedQuantity, 0);
  const criticalOpen = items.filter((item) => item.isCritical && item.packingStatus !== "packed").length;
  const missingItems = items.filter((item) => item.packingStatus === "missing" || item.acquisitionStatus !== "owned").length;
  const fixedWeight = items.filter((item) => item.weightKind === "fixed").reduce((sum, item) => sum + (item.unitWeightGrams ?? 0) * item.quantity, 0);
  const consumableWeight = items.filter((item) => item.weightKind === "consumable").reduce((sum, item) => sum + (item.unitWeightGrams ?? 0) * item.quantity, 0);
  const unknownWeights = items.filter((item) => item.unitWeightGrams === undefined).length;
  const packedPercent = totalUnits ? Math.round((packedUnits / totalUnits) * 100) : 0;
  const addedCatalogIds = useMemo(() => new Set(items.map((item) => item.catalogItemId).filter((id): id is string => Boolean(id))), [items]);

  async function addCatalogueItems(selected: GearCatalogItem[]) {
    if (!adventure || !canEdit) return;
    const drafts: AdventureGearDraft[] = selected.flatMap((catalogItem) => {
      const category = categoryById.get(catalogItem.categoryId);
      if (!category) return [];
      return [{
        catalogItemId: catalogItem.id,
        name: catalogItem.name,
        category: category.slug,
        scope: catalogItem.defaultScope,
        packingStatus: "needed",
        acquisitionStatus: "owned",
        quantity: catalogItem.defaultQuantity,
        packedQuantity: 0,
        unitWeightGrams: catalogItem.estimatedUnitWeightGrams,
        weightIsEstimate: catalogItem.estimatedUnitWeightGrams !== undefined,
        weightKind: catalogItem.weightKind,
        imageKey: catalogItem.imageKey,
        takealotSearchTerm: catalogItem.takealotSearchTerm,
        isCritical: catalogItem.isCritical,
        notes: catalogItem.description,
      }];
    });
    if (!drafts.length) return;
    setSavingId("catalogue-add");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureGearItems(adventure.id, userId, drafts);
      setItems((current) => [...current, ...created]);
      setNotice(`${created.length} catalogue ${created.length === 1 ? "item" : "items"} added to this trip.`);
      setView("checklist");
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function patchItem(item: AdventureGearItem, patch: Partial<AdventureGearDraft>) {
    if (!adventure || !canEdit) return;
    const draft = { ...itemDraft(item), ...patch };
    if (draft.packingStatus === "packed") draft.packedQuantity = draft.quantity;
    if (draft.packedQuantity >= draft.quantity) {
      draft.packedQuantity = draft.quantity;
      draft.packingStatus = "packed";
    }
    if (draft.packingStatus === "assigned" && !draft.assignedTo) draft.packingStatus = "needed";
    setSavingId(item.id);
    setError(null);
    try {
      const updated = await updateAdventureGearItem(item.id, adventure.id, draft);
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function removeItem(item: AdventureGearItem) {
    if (!adventure || !canEdit) return;
    setSavingId(item.id);
    setError(null);
    try {
      await deleteAdventureGearItem(item.id, adventure.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`${item.name} removed from this trip.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function addCategory(draft: GearCatalogCategoryDraft) {
    setSavingId("catalogue-settings");
    setError(null);
    try {
      const created = await createGearCatalogCategory(userId, draft);
      setCategories((current) => [...current, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setNotice(`${created.name} added to your private catalogue.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function saveCategory(category: GearCatalogCategory, draft: GearCatalogCategoryDraft) {
    setSavingId("catalogue-settings");
    setError(null);
    try {
      const updated = await updateGearCatalogCategory(userId, category.id, draft);
      setCategories((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setNotice(`${updated.name} settings saved.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function saveCatalogItem(item: GearCatalogItem | undefined, draft: GearCatalogItemDraft) {
    setSavingId("catalogue-settings");
    setError(null);
    try {
      const saved = item ? await updateGearCatalogItem(userId, item.id, draft) : await createGearCatalogItem(userId, draft);
      setCatalogItems((current) => item ? current.map((candidate) => candidate.id === saved.id ? saved : candidate) : [...current, saved]);
      setNotice(`${saved.name} saved to your private catalogue.`);
      return true;
    } catch (reason) {
      setError(databaseMessage(reason));
      return false;
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <div className="mt-7 grid min-h-64 place-items-center rounded-[22px] border border-white/[0.06] bg-[#041421]/28"><LoaderCircle className="size-6 animate-spin text-[#86b9b0]" /></div>;

  return (
    <div className="mt-7 space-y-4">
      <section className="flex flex-col gap-3 rounded-[22px] border border-white/[0.07] bg-[#071b28]/65 p-3 lg:flex-row lg:items-center">
        <div className="mr-auto px-2"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#86b9b0]/55">Gear workspace</p><p className="mt-1 text-[10px] text-[#d0d6d6]/40">A private reusable catalogue feeding a shared trip checklist.</p></div>
        <div className="grid grid-cols-3 rounded-2xl border border-white/[0.07] bg-[#041421]/55 p-1">
          <ViewButton active={view === "checklist"} onClick={() => setView("checklist")} icon={ClipboardCheck}>Trip checklist</ViewButton>
          <ViewButton active={view === "catalogue"} onClick={() => setView("catalogue")} icon={PackagePlus}>Add gear</ViewButton>
          <ViewButton active={view === "settings"} onClick={() => setView("settings")} icon={Settings2}>Gear settings</ViewButton>
        </div>
      </section>

      {error && <div className="flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[10px] text-amber-100/70"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{error}</div>}
      {notice && <div className="rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-3 text-[10px] text-[#86b9b0]">{notice}</div>}

      {view === "settings" && <GearSettingsPanel categories={categories} items={catalogItems} saving={savingId === "catalogue-settings"} onCreateCategory={addCategory} onUpdateCategory={saveCategory} onSaveItem={saveCatalogItem} />}

      {view === "catalogue" && (!adventure || !isTripMember ? <WorkspaceNotice title={adventure ? "Join this trip to add equipment" : "Choose a saved route to build its checklist"} detail="You can still manage your reusable catalogue in Gear Settings." /> : !canEdit ? <WorkspaceNotice title="Viewer access" detail="You can review this trip checklist, but only its creator and contributors can add equipment." /> : <GearCataloguePanel categories={categories} items={catalogItems} addedCatalogIds={addedCatalogIds} saving={savingId === "catalogue-add"} onAdd={addCatalogueItems} />)}

      {view === "checklist" && (!adventure ? <WorkspaceNotice title="Choose a saved route" detail="The trip checklist needs a route, while Gear Settings remains available without one." /> : !isTripMember ? <WorkspaceNotice title="Gear is private to trip members" detail="Public visitors can view the route, but packing lists and assignments require an accepted invitation." /> : <>
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          <Metric label="Packing progress" value={`${packedPercent}%`} note={`${packedUnits}/${totalUnits} units packed`} />
          <Metric label="Critical open" value={String(criticalOpen)} note={criticalOpen ? "Resolve before departure" : "Critical gear covered"} warning={criticalOpen > 0} />
          <Metric label="Need / missing" value={String(missingItems)} note={missingItems ? "Needs sourcing" : "Everything is available"} warning={missingItems > 0} />
          <Metric label="Base gear" value={weightLabel(fixedWeight)} note={`${unknownWeights} unknown weights`} />
          <Metric label="Consumables" value={weightLabel(consumableWeight)} note="Food, water and fuel" />
          <Metric label="Trip members" value={String(members.length)} note="Available for assignments" />
        </section>

        <section className="glass-panel rounded-[22px] p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end"><div className="mr-auto"><div className="flex items-center gap-2"><ClipboardCheck className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Trip checklist</h3></div><p className="mt-1 text-[10px] text-[#d0d6d6]/40">Fast packing controls stay visible; quantities, weight and notes open only when needed.</p></div>{canEdit && <button onClick={() => setView("catalogue")} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]"><PackagePlus className="size-4" /> Add from catalogue</button>}</div>

          <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative"><input value={search} onChange={(event) => setSearch(event.target.value)} className="gear-input h-10 w-full" placeholder="Search this trip checklist" /></label>
            <FilterSelect value={statusFilter} onChange={(value) => setStatusFilter(value as GearFilter)} options={[{ value: "all", label: "All status" }, ...Object.entries(gearStatusLabels).map(([value, label]) => ({ value, label }))]} />
            <FilterSelect value={scopeFilter} onChange={(value) => setScopeFilter(value as "all" | GearScope)} options={[{ value: "all", label: "All responsibility" }, { value: "personal", label: "Personal" }, { value: "shared", label: "Shared" }]} />
            <FilterSelect value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "all", label: "All categories" }, ...[...new Set(items.map((item) => item.category))].map((value) => ({ value, label: categoryBySlug.get(value)?.name ?? gearCategoryLabels[value] ?? value }))]} />
          </div>

          <div className="mt-5 space-y-5">{groupedItems.map((group) => <GearGroup key={group.category} categoryName={categoryBySlug.get(group.category)?.name ?? gearCategoryLabels[group.category] ?? group.category} items={group.items} members={members} canEdit={canEdit} savingId={savingId} onPatch={patchItem} onRemove={removeItem} />)}{!groupedItems.length && <WorkspaceNotice title="No gear matches these filters" detail={items.length ? "Adjust the filters to see the rest of the checklist." : "Open Add gear to select essentials from your visual catalogue."} />}</div>
        </section>
      </>)}
    </div>
  );
}

function GearGroup({ categoryName, items, members, canEdit, savingId, onPatch, onRemove }: { categoryName: string; items: AdventureGearItem[]; members: TripMember[]; canEdit: boolean; savingId: string | null; onPatch: (item: AdventureGearItem, patch: Partial<AdventureGearDraft>) => Promise<void>; onRemove: (item: AdventureGearItem) => Promise<void> }) {
  const packed = items.filter((item) => item.packingStatus === "packed").length;
  return <section><div className="mb-2 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><Backpack className="size-4" /></span><div><h4 className="text-xs font-semibold text-white">{categoryName}</h4><p className="text-[9px] text-[#d0d6d6]/34">{packed}/{items.length} item lines packed</p></div></div><div className="overflow-hidden rounded-2xl border border-white/[0.07]">{items.map((item) => <GearRow key={item.id} item={item} members={members} canEdit={canEdit} saving={savingId === item.id} onPatch={(patch) => void onPatch(item, patch)} onRemove={() => void onRemove(item)} />)}</div></section>;
}

function GearRow({ item, members, canEdit, saving, onPatch, onRemove }: { item: AdventureGearItem; members: TripMember[]; canEdit: boolean; saving: boolean; onPatch: (patch: Partial<AdventureGearDraft>) => void; onRemove: () => void }) {
  const packed = item.packingStatus === "packed";
  const assignee = members.find((member) => member.userId === item.assignedTo);

  function assign(nextUserId: string) {
    onPatch({ assignedTo: nextUserId || undefined, packingStatus: nextUserId ? (packed ? "packed" : "assigned") : (packed ? "packed" : "needed") });
  }

  function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const quantity = Math.max(1, Math.min(100, Number(form.get("quantity") ?? item.quantity)));
    const rawWeight = String(form.get("unitWeightGrams") ?? "").trim();
    onPatch({
      quantity,
      packedQuantity: packed ? quantity : Math.min(item.packedQuantity, Math.max(0, quantity - 1)),
      unitWeightGrams: rawWeight === "" ? undefined : Number(rawWeight),
      weightIsEstimate: form.get("weightIsEstimate") === "on",
      weightKind: String(form.get("weightKind") ?? item.weightKind) as AdventureGearDraft["weightKind"],
      scope: String(form.get("scope") ?? item.scope) as GearScope,
      packingStatus: String(form.get("packingStatus") ?? item.packingStatus) as GearPackingStatus,
      notes: String(form.get("notes") ?? ""),
      isCritical: form.get("isCritical") === "on",
    });
  }

  const shopUrl = item.takealotSearchTerm ? takealotSearchUrl(item.takealotSearchTerm) : undefined;
  const shopVisible = Boolean(shopUrl && (item.acquisitionStatus === "buy" || item.acquisitionStatus === "need"));
  return <article className={`border-b border-white/[0.06] bg-[#041421]/28 p-3 last:border-b-0 ${item.packingStatus === "missing" ? "bg-rose-300/[0.035]" : packed ? "bg-[#86b9b0]/[0.04]" : ""}`}>
    <div className="grid items-center gap-3 md:grid-cols-[auto_auto_minmax(140px,1fr)_minmax(130px,0.7fr)_minmax(105px,0.5fr)_auto]">
      <button disabled={!canEdit || saving} onClick={() => onPatch({ packingStatus: packed ? (item.assignedTo ? "assigned" : "needed") : "packed", packedQuantity: packed ? 0 : item.quantity })} className={`grid size-9 place-items-center rounded-xl border ${packed ? "border-[#86b9b0]/30 bg-[#86b9b0]/14 text-[#86b9b0]" : "border-white/[0.09] text-[#d0d6d6]/25"}`} aria-label={packed ? `Mark ${item.name} unpacked` : `Mark ${item.name} packed`}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}</button>
      <GearVisual imageKey={item.imageKey} label={item.name} compact />
      <div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><h5 className="truncate text-xs font-semibold text-white">{item.name}</h5>{item.isCritical && <Badge tone="critical">Essential</Badge>}<Badge>{item.scope}</Badge></div><p className="mt-1 text-[9px] text-[#d0d6d6]/38">{gearStatusLabels[item.packingStatus]} · {item.packedQuantity}/{item.quantity} packed · {item.unitWeightGrams === undefined ? "weight unknown" : `${item.weightIsEstimate ? "~" : ""}${weightLabel(item.unitWeightGrams * item.quantity)}`}</p></div>
      {canEdit ? <select disabled={saving} value={item.assignedTo ?? ""} onChange={(event) => assign(event.target.value)} className="gear-input h-9"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select> : <p className="truncate text-[10px] text-[#d0d6d6]/48">{assignee?.name ?? "Unassigned"}</p>}
      {canEdit ? <select disabled={saving} value={item.acquisitionStatus} onChange={(event) => onPatch({ acquisitionStatus: event.target.value as GearAcquisitionStatus })} className="gear-input h-9">{Object.entries(gearAcquisitionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> : <Badge>{gearAcquisitionLabels[item.acquisitionStatus]}</Badge>}
      <div className="flex justify-end gap-2">{shopVisible && shopUrl && <a href={shopUrl} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-xl border border-[#86b9b0]/18 text-[#86b9b0]" aria-label={`Search Takealot for ${item.name}`} title="Search Takealot"><ShoppingBag className="size-3.5" /></a>}</div>
    </div>
    <details className="mt-2"><summary className="cursor-pointer text-right text-[9px] font-semibold text-[#86b9b0]/65">Quantity, weight and notes</summary><form onSubmit={saveDetails} className="mt-3 grid gap-2 rounded-xl border border-white/[0.06] bg-[#041421]/38 p-3 sm:grid-cols-2 xl:grid-cols-4"><input name="quantity" type="number" min={1} max={100} defaultValue={item.quantity} className="gear-input" aria-label="Quantity" /><input name="unitWeightGrams" type="number" min={0} max={100000} defaultValue={item.unitWeightGrams} className="gear-input" placeholder="Unit weight in grams" /><select name="weightKind" defaultValue={item.weightKind} className="gear-input"><option value="fixed">Fixed gear</option><option value="consumable">Consumable</option></select><select name="scope" defaultValue={item.scope} className="gear-input"><option value="personal">Personal</option><option value="shared">Shared</option></select><select name="packingStatus" defaultValue={item.packingStatus} className="gear-input"><option value="needed">Needed</option><option value="assigned" disabled={!item.assignedTo}>Assigned</option><option value="packed">Packed</option><option value="missing">Missing</option></select><label className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 text-[9px] text-[#d0d6d6]/50">Estimated weight<input name="weightIsEstimate" type="checkbox" defaultChecked={item.weightIsEstimate} className="size-4 accent-[#86b9b0]" /></label><label className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 text-[9px] text-[#d0d6d6]/50">Essential<input name="isCritical" type="checkbox" defaultChecked={item.isCritical} className="size-4 accent-[#86b9b0]" /></label><textarea name="notes" defaultValue={item.notes} className="min-h-10 rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-[10px] text-white outline-none" placeholder="Size, brand or storage notes" />{canEdit && <div className="flex gap-2 sm:col-span-2 xl:col-span-4"><button disabled={saving} className="h-9 rounded-xl bg-[#86b9b0] px-4 text-[10px] font-bold text-[#041421] disabled:opacity-45">Save details</button><button type="button" onClick={onRemove} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-xl border border-rose-300/12 px-4 text-[10px] text-rose-200/60"><Trash2 className="size-3.5" /> Remove from trip</button>{shopVisible && shopUrl && <a href={shopUrl} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-[#86b9b0]/15 px-4 text-[10px] text-[#86b9b0]"><ExternalLink className="size-3.5" /> Search Takealot</a>}</div>}</form></details>
  </article>;
}

function ViewButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: typeof ClipboardCheck; children: React.ReactNode }) {
  return <button onClick={onClick} className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-[10px] font-semibold transition ${active ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/42 hover:text-white"}`}><Icon className="size-3.5" />{children}</button>;
}

function FilterSelect({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <label className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="gear-input h-10 min-w-36 appearance-none pr-8">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-3.5 text-[#86b9b0]" /></label>;
}

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "critical" }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[8px] font-bold uppercase tracking-wider ${tone === "critical" ? "bg-amber-300/10 text-amber-100/70" : "bg-white/[0.045] text-[#d0d6d6]/42"}`}>{children}</span>;
}

function Metric({ label, value, note, warning = false }: { label: string; value: string; note: string; warning?: boolean }) {
  return <article className={`soft-panel rounded-2xl p-4 ${warning ? "border-amber-300/14" : ""}`}><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p>{warning && <AlertTriangle className="size-3.5 text-amber-200/65" />}</div><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/36">{note}</p></article>;
}

function WorkspaceNotice({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-[22px] border border-dashed border-white/[0.08] p-10 text-center"><Backpack className="mx-auto size-5 text-[#86b9b0]/55" /><p className="mt-2 text-xs font-semibold text-white">{title}</p><p className="mx-auto mt-1 max-w-lg text-[10px] leading-5 text-[#d0d6d6]/38">{detail}</p></div>;
}
