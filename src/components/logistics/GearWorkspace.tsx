"use client";

import {
  AlertTriangle,
  Backpack,
  Bike,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadTripPeople, type TripMember } from "@/lib/cloudAdventures";
import {
  createAdventureGearItem,
  createAdventureGearItems,
  deleteAdventureGearItem,
  loadAdventureGear,
  updateAdventureGearItem,
} from "@/lib/cloudGear";
import type { AdventurePlan } from "@/types/adventure";
import {
  GEAR_CATEGORIES,
  gearCategoryLabels,
  gearStatusLabels,
  type AdventureGearDraft,
  type AdventureGearItem,
  type GearCategory,
  type GearPackingStatus,
  type GearScope,
} from "@/types/gear";

type GearFilter = "all" | GearPackingStatus;

const categoryIcons: Record<GearCategory, typeof Bike> = {
  bike_repairs: Bike,
  sleep_shelter: Backpack,
  navigation_power: ClipboardList,
  food_water: PackageCheck,
  clothing: Backpack,
  safety_medical: ShieldCheck,
  documents: ClipboardList,
  other: PackageCheck,
};

function starterGear(memberCount: number): AdventureGearDraft[] {
  const riders = Math.max(1, memberCount);
  const item = (
    templateKey: string,
    name: string,
    category: GearCategory,
    scope: GearScope,
    quantity: number,
    unitWeightGrams: number | undefined,
    isCritical: boolean,
  ): AdventureGearDraft => ({
    name,
    category,
    scope,
    packingStatus: "needed",
    quantity,
    packedQuantity: 0,
    unitWeightGrams,
    isCritical,
    templateKey,
  });

  return [
    item("bike-multitool", "Bike multi-tool", "bike_repairs", "shared", 1, 220, true),
    item("bike-pump", "Reliable pump", "bike_repairs", "shared", 1, 180, true),
    item("bike-tubes", "Spare tubes", "bike_repairs", "shared", Math.max(2, riders), 120, true),
    item("bike-chain", "Quick links and chain tool", "bike_repairs", "shared", 1, 90, true),
    item("sleep-shelter", "Tent or weatherproof shelter", "sleep_shelter", "shared", 1, 2200, true),
    item("sleep-bag", "Sleeping bag", "sleep_shelter", "personal", riders, 950, true),
    item("sleep-mat", "Sleeping mat", "sleep_shelter", "personal", riders, 520, true),
    item("nav-primary", "Primary GPS or offline phone", "navigation_power", "shared", 1, 240, true),
    item("nav-power", "Power bank", "navigation_power", "shared", Math.max(1, Math.ceil(riders / 2)), 360, true),
    item("nav-cables", "Charging cables and adaptors", "navigation_power", "shared", 1, 180, false),
    item("water-capacity", "Two-litre water capacity", "food_water", "personal", riders, 180, true),
    item("water-treatment", "Water treatment or filter", "food_water", "shared", 1, 120, true),
    item("safety-first-aid", "First-aid kit", "safety_medical", "shared", 1, 420, true),
    item("safety-lights", "Front and rear lights", "safety_medical", "personal", riders, 210, true),
    item("clothing-rain", "Rain shell", "clothing", "personal", riders, 340, true),
    item("documents-access", "Permits, access notes and emergency numbers", "documents", "shared", 1, undefined, true),
  ];
}

function databaseMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Gear could not be loaded.";
  if (message.includes("adventure_gear_items") || message.includes("schema cache") || message.includes("42P01")) {
    return "The Phase B gear database migration still needs to be applied in Supabase.";
  }
  return message;
}

function itemDraft(item: AdventureGearItem): AdventureGearDraft {
  return {
    name: item.name,
    category: item.category,
    scope: item.scope,
    packingStatus: item.packingStatus,
    quantity: item.quantity,
    packedQuantity: item.packedQuantity,
    assignedTo: item.assignedTo,
    unitWeightGrams: item.unitWeightGrams,
    isCritical: item.isCritical,
    templateKey: item.templateKey,
    notes: item.notes,
  };
}

function kilograms(grams: number) {
  return `${(grams / 1000).toFixed(1)} kg`;
}

export default function GearWorkspace({
  adventure,
  userId,
  canEdit,
}: {
  adventure?: AdventurePlan;
  userId: string;
  canEdit: boolean;
}) {
  const [items, setItems] = useState<AdventureGearItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(Boolean(adventure));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<GearFilter>("all");
  const [scopeFilter, setScopeFilter] = useState<"all" | GearScope>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | GearCategory>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<GearCategory>("bike_repairs");
  const [scope, setScope] = useState<GearScope>("shared");
  const [quantity, setQuantity] = useState(1);
  const [weight, setWeight] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [critical, setCritical] = useState(false);
  const [notes, setNotes] = useState("");

  const isPublicGuest = Boolean(adventure?.access && !adventure.access.isMember);

  useEffect(() => {
    let active = true;
    if (!adventure || (adventure.access && !adventure.access.isMember)) {
      queueMicrotask(() => {
        if (active) {
          setItems([]);
          setMembers([]);
          setLoading(false);
        }
      });
      return () => { active = false; };
    }

    queueMicrotask(() => {
      if (active) {
        setLoading(true);
        setError(null);
      }
    });
    Promise.all([loadAdventureGear(adventure.id), loadTripPeople(adventure.id)])
      .then(([gear, people]) => {
        if (active) {
          setItems(gear);
          setMembers(people.members);
        }
      })
      .catch((reason) => { if (active) setError(databaseMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure]);

  const filteredItems = useMemo(() => items.filter((item) => (
    (statusFilter === "all" || item.packingStatus === statusFilter)
    && (scopeFilter === "all" || item.scope === scopeFilter)
    && (categoryFilter === "all" || item.category === categoryFilter)
  )), [categoryFilter, items, scopeFilter, statusFilter]);

  const groupedItems = useMemo(() => GEAR_CATEGORIES
    .map((group) => ({ category: group, items: filteredItems.filter((item) => item.category === group) }))
    .filter((group) => group.items.length), [filteredItems]);

  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);
  const packedUnits = items.reduce((sum, item) => sum + item.packedQuantity, 0);
  const criticalOpen = items.filter((item) => item.isCritical && item.packingStatus !== "packed").length;
  const missingItems = items.filter((item) => item.packingStatus === "missing").length;
  const totalWeight = items.reduce((sum, item) => sum + (item.unitWeightGrams ?? 0) * item.quantity, 0);
  const packedPercent = totalUnits ? Math.round((packedUnits / totalUnits) * 100) : 0;

  async function addItem(draft: AdventureGearDraft) {
    if (!adventure) return false;
    setSavingId("new");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureGearItem(adventure.id, userId, draft);
      setItems((current) => [...current, created]);
      setNotice(`${created.name} added to the trip list.`);
      return true;
    } catch (reason) {
      setError(databaseMessage(reason));
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function addManualItem() {
    const unitWeightGrams = weight === "" ? undefined : Number(weight);
    if (!name.trim() || quantity < 1 || quantity > 100 || (unitWeightGrams !== undefined && (!Number.isFinite(unitWeightGrams) || unitWeightGrams < 0))) {
      setError("Enter an item name, a quantity from 1 to 100, and a valid optional weight.");
      return;
    }
    const saved = await addItem({
      name,
      category,
      scope,
      packingStatus: assignedTo ? "assigned" : "needed",
      quantity,
      packedQuantity: 0,
      assignedTo: assignedTo || undefined,
      unitWeightGrams,
      isCritical: critical,
      notes,
    });
    if (!saved) return;
    setName("");
    setQuantity(1);
    setWeight("");
    setAssignedTo("");
    setCritical(false);
    setNotes("");
    setFormOpen(false);
  }

  async function applyStarterTemplate() {
    if (!adventure) return;
    const existingKeys = new Set(items.map((item) => item.templateKey).filter(Boolean));
    const missing = starterGear(members.length).filter((item) => !existingKeys.has(item.templateKey));
    if (!missing.length) {
      setNotice("The complete bikepacking starter list is already included.");
      return;
    }
    setSavingId("template");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureGearItems(adventure.id, userId, missing);
      setItems((current) => [...current, ...created]);
      setNotice(`${created.length} starter items added. Adjust quantities and assignments for this trip.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function patchItem(item: AdventureGearItem, patch: Partial<AdventureGearDraft>) {
    if (!adventure) return;
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
      setNotice(`${updated.name} updated.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function removeItem(item: AdventureGearItem) {
    if (!adventure) return;
    setSavingId(item.id);
    setError(null);
    try {
      await deleteAdventureGearItem(item.id, adventure.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`${item.name} removed.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  if (!adventure) {
    return <EmptyState title="Choose a saved route" detail="Gear belongs to a trip so assignments, shared equipment and readiness stay connected." />;
  }
  if (isPublicGuest) {
    return <EmptyState title="Gear is private to trip members" detail="Public visitors can view the route, but packing lists and assignments are available only after accepting a trip invitation." />;
  }

  return (
    <div className="mt-7 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Packing progress" value={`${packedPercent}%`} note={`${packedUnits}/${totalUnits} units packed`} />
        <Metric label="Critical open" value={String(criticalOpen)} note={criticalOpen ? "Resolve before departure" : "Critical gear covered"} warning={criticalOpen > 0} />
        <Metric label="Missing" value={String(missingItems)} note={missingItems ? "Needs sourcing" : "Nothing marked missing"} warning={missingItems > 0} />
        <Metric label="Trip members" value={String(members.length)} note="Available for assignments" />
        <Metric label="Estimated weight" value={kilograms(totalWeight)} note="Known item weights" />
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="mr-auto">
            <div className="flex items-center gap-2"><ClipboardList className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Trip packing list</h3></div>
            <p className="mt-1 text-[10px] text-[#d0d6d6]/40">Personal and shared equipment stays visible to accepted members. Viewers can review the list but cannot change it.</p>
          </div>
          {canEdit && <button onClick={() => void applyStarterTemplate()} disabled={savingId !== null} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 px-4 text-xs font-semibold text-[#86b9b0] disabled:opacity-40">{savingId === "template" ? <LoaderCircle className="size-4 animate-spin" /> : <PackageCheck className="size-4" />} Add starter list</button>}
          {canEdit && <button onClick={() => setFormOpen((open) => !open)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]"><Plus className="size-4" /> Add item</button>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "needed", "assigned", "packed", "missing"] as GearFilter[]).map((value) => <FilterButton key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === "all" ? "All status" : gearStatusLabels[value]}</FilterButton>)}
          <span className="mx-1 hidden h-7 w-px bg-white/[0.07] sm:block" />
          {(["all", "personal", "shared"] as const).map((value) => <FilterButton key={value} active={scopeFilter === value} onClick={() => setScopeFilter(value)}>{value === "all" ? "All gear" : value}</FilterButton>)}
          <label className="relative ml-auto"><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | GearCategory)} className="gear-input appearance-none pr-8"><option value="all">All categories</option>{GEAR_CATEGORIES.map((value) => <option key={value} value={value}>{gearCategoryLabels[value]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-3.5 text-[#86b9b0]" /></label>
        </div>

        {formOpen && <div className="mt-4 grid gap-3 rounded-2xl border border-[#86b9b0]/15 bg-[#041421]/35 p-4 md:grid-cols-2 xl:grid-cols-4">
          <Field label="Item name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Spare brake pads" className="gear-input w-full" /></Field>
          <Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as GearCategory)} className="gear-input w-full">{GEAR_CATEGORIES.map((value) => <option key={value} value={value}>{gearCategoryLabels[value]}</option>)}</select></Field>
          <Field label="Personal or shared"><select value={scope} onChange={(event) => setScope(event.target.value as GearScope)} className="gear-input w-full"><option value="shared">Shared</option><option value="personal">Personal</option></select></Field>
          <Field label="Quantity"><input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.max(1, Number(event.target.value)))} className="gear-input w-full" /></Field>
          <Field label="Unit weight (grams)"><input type="number" min={0} max={100000} value={weight} onChange={(event) => setWeight(event.target.value)} className="gear-input w-full" /></Field>
          <Field label="Responsible person"><select value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="gear-input w-full"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></Field>
          <Field label="Notes"><input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Size, brand, repair detail…" className="gear-input w-full" /></Field>
          <label className="flex items-end"><span className="flex h-10 w-full cursor-pointer items-center justify-between rounded-xl border border-white/[0.08] bg-[#041421]/56 px-3 text-[10px] font-semibold text-[#d0d6d6]/60">Critical item<input type="checkbox" checked={critical} onChange={(event) => setCritical(event.target.checked)} className="size-4 accent-[#86b9b0]" /></span></label>
          <div className="flex gap-2 md:col-span-2 xl:col-span-4"><button onClick={() => void addManualItem()} disabled={savingId === "new"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421] disabled:opacity-45">{savingId === "new" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save item</button><button onClick={() => setFormOpen(false)} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs text-[#d0d6d6]/55">Cancel</button></div>
        </div>}

        {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[10px] text-amber-100/70"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{error}</div>}
        {notice && <div className="mt-4 rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-3 text-[10px] text-[#86b9b0]">{notice}</div>}

        {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="size-6 animate-spin text-[#86b9b0]" /></div> : <div className="mt-5 space-y-5">{groupedItems.map((group) => <GearGroup key={group.category} category={group.category} items={group.items} members={members} canEdit={canEdit} savingId={savingId} onPatch={patchItem} onRemove={removeItem} />)}{!groupedItems.length && <EmptyState title="No gear matches these filters" detail={items.length ? "Adjust the filters to see the rest of the packing list." : "Add the bikepacking starter list or create the first trip-specific item."} />}</div>}
      </section>
    </div>
  );
}

function GearGroup({ category, items, members, canEdit, savingId, onPatch, onRemove }: { category: GearCategory; items: AdventureGearItem[]; members: TripMember[]; canEdit: boolean; savingId: string | null; onPatch: (item: AdventureGearItem, patch: Partial<AdventureGearDraft>) => Promise<void>; onRemove: (item: AdventureGearItem) => Promise<void> }) {
  const Icon = categoryIcons[category];
  const packed = items.filter((item) => item.packingStatus === "packed").length;
  return <section><div className="mb-2 flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><Icon className="size-4" /></span><div><h4 className="text-xs font-semibold text-white">{gearCategoryLabels[category]}</h4><p className="text-[9px] text-[#d0d6d6]/34">{packed}/{items.length} item lines packed</p></div></div><div className="grid gap-2 xl:grid-cols-2">{items.map((item) => <GearCard key={item.id} item={item} members={members} canEdit={canEdit} saving={savingId === item.id} onPatch={(patch) => void onPatch(item, patch)} onRemove={() => void onRemove(item)} />)}</div></section>;
}

function GearCard({ item, members, canEdit, saving, onPatch, onRemove }: { item: AdventureGearItem; members: TripMember[]; canEdit: boolean; saving: boolean; onPatch: (patch: Partial<AdventureGearDraft>) => void; onRemove: () => void }) {
  const assignee = members.find((member) => member.userId === item.assignedTo);
  const packed = item.packingStatus === "packed";
  const statusTone = packed ? "text-[#86b9b0]" : item.packingStatus === "missing" ? "text-rose-200" : "text-amber-100/75";

  function assign(nextUserId: string) {
    onPatch({ assignedTo: nextUserId || undefined, packingStatus: nextUserId ? (packed ? "packed" : "assigned") : (packed ? "packed" : "needed") });
  }

  function changeStatus(nextStatus: GearPackingStatus) {
    onPatch({
      packingStatus: nextStatus,
      packedQuantity: nextStatus === "packed" ? item.quantity : 0,
    });
  }

  function saveDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const nextQuantity = Math.max(1, Math.min(100, Number(form.get("quantity") ?? item.quantity)));
    const rawWeight = String(form.get("unitWeightGrams") ?? "").trim();
    onPatch({
      quantity: nextQuantity,
      packedQuantity: packed ? nextQuantity : Math.min(item.packedQuantity, Math.max(0, nextQuantity - 1)),
      unitWeightGrams: rawWeight === "" ? undefined : Number(rawWeight),
      notes: String(form.get("notes") ?? ""),
      isCritical: form.get("isCritical") === "on",
    });
  }

  return <article className={`rounded-2xl border p-4 ${packed ? "border-[#86b9b0]/28 bg-[#86b9b0]/[0.055]" : item.packingStatus === "missing" ? "border-rose-300/18 bg-rose-300/[0.035]" : "border-white/[0.07] bg-[#041421]/35"}`}>
    <div className="flex items-start gap-3">
      <button disabled={!canEdit || saving} onClick={() => changeStatus(packed ? (item.assignedTo ? "assigned" : "needed") : "packed")} className={`grid size-10 shrink-0 place-items-center rounded-xl border ${packed ? "border-[#86b9b0]/28 bg-[#86b9b0]/14 text-[#86b9b0]" : "border-white/[0.08] text-[#d0d6d6]/28"}`} aria-label={packed ? `Mark ${item.name} unpacked` : `Mark ${item.name} packed`}>{saving ? <LoaderCircle className="size-4 animate-spin" /> : packed ? <CheckCircle2 className="size-4" /> : <PackageCheck className="size-4" />}</button>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h5 className="truncate text-xs font-semibold text-white">{item.name}</h5>{item.isCritical && <span className="rounded-full bg-amber-300/10 px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-amber-100/75">Critical</span>}<span className="rounded-full bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#86b9b0]/70">{item.scope}</span></div><p className={`mt-1 text-[9px] font-semibold ${statusTone}`}>{gearStatusLabels[item.packingStatus]} · {item.packedQuantity}/{item.quantity} packed</p></div>
      {canEdit && <button onClick={onRemove} disabled={saving} className="grid size-8 place-items-center rounded-lg border border-white/[0.06] text-[#d0d6d6]/28 hover:text-rose-300" aria-label={`Remove ${item.name}`}><Trash2 className="size-3.5" /></button>}
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2"><SmallMetric icon={item.scope === "shared" ? Users : UserRound} value={assignee?.name ?? "Unassigned"} /><SmallMetric icon={Scale} value={item.unitWeightGrams === undefined ? "Weight unknown" : kilograms(item.unitWeightGrams * item.quantity)} /></div>
    {item.notes && <p className="mt-3 rounded-xl bg-white/[0.025] p-3 text-[9px] leading-4 text-[#d0d6d6]/42">{item.notes}</p>}

    {canEdit && <div className="mt-3 grid gap-2 sm:grid-cols-2"><select disabled={saving} value={item.assignedTo ?? ""} onChange={(event) => assign(event.target.value)} className="gear-input"><option value="">Unassigned</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select><select disabled={saving} value={item.packingStatus} onChange={(event) => changeStatus(event.target.value as GearPackingStatus)} className="gear-input"><option value="needed">Needed</option><option value="assigned" disabled={!item.assignedTo}>Assigned</option><option value="packed">Packed</option><option value="missing">Missing</option></select></div>}

    {canEdit && <details className="mt-3 border-t border-white/[0.06] pt-3"><summary className="cursor-pointer text-[9px] font-semibold text-[#86b9b0]">Quantity, weight and notes</summary><form onSubmit={saveDetails} className="mt-3 grid gap-2 sm:grid-cols-2"><input name="quantity" type="number" min={1} max={100} defaultValue={item.quantity} className="gear-input" aria-label="Quantity" /><input name="unitWeightGrams" type="number" min={0} max={100000} defaultValue={item.unitWeightGrams} className="gear-input" placeholder="Unit weight in grams" /><textarea name="notes" defaultValue={item.notes} className="min-h-20 rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-[10px] text-white outline-none sm:col-span-2" placeholder="Sizes, brands, repair details or where it is stored" /><label className="flex items-center justify-between rounded-xl border border-white/[0.07] px-3 py-2 text-[10px] text-[#d0d6d6]/55 sm:col-span-2">Critical for departure<input name="isCritical" type="checkbox" defaultChecked={item.isCritical} className="size-4 accent-[#86b9b0]" /></label><button disabled={saving} className="h-9 rounded-xl bg-[#86b9b0] px-4 text-[10px] font-bold text-[#041421] disabled:opacity-45 sm:col-span-2">Save item details</button></form></details>}
  </article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55"><span className="mb-1 block">{label}</span>{children}</label>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold capitalize transition ${active ? "border-[#86b9b0]/28 bg-[#86b9b0]/10 text-[#86b9b0]" : "border-white/[0.07] text-[#d0d6d6]/34"}`}>{children}</button>;
}

function Metric({ label, value, note, warning = false }: { label: string; value: string; note: string; warning?: boolean }) {
  return <article className={`soft-panel rounded-2xl p-4 ${warning ? "border-amber-300/14" : ""}`}><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p>{warning && <AlertTriangle className="size-3.5 text-amber-200/65" />}</div><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/36">{note}</p></article>;
}

function SmallMetric({ icon: Icon, value }: { icon: typeof Scale; value: string }) {
  return <div className="rounded-xl bg-white/[0.025] p-2.5"><Icon className="size-3.5 text-[#86b9b0]" /><p className="mt-2 truncate text-[9px] text-[#d0d6d6]/50">{value}</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] p-8 text-center"><Backpack className="mx-auto size-5 text-[#86b9b0]/55" /><p className="mt-2 text-xs font-semibold text-white">{title}</p><p className="mx-auto mt-1 max-w-lg text-[10px] leading-5 text-[#d0d6d6]/38">{detail}</p></div>;
}
