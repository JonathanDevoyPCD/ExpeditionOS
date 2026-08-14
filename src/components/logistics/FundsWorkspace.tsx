"use client";

import {
  Banknote,
  Check,
  ChevronDown,
  CircleAlert,
  CircleDollarSign,
  LoaderCircle,
  Plus,
  ReceiptText,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadTripPeople, type TripMember } from "@/lib/cloudAdventures";
import {
  createAdventureFundItem,
  createAdventureFundItems,
  deleteAdventureFundItem,
  loadAdventureFunds,
  updateAdventureFundItem,
} from "@/lib/cloudFunds";
import { memberFundBalances } from "@/lib/funds.mjs";
import type { AdventurePlan } from "@/types/adventure";
import {
  FUND_CATEGORIES,
  fundCategoryLabels,
  fundStatusLabels,
  type AdventureFundDraft,
  type AdventureFundItem,
  type FundCategory,
  type FundCostStatus,
  type FundSplitMethod,
} from "@/types/funds";

type StatusFilter = "all" | FundCostStatus;

function formatMoney(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

function databaseMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Trip funds could not be loaded.";
  if (message.includes("adventure_fund_items") || message.includes("schema cache") || message.includes("42P01")) {
    return "The Phase B funds database migration still needs to be applied in Supabase.";
  }
  return message;
}

function starterBudget(adventure: AdventurePlan, memberIds: string[]): AdventureFundDraft[] {
  const riders = Math.max(1, memberIds.length);
  const days = Math.max(1, adventure.days);
  const nights = Math.max(0, days - 1);
  const accommodation = nights * riders * 450;
  const meals = days * riders * 260;
  const groceries = days * riders * 120;
  const repairs = Math.max(750, Math.round(adventure.route.metrics.distanceKm * 2));
  const subtotal = accommodation + meals + groceries + repairs;
  const shared = {
    costStatus: "estimate" as const,
    actualAmount: undefined,
    currency: "ZAR",
    participantIds: memberIds,
    splitMethod: "equal" as const,
    splitWeights: {},
  };
  return [
    { ...shared, name: "Overnight accommodation allowance", category: "accommodation", estimatedAmount: accommodation, templateKey: "starter-accommodation", notes: `Planning assumption: R450 per person for ${nights} night${nights === 1 ? "" : "s"}. Replace this with selected Stays prices.` },
    { ...shared, name: "Meals and café stops", category: "food", estimatedAmount: meals, templateKey: "starter-meals", notes: `Planning assumption: R260 per person per day for ${days} days.` },
    { ...shared, name: "Groceries and ride nutrition", category: "groceries", estimatedAmount: groceries, templateKey: "starter-groceries", notes: `Planning assumption: R120 per person per day for groceries and riding fuel.` },
    { ...shared, name: "Repairs and consumables allowance", category: "repairs", estimatedAmount: repairs, templateKey: "starter-repairs", notes: "Editable allowance for tubes, sealant, brake pads and unplanned workshop help." },
    { ...shared, name: "Emergency buffer", category: "emergency_buffer", estimatedAmount: Math.round(subtotal * 0.1), templateKey: "starter-emergency", notes: "10% contingency based on the starter assumptions. This is not a live-price quote." },
  ];
}

function itemDraft(item: AdventureFundItem): AdventureFundDraft {
  return {
    name: item.name,
    category: item.category,
    costStatus: item.costStatus,
    estimatedAmount: item.estimatedAmount,
    actualAmount: item.actualAmount,
    currency: item.currency,
    payerId: item.payerId,
    participantIds: item.participantIds,
    splitMethod: item.splitMethod,
    splitWeights: item.splitWeights,
    stageDay: item.stageDay,
    occurredOn: item.occurredOn,
    bookingReference: item.bookingReference,
    templateKey: item.templateKey,
    notes: item.notes,
  };
}

export default function FundsWorkspace({ adventure, userId, canEdit }: { adventure?: AdventurePlan; userId: string; canEdit: boolean }) {
  const [items, setItems] = useState<AdventureFundItem[]>([]);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [loading, setLoading] = useState(Boolean(adventure));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | FundCategory>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [category, setCategory] = useState<FundCategory>("food");
  const [estimated, setEstimated] = useState("");
  const [actual, setActual] = useState("");
  const [costStatus, setCostStatus] = useState<FundCostStatus>("estimate");
  const [payerId, setPayerId] = useState("");
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [splitMethod, setSplitMethod] = useState<FundSplitMethod>("equal");
  const [splitPercentages, setSplitPercentages] = useState<Record<string, string>>({});
  const [stageDay, setStageDay] = useState("");
  const [bookingReference, setBookingReference] = useState("");
  const [notes, setNotes] = useState("");

  const isPublicGuest = Boolean(adventure?.access && !adventure.access.isMember);

  useEffect(() => {
    let active = true;
    if (!adventure || (adventure.access && !adventure.access.isMember)) {
      queueMicrotask(() => {
        if (active) {
          setItems([]);
          setMembers([]);
          setParticipantIds([]);
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
    Promise.all([loadAdventureFunds(adventure.id), loadTripPeople(adventure.id)])
      .then(([funds, people]) => {
        if (!active) return;
        setItems(funds);
        setMembers(people.members);
        setParticipantIds(people.members.map((member) => member.userId));
        setSplitPercentages(equalPercentages(people.members.map((member) => member.userId)));
      })
      .catch((reason) => { if (active) setError(databaseMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure]);

  const filteredItems = useMemo(() => items.filter((item) => (
    (statusFilter === "all" || item.costStatus === statusFilter)
    && (categoryFilter === "all" || item.category === categoryFilter)
  )), [categoryFilter, items, statusFilter]);

  const estimatedTotal = items.reduce((sum, item) => sum + item.estimatedAmount, 0);
  const actualItems = items.filter((item) => item.actualAmount !== undefined);
  const actualTotal = actualItems.reduce((sum, item) => sum + (item.actualAmount ?? 0), 0);
  const paidTotal = items.filter((item) => item.costStatus === "paid").reduce((sum, item) => sum + (item.actualAmount ?? 0), 0);
  const variance = actualItems.reduce((sum, item) => sum + (item.actualAmount ?? 0) - item.estimatedAmount, 0);
  const perPerson = estimatedTotal / Math.max(1, members.length);
  const balances = useMemo(() => memberFundBalances(items, members), [items, members]);

  function resetForm() {
    setName("");
    setEstimated("");
    setActual("");
    setCostStatus("estimate");
    setPayerId("");
    const allMembers = members.map((member) => member.userId);
    setParticipantIds(allMembers);
    setSplitMethod("equal");
    setSplitPercentages(equalPercentages(allMembers));
    setStageDay("");
    setBookingReference("");
    setNotes("");
  }

  async function addManualItem() {
    if (!adventure) return;
    const estimatedAmount = Number(estimated);
    const actualAmount = actual.trim() === "" ? undefined : Number(actual);
    const stage = stageDay.trim() === "" ? undefined : Number(stageDay);
    const splitWeights = customWeights(participantIds, splitMethod, splitPercentages);
    if (!name.trim() || !Number.isFinite(estimatedAmount) || estimatedAmount < 0 || (actualAmount !== undefined && (!Number.isFinite(actualAmount) || actualAmount < 0))) {
      setError("Enter a name and valid non-negative estimated and actual amounts.");
      return;
    }
    if (!participantIds.length) {
      setError("Select at least one trip participant for this cost.");
      return;
    }
    if (costStatus !== "estimate" && actualAmount === undefined) {
      setError("Confirmed and paid costs need an actual amount.");
      return;
    }
    if (costStatus === "paid" && !payerId) {
      setError("Select who paid before marking a cost as paid.");
      return;
    }
    if (splitMethod === "custom" && !splitWeights) {
      setError("Custom participant percentages must be positive and add up to 100%.");
      return;
    }
    if (stage !== undefined && (!Number.isInteger(stage) || stage < 1 || stage > adventure.days)) {
      setError(`Stage day must be between 1 and ${adventure.days}.`);
      return;
    }
    setSavingId("new");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureFundItem(adventure.id, userId, {
        name,
        category,
        costStatus,
        estimatedAmount,
        actualAmount,
        currency: "ZAR",
        payerId: payerId || undefined,
        participantIds,
        splitMethod,
        splitWeights: splitWeights ?? {},
        stageDay: stage,
        bookingReference,
        notes,
      });
      setItems((current) => [...current, created]);
      setNotice(`${created.name} added to the trip budget.`);
      resetForm();
      setFormOpen(false);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function applyStarterBudget() {
    if (!adventure || !members.length) return;
    const existingKeys = new Set(items.map((item) => item.templateKey).filter(Boolean));
    const missing = starterBudget(adventure, members.map((member) => member.userId)).filter((item) => !existingKeys.has(item.templateKey));
    if (!missing.length) {
      setNotice("The starter budget assumptions are already included.");
      return;
    }
    setSavingId("template");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureFundItems(adventure.id, userId, missing);
      setItems((current) => [...current, ...created]);
      setNotice(`${created.length} editable planning assumptions added. Review them against current local prices.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function patchItem(item: AdventureFundItem, patch: Partial<AdventureFundDraft>) {
    if (!adventure) return;
    const draft = { ...itemDraft(item), ...patch };
    if (draft.costStatus !== "estimate" && draft.actualAmount === undefined) draft.actualAmount = draft.estimatedAmount;
    if (draft.costStatus === "paid" && !draft.payerId) draft.payerId = members.find((member) => member.userId === userId)?.userId ?? members[0]?.userId;
    setSavingId(item.id);
    setError(null);
    try {
      const updated = await updateAdventureFundItem(item.id, adventure.id, draft);
      setItems((current) => current.map((candidate) => candidate.id === updated.id ? updated : candidate));
      setNotice(`${updated.name} updated.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function removeItem(item: AdventureFundItem) {
    if (!adventure) return;
    setSavingId(item.id);
    setError(null);
    try {
      await deleteAdventureFundItem(item.id, adventure.id);
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`${item.name} removed.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  function toggleParticipant(memberId: string) {
    const next = participantIds.includes(memberId) ? participantIds.filter((id) => id !== memberId) : [...participantIds, memberId];
    setParticipantIds(next);
    setSplitPercentages(equalPercentages(next));
  }

  if (!adventure) return <EmptyState title="Choose a saved route" detail="Funds belongs to a trip so estimates, costs and balances stay connected to the right people." />;
  if (isPublicGuest) return <EmptyState title="Funds is private to trip members" detail="Public visitors can view the route, but budgets, booking references and member balances require an accepted invitation." />;

  return (
    <div className="mt-7 space-y-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Estimated trip" value={formatMoney(estimatedTotal)} note={`${items.length} budget lines`} />
        <Metric label="Actual recorded" value={formatMoney(actualTotal)} note={`${actualItems.length} confirmed lines`} />
        <Metric label="Paid so far" value={formatMoney(paidTotal)} note="Vendor costs marked paid" />
        <Metric label="Per person estimate" value={formatMoney(perPerson)} note={`${Math.max(1, members.length)} trip members`} />
        <Metric label="Variance" value={`${variance > 0 ? "+" : ""}${formatMoney(variance)}`} note={variance > 0 ? "Above estimates" : variance < 0 ? "Below estimates" : "On current estimates"} warning={variance > 0} />
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="mr-auto"><div className="flex items-center gap-2"><WalletCards className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Shared trip budget</h3></div><p className="mt-1 text-[10px] text-[#d0d6d6]/40">Track planning assumptions, confirmed costs and who covered paid expenses. ExpeditionOS does not hold or transfer money.</p></div>
          {canEdit && <button onClick={() => void applyStarterBudget()} disabled={savingId !== null || !members.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 px-4 text-xs font-semibold text-[#86b9b0] disabled:opacity-40">{savingId === "template" ? <LoaderCircle className="size-4 animate-spin" /> : <Banknote className="size-4" />} Create starter estimate</button>}
          {canEdit && <button onClick={() => setFormOpen((open) => !open)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]"><Plus className="size-4" /> Add cost</button>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(["all", "estimate", "confirmed", "paid"] as StatusFilter[]).map((value) => <FilterButton key={value} active={statusFilter === value} onClick={() => setStatusFilter(value)}>{value === "all" ? "All status" : fundStatusLabels[value]}</FilterButton>)}
          <label className="relative ml-auto"><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value as "all" | FundCategory)} className="fund-input appearance-none pr-8"><option value="all">All categories</option>{FUND_CATEGORIES.map((value) => <option key={value} value={value}>{fundCategoryLabels[value]}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-3.5 text-[#86b9b0]" /></label>
        </div>

        {formOpen && <div className="mt-4 rounded-2xl border border-[#86b9b0]/15 bg-[#041421]/35 p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Cost name"><input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Night 1 backpackers" className="fund-input w-full" /></Field>
            <Field label="Category"><select value={category} onChange={(event) => setCategory(event.target.value as FundCategory)} className="fund-input w-full">{FUND_CATEGORIES.map((value) => <option key={value} value={value}>{fundCategoryLabels[value]}</option>)}</select></Field>
            <Field label="Estimated amount (ZAR)"><input type="number" min={0} step="0.01" value={estimated} onChange={(event) => setEstimated(event.target.value)} className="fund-input w-full" /></Field>
            <Field label="Actual amount (optional)"><input type="number" min={0} step="0.01" value={actual} onChange={(event) => setActual(event.target.value)} className="fund-input w-full" /></Field>
            <Field label="Cost status"><select value={costStatus} onChange={(event) => setCostStatus(event.target.value as FundCostStatus)} className="fund-input w-full"><option value="estimate">Estimated</option><option value="confirmed">Confirmed cost</option><option value="paid">Paid</option></select></Field>
            <Field label="Paid by"><select value={payerId} onChange={(event) => setPayerId(event.target.value)} className="fund-input w-full"><option value="">Not paid yet</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></Field>
            <Field label="Stage day"><input type="number" min={1} max={adventure.days} value={stageDay} onChange={(event) => setStageDay(event.target.value)} placeholder={`1-${adventure.days}`} className="fund-input w-full" /></Field>
            <Field label="Booking or receipt reference"><input value={bookingReference} onChange={(event) => setBookingReference(event.target.value)} className="fund-input w-full" /></Field>
          </div>
          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_220px]">
            <div><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">Participants</p><div className="mt-2 flex flex-wrap gap-2">{members.map((member) => <label key={member.userId} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[9px] ${participantIds.includes(member.userId) ? "border-[#86b9b0]/28 bg-[#86b9b0]/10 text-[#86b9b0]" : "border-white/[0.07] text-[#d0d6d6]/38"}`}><input type="checkbox" checked={participantIds.includes(member.userId)} onChange={() => toggleParticipant(member.userId)} className="size-3 accent-[#86b9b0]" />{member.name}</label>)}</div></div>
            <Field label="Split method"><select value={splitMethod} onChange={(event) => { const next = event.target.value as FundSplitMethod; setSplitMethod(next); if (next === "custom") setSplitPercentages(equalPercentages(participantIds)); }} className="fund-input w-full"><option value="equal">Equal split</option><option value="custom">Custom percentages</option></select></Field>
          </div>
          {splitMethod === "custom" && <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{participantIds.map((memberId) => <Field key={memberId} label={`${members.find((member) => member.userId === memberId)?.name ?? "Member"} share %`}><input type="number" min={0.01} max={100} step="0.01" value={splitPercentages[memberId] ?? ""} onChange={(event) => setSplitPercentages((current) => ({ ...current, [memberId]: event.target.value }))} className="fund-input w-full" /></Field>)}</div>}
          <Field label="Private notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-[10px] text-white outline-none" placeholder="Price assumptions, what is included, receipt details or payment notes" /></Field>
          <div className="mt-3 flex gap-2"><button onClick={() => void addManualItem()} disabled={savingId === "new"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421] disabled:opacity-45">{savingId === "new" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save cost</button><button onClick={() => setFormOpen(false)} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs text-[#d0d6d6]/55">Cancel</button></div>
        </div>}

        {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[10px] text-amber-100/70"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{error}</div>}
        {notice && <div className="mt-4 rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-3 text-[10px] text-[#86b9b0]">{notice}</div>}

        {loading ? <div className="grid min-h-52 place-items-center"><LoaderCircle className="size-6 animate-spin text-[#86b9b0]" /></div> : <div className="mt-5 grid gap-3 xl:grid-cols-2">{filteredItems.map((item) => <FundCard key={item.id} item={item} members={members} canEdit={canEdit} saving={savingId === item.id} onPatch={(patch) => void patchItem(item, patch)} onRemove={() => void removeItem(item)} />)}{!filteredItems.length && <EmptyState title="No costs match these filters" detail={items.length ? "Adjust the filters to see the rest of the budget." : "Create editable starter assumptions or add the first trip-specific cost."} />}</div>}
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex items-center gap-2"><Users className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Member balances</h3></div>
        <p className="mt-1 text-[10px] text-[#d0d6d6]/40">Balances use only costs marked paid. Positive amounts should be received; negative amounts are owed.</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{balances.map((balance) => <article key={balance.userId} className="rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-full bg-[#86b9b0]/10 text-[#86b9b0]"><UserRound className="size-4" /></span><p className="truncate text-xs font-semibold text-white">{balance.name}</p></div><div className="mt-3 flex items-center gap-2">{balance.amount > 0 ? <TrendingUp className="size-4 text-[#86b9b0]" /> : balance.amount < 0 ? <TrendingDown className="size-4 text-amber-200/70" /> : <CircleDollarSign className="size-4 text-[#d0d6d6]/35" />}<p className={`text-lg font-semibold ${balance.amount > 0 ? "text-[#86b9b0]" : balance.amount < 0 ? "text-amber-100/80" : "text-white"}`}>{formatMoney(Math.abs(balance.amount))}</p></div><p className="mt-1 text-[9px] text-[#d0d6d6]/38">{balance.amount > 0 ? "Should receive" : balance.amount < 0 ? "Owes the group" : "Settled on paid costs"}</p></article>)}</div>
      </section>
    </div>
  );
}

function FundCard({ item, members, canEdit, saving, onPatch, onRemove }: { item: AdventureFundItem; members: TripMember[]; canEdit: boolean; saving: boolean; onPatch: (patch: Partial<AdventureFundDraft>) => void; onRemove: () => void }) {
  const payer = members.find((member) => member.userId === item.payerId);
  const amount = item.actualAmount ?? item.estimatedAmount;
  return <article className={`rounded-2xl border p-4 ${item.costStatus === "paid" ? "border-[#86b9b0]/24 bg-[#86b9b0]/[0.05]" : "border-white/[0.07] bg-[#041421]/35"}`}>
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]">{item.costStatus === "paid" ? <ReceiptText className="size-4" /> : <Banknote className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-xs font-semibold text-white">{item.name}</h4><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#86b9b0]/70">{fundCategoryLabels[item.category]}</span></div><p className="mt-1 text-[9px] text-[#d0d6d6]/40">{fundStatusLabels[item.costStatus]} · {item.splitMethod === "equal" ? "Equal split" : "Custom split"}{item.stageDay ? ` · Day ${item.stageDay}` : ""}</p></div>{canEdit && <button onClick={onRemove} disabled={saving} className="grid size-8 place-items-center rounded-lg border border-white/[0.06] text-[#d0d6d6]/28 hover:text-rose-300" aria-label={`Remove ${item.name}`}><Trash2 className="size-3.5" /></button>}</div>
    <div className="mt-4 grid grid-cols-2 gap-2"><SmallMetric label="Budget" value={formatMoney(item.estimatedAmount, item.currency)} /><SmallMetric label={item.actualAmount === undefined ? "Current amount" : "Actual"} value={formatMoney(amount, item.currency)} /></div>
    <div className="mt-2 grid grid-cols-2 gap-2"><SmallMetric label="Paid by" value={payer?.name ?? "Not paid"} /><SmallMetric label="Participants" value={`${item.participantIds.length} member${item.participantIds.length === 1 ? "" : "s"}`} /></div>
    {item.bookingReference && <p className="mt-3 text-[9px] text-[#d0d6d6]/42">Reference: <span className="text-[#86b9b0]">{item.bookingReference}</span></p>}
    {item.notes && <p className="mt-3 rounded-xl bg-white/[0.025] p-3 text-[9px] leading-4 text-[#d0d6d6]/42">{item.notes}</p>}
    {canEdit && <div className="mt-3 grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2"><select disabled={saving} value={item.costStatus} onChange={(event) => onPatch({ costStatus: event.target.value as FundCostStatus })} className="fund-input"><option value="estimate">Estimated</option><option value="confirmed">Confirmed cost</option><option value="paid">Paid</option></select><select disabled={saving} value={item.payerId ?? ""} onChange={(event) => onPatch({ payerId: event.target.value || undefined })} className="fund-input"><option value="">No payer yet</option>{members.map((member) => <option key={member.userId} value={member.userId}>{member.name}</option>)}</select></div>}
    {canEdit && <FundDetails item={item} members={members} saving={saving} onPatch={onPatch} />}
  </article>;
}

function FundDetails({ item, members, saving, onPatch }: { item: AdventureFundItem; members: TripMember[]; saving: boolean; onPatch: (patch: Partial<AdventureFundDraft>) => void }) {
  const [selected, setSelected] = useState(item.participantIds);
  const [method, setMethod] = useState(item.splitMethod);
  const [percentages, setPercentages] = useState<Record<string, string>>(() => item.splitMethod === "custom" ? Object.fromEntries(item.participantIds.map((id) => [id, String(item.splitWeights[id] ?? "")])) : equalPercentages(item.participantIds));
  const [localError, setLocalError] = useState<string | null>(null);

  function toggle(memberId: string) {
    const next = selected.includes(memberId) ? selected.filter((id) => id !== memberId) : [...selected, memberId];
    setSelected(next);
    setPercentages(equalPercentages(next));
  }

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const estimatedAmount = Number(form.get("estimatedAmount"));
    const actualText = String(form.get("actualAmount") ?? "").trim();
    const actualAmount = actualText === "" ? undefined : Number(actualText);
    const weights = customWeights(selected, method, percentages);
    if (!selected.length) return setLocalError("Select at least one participant.");
    if (!Number.isFinite(estimatedAmount) || estimatedAmount < 0 || (actualAmount !== undefined && (!Number.isFinite(actualAmount) || actualAmount < 0))) return setLocalError("Enter valid non-negative amounts.");
    if (item.costStatus !== "estimate" && actualAmount === undefined) return setLocalError("Confirmed and paid costs need an actual amount.");
    if (method === "custom" && !weights) return setLocalError("Custom percentages must be positive and add up to 100%.");
    setLocalError(null);
    onPatch({
      estimatedAmount,
      actualAmount,
      participantIds: selected,
      splitMethod: method,
      splitWeights: weights ?? {},
      stageDay: optionalFormNumber(form.get("stageDay")),
      occurredOn: String(form.get("occurredOn") ?? "") || undefined,
      bookingReference: String(form.get("bookingReference") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }

  return <details className="mt-3 border-t border-white/[0.06] pt-3"><summary className="cursor-pointer text-[9px] font-semibold text-[#86b9b0]">Amounts, split and private details</summary><form onSubmit={save} className="mt-3 space-y-3"><div className="grid gap-2 sm:grid-cols-2"><input name="estimatedAmount" type="number" min={0} step="0.01" defaultValue={item.estimatedAmount} className="fund-input" aria-label="Estimated amount" /><input name="actualAmount" type="number" min={0} step="0.01" defaultValue={item.actualAmount} className="fund-input" placeholder="Actual amount" /><input name="stageDay" type="number" min={1} max={365} defaultValue={item.stageDay} className="fund-input" placeholder="Stage day" /><input name="occurredOn" type="date" defaultValue={item.occurredOn} className="fund-input" /><input name="bookingReference" defaultValue={item.bookingReference} className="fund-input sm:col-span-2" placeholder="Booking or receipt reference" /></div><div><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">Participants</p><div className="mt-2 flex flex-wrap gap-2">{members.map((member) => <label key={member.userId} className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-[9px] ${selected.includes(member.userId) ? "border-[#86b9b0]/28 bg-[#86b9b0]/10 text-[#86b9b0]" : "border-white/[0.07] text-[#d0d6d6]/38"}`}><input type="checkbox" checked={selected.includes(member.userId)} onChange={() => toggle(member.userId)} className="size-3 accent-[#86b9b0]" />{member.name}</label>)}</div></div><select value={method} onChange={(event) => { const next = event.target.value as FundSplitMethod; setMethod(next); if (next === "custom") setPercentages(equalPercentages(selected)); }} className="fund-input w-full"><option value="equal">Equal split</option><option value="custom">Custom percentages</option></select>{method === "custom" && <div className="grid gap-2 sm:grid-cols-2">{selected.map((memberId) => <Field key={memberId} label={`${members.find((member) => member.userId === memberId)?.name ?? "Member"} share %`}><input type="number" min={0.01} max={100} step="0.01" value={percentages[memberId] ?? ""} onChange={(event) => setPercentages((current) => ({ ...current, [memberId]: event.target.value }))} className="fund-input w-full" /></Field>)}</div>}<textarea name="notes" defaultValue={item.notes} className="min-h-20 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-[10px] text-white outline-none" placeholder="Private cost notes" />{localError && <p className="text-[9px] text-amber-100/75">{localError}</p>}<button disabled={saving} className="h-9 w-full rounded-xl bg-[#86b9b0] px-4 text-[10px] font-bold text-[#041421] disabled:opacity-45">Save cost details</button></form></details>;
}

function equalPercentages(participantIds: string[]) {
  if (!participantIds.length) return {};
  const percentage = 100 / participantIds.length;
  return Object.fromEntries(participantIds.map((id) => [id, String(Math.round(percentage * 100) / 100)]));
}

function customWeights(participantIds: string[], method: FundSplitMethod, percentages: Record<string, string>) {
  if (method === "equal") return {};
  const weights = Object.fromEntries(participantIds.map((id) => [id, Number(percentages[id])]));
  const values = Object.values(weights);
  const total = values.reduce((sum, value) => sum + value, 0);
  return values.every((value) => Number.isFinite(value) && value > 0) && Math.abs(total - 100) <= 0.1 ? weights : null;
}

function optionalFormNumber(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const number = Number(text);
  return Number.isFinite(number) ? number : undefined;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55"><span className="mb-1 block">{label}</span>{children}</label>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold transition ${active ? "border-[#86b9b0]/28 bg-[#86b9b0]/10 text-[#86b9b0]" : "border-white/[0.07] text-[#d0d6d6]/34"}`}>{children}</button>;
}

function Metric({ label, value, note, warning = false }: { label: string; value: string; note: string; warning?: boolean }) {
  return <article className={`soft-panel rounded-2xl p-4 ${warning ? "border-amber-300/14" : ""}`}><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p><p className={`mt-2 text-xl font-semibold ${warning ? "text-amber-100/85" : "text-white"}`}>{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/36">{note}</p></article>;
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[8px] font-bold uppercase tracking-wider text-[#86b9b0]/45">{label}</p><p className="mt-1 truncate text-[10px] font-semibold text-white">{value}</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] p-8 text-center"><WalletCards className="mx-auto size-5 text-[#86b9b0]/55" /><p className="mt-2 text-xs font-semibold text-white">{title}</p><p className="mx-auto mt-1 max-w-lg text-[10px] leading-5 text-[#d0d6d6]/38">{detail}</p></div>;
}
