"use client";

import {
  BedDouble,
  CalendarDays,
  Check,
  ChevronDown,
  CircleAlert,
  ExternalLink,
  Link2,
  LoaderCircle,
  MapPin,
  Plus,
  Search,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createAdventureStay, deleteAdventureStay, loadAdventureStays, updateAdventureStay } from "@/lib/cloudStays";
import type { AdventurePlan } from "@/types/adventure";
import type { RoutePoi } from "@/types/poi";
import {
  ACCOMMODATION_TYPES,
  accommodationTypeLabels,
  type AccommodationType,
  type AdventureStay,
  type AdventureStayDraft,
  type ReservationStatus,
  type StayPlacement,
} from "@/types/stay";

type StaySort = "total" | "per_person" | "distance" | "rating";

const placementLabels: Record<StayPlacement, string> = {
  candidate: "Candidate",
  selected: "Selected",
  backup: "Backup",
};

const reservationLabels: Record<ReservationStatus, string> = {
  researching: "Researching",
  contacted: "Contacted",
  reserved: "Reserved",
  paid: "Paid",
  confirmed: "Confirmed",
};

function dateAfter(start: string | undefined, days: number) {
  if (!start) return "";
  const value = new Date(`${start}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string) {
  if (!checkIn || !checkOut) return 1;
  return Math.max(1, Math.round((Date.parse(`${checkOut}T12:00:00Z`) - Date.parse(`${checkIn}T12:00:00Z`)) / 86_400_000));
}

function money(value: number | undefined, currency = "ZAR") {
  if (value === undefined) return "Price needed";
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function stayDraft(stay: AdventureStay): AdventureStayDraft {
  const draft: Partial<AdventureStay> = { ...stay };
  delete draft.id;
  delete draft.adventureId;
  delete draft.createdBy;
  delete draft.createdAt;
  delete draft.updatedAt;
  return draft as AdventureStayDraft;
}

function bookingSearchUrl(destination: string, checkIn: string, checkOut: string, adults: number, rooms: number) {
  const query = new URLSearchParams({ ss: destination, group_adults: String(adults), no_rooms: String(rooms) });
  if (checkIn) query.set("checkin", checkIn);
  if (checkOut) query.set("checkout", checkOut);
  return `https://www.booking.com/searchresults.html?${query}`;
}

function googleSearchUrl(destination: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(`accommodation near ${destination}`)}`;
}

function safeExternalUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function databaseMessage(reason: unknown) {
  const message = reason instanceof Error ? reason.message : "Stays could not be loaded.";
  if (message.includes("adventure_stays") || message.includes("schema cache") || message.includes("42P01")) {
    return "The Phase B stays database migration still needs to be applied in Supabase.";
  }
  return message;
}

export default function StaysWorkspace({
  adventure,
  pois,
  userId,
  canEdit,
}: {
  adventure?: AdventurePlan;
  pois: RoutePoi[];
  userId: string;
  canEdit: boolean;
}) {
  const overnightAnchors = useMemo(() => (adventure?.anchors ?? []).filter((anchor) => anchor.kind === "overnight").sort((left, right) => (left.day ?? 0) - (right.day ?? 0)), [adventure]);
  const defaultDestination = overnightAnchors[0]?.name ?? adventure?.route.name ?? "Eastern Cape";
  const [stays, setStays] = useState<AdventureStay[]>([]);
  const [loading, setLoading] = useState(Boolean(adventure));
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [destination, setDestination] = useState(defaultDestination);
  const [checkIn, setCheckIn] = useState(dateAfter(adventure?.startsOn, 1));
  const [checkOut, setCheckOut] = useState(dateAfter(adventure?.startsOn, 2));
  const [adults, setAdults] = useState(1);
  const [rooms, setRooms] = useState(1);
  const [stageDay, setStageDay] = useState(1);
  const [selectedTypes, setSelectedTypes] = useState<AccommodationType[]>(["backpackers", "guest_house", "bed_and_breakfast", "self_catering", "camping"]);
  const [sort, setSort] = useState<StaySort>("total");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [manualType, setManualType] = useState<AccommodationType>("backpackers");
  const [manualNightly, setManualNightly] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [manualUrl, setManualUrl] = useState("");

  useEffect(() => {
    let active = true;
    if (!adventure) {
      queueMicrotask(() => {
        if (active) {
          setStays([]);
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
    loadAdventureStays(adventure.id)
      .then((items) => { if (active) setStays(items); })
      .catch((reason) => { if (active) setError(databaseMessage(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure]);

  const lodging = useMemo(() => pois.filter((poi) => poi.category === "lodging"), [pois]);
  const filteredStays = useMemo(() => [...stays]
    .filter((stay) => selectedTypes.includes(stay.accommodationType) || stay.accommodationType === "other" || stay.placement !== "candidate")
    .sort((left, right) => {
      if (sort === "per_person") return (left.totalPrice ?? Number.MAX_VALUE) / left.adults - (right.totalPrice ?? Number.MAX_VALUE) / right.adults;
      if (sort === "distance") return (left.distanceFromRouteKm ?? Number.MAX_VALUE) - (right.distanceFromRouteKm ?? Number.MAX_VALUE);
      if (sort === "rating") return (right.rating ?? -1) - (left.rating ?? -1);
      return (left.totalPrice ?? Number.MAX_VALUE) - (right.totalPrice ?? Number.MAX_VALUE);
    }), [selectedTypes, sort, stays]);
  const selectedStays = stays.filter((stay) => stay.placement === "selected");
  const selectedTotal = selectedStays.reduce((sum, stay) => sum + (stay.totalPrice ?? 0), 0);
  const providerUrl = bookingSearchUrl(destination, checkIn, checkOut, adults, rooms);

  async function addStay(draft: AdventureStayDraft) {
    if (!adventure) return false;
    setSavingId("new");
    setError(null);
    setNotice(null);
    try {
      const created = await createAdventureStay(adventure.id, userId, draft);
      setStays((current) => [...current, created]);
      setNotice(`${created.name} added as a stay candidate.`);
      return true;
    } catch (reason) {
      setError(databaseMessage(reason));
      return false;
    } finally {
      setSavingId(null);
    }
  }

  async function addMappedPlace(place: RoutePoi) {
    await addStay({
      name: place.name,
      accommodationType: "other",
      placement: "candidate",
      reservationStatus: "researching",
      stageDay,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      adults,
      rooms,
      currency: "ZAR",
      rating: place.classificationStars,
      distanceFromRouteKm: place.distanceFromRouteKm,
      address: place.address,
      lat: place.lat,
      lon: place.lon,
      contactPhone: place.phone,
      source: "openstreetmap",
      sourceReference: place.id,
      sourceUrl: safeExternalUrl(place.bookingSearchUrl ?? place.website),
    });
  }

  async function addManualStay() {
    const nightlyPrice = manualNightly === "" ? undefined : Number(manualNightly);
    const totalPrice = manualTotal === "" ? (nightlyPrice === undefined ? undefined : nightlyPrice * nightsBetween(checkIn, checkOut)) : Number(manualTotal);
    const sourceUrl = safeExternalUrl(manualUrl);
    if (!manualName.trim() || (nightlyPrice !== undefined && !Number.isFinite(nightlyPrice)) || (totalPrice !== undefined && !Number.isFinite(totalPrice))) {
      setError("Enter a stay name and valid price values.");
      return;
    }
    if (manualUrl && !sourceUrl) {
      setError("Booking links must use a valid http or https address.");
      return;
    }
    const saved = await addStay({
      name: manualName,
      accommodationType: manualType,
      placement: "candidate",
      reservationStatus: "researching",
      stageDay,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      adults,
      rooms,
      currency: "ZAR",
      nightlyPrice,
      totalPrice,
      address: manualAddress,
      source: "manual",
      sourceUrl,
    });
    if (!saved) return;
    setManualName("");
    setManualAddress("");
    setManualNightly("");
    setManualTotal("");
    setManualUrl("");
    setManualOpen(false);
  }

  async function patchStay(stay: AdventureStay, patch: Partial<AdventureStayDraft>) {
    if (!adventure) return;
    setSavingId(stay.id);
    setError(null);
    try {
      const updated = await updateAdventureStay(stay.id, adventure.id, { ...stayDraft(stay), ...patch });
      setStays((current) => current.map((item) => item.id === updated.id ? updated : item));
      setNotice(`${updated.name} updated.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  async function removeStay(stay: AdventureStay) {
    if (!adventure) return;
    setSavingId(stay.id);
    setError(null);
    try {
      await deleteAdventureStay(stay.id, adventure.id);
      setStays((current) => current.filter((item) => item.id !== stay.id));
      setNotice(`${stay.name} removed.`);
    } catch (reason) {
      setError(databaseMessage(reason));
    } finally {
      setSavingId(null);
    }
  }

  if (!adventure) {
    return <EmptyState title="Choose a saved route" detail="Stays belong to a trip so dates, stage ends, permissions and costs stay connected." />;
  }

  return (
    <div className="mt-7 space-y-4">
      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end">
          <div className="mr-auto"><div className="flex items-center gap-2"><Search className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Find the right overnight</h3></div><p className="mt-1 text-[10px] text-[#d0d6d6]/40">Compare saved candidates here, then use provider searches for current availability and prices.</p></div>
          <Field label="Destination or stage area"><input value={destination} onChange={(event) => setDestination(event.target.value)} className="stay-input min-w-[210px]" /></Field>
          <Field label="Check in"><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className="stay-input [color-scheme:dark]" /></Field>
          <Field label="Check out"><input type="date" min={checkIn} value={checkOut} onChange={(event) => setCheckOut(event.target.value)} className="stay-input [color-scheme:dark]" /></Field>
          <Field label="Adults"><input type="number" min={1} max={50} value={adults} onChange={(event) => setAdults(Math.max(1, Number(event.target.value)))} className="stay-input w-20" /></Field>
          <Field label="Rooms"><input type="number" min={1} max={25} value={rooms} onChange={(event) => setRooms(Math.max(1, Number(event.target.value)))} className="stay-input w-20" /></Field>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a href={providerUrl} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421]">Search current prices <ExternalLink className="size-3.5" /></a>
          <a href={googleSearchUrl(destination)} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] px-4 text-xs font-semibold text-[#d0d6d6]/65">Explore on Google Maps <MapPin className="size-3.5 text-[#86b9b0]" /></a>
          <span className="text-[9px] leading-4 text-[#d0d6d6]/32">Provider pages supply the live price and availability. ExpeditionOS does not claim those values until a licensed inventory API is connected.</span>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Nights required" value={String(Math.max(0, adventure.days - 1))} note={`${overnightAnchors.length} stage end${overnightAnchors.length === 1 ? "" : "s"} mapped`} />
        <Metric label="Saved candidates" value={String(stays.length)} note={`${selectedStays.length} selected`} />
        <Metric label="Selected stays" value={money(selectedTotal || undefined)} note={selectedTotal ? `${money(selectedTotal / Math.max(1, adults))} per person` : "Add price notes to estimate"} />
        <Metric label="Reservations" value={`${stays.filter((stay) => ["reserved", "paid", "confirmed"].includes(stay.reservationStatus)).length}/${Math.max(0, adventure.days - 1)}`} note="Reserved, paid or confirmed" />
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="mr-auto"><h3 className="text-sm font-semibold text-white">Stay shortlist</h3><p className="mt-1 text-[10px] text-[#d0d6d6]/38">Private to accepted trip members. Viewers can review but cannot change stays.</p></div>
          <label className="relative"><select value={stageDay} onChange={(event) => setStageDay(Number(event.target.value))} className="stay-input appearance-none pr-8">{Array.from({ length: Math.max(1, adventure.days - 1) }, (_, index) => <option key={index + 1} value={index + 1}>Night {index + 1}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-3.5 text-[#86b9b0]" /></label>
          <label className="relative"><select value={sort} onChange={(event) => setSort(event.target.value as StaySort)} className="stay-input appearance-none pr-8"><option value="total">Cheapest total</option><option value="per_person">Cheapest per person</option><option value="distance">Closest to route</option><option value="rating">Highest rating</option></select><ChevronDown className="pointer-events-none absolute right-2.5 top-3 size-3.5 text-[#86b9b0]" /></label>
          {canEdit && <button onClick={() => setManualOpen((open) => !open)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 px-4 text-xs font-semibold text-[#86b9b0]"><Plus className="size-4" /> Add manually</button>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {ACCOMMODATION_TYPES.filter((type) => type !== "other").map((type) => {
            const active = selectedTypes.includes(type);
            return <button key={type} onClick={() => setSelectedTypes((current) => active ? current.filter((item) => item !== type) : [...current, type])} className={`rounded-full border px-3 py-1.5 text-[9px] font-semibold transition ${active ? "border-[#86b9b0]/28 bg-[#86b9b0]/10 text-[#86b9b0]" : "border-white/[0.07] text-[#d0d6d6]/32"}`}>{accommodationTypeLabels[type]}</button>;
          })}
        </div>

        {manualOpen && <div className="mt-4 grid gap-3 rounded-2xl border border-[#86b9b0]/15 bg-[#041421]/35 p-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Stay name"><input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="e.g. Storms River Backpackers" className="stay-input w-full" /></Field><Field label="Type"><select value={manualType} onChange={(event) => setManualType(event.target.value as AccommodationType)} className="stay-input w-full">{ACCOMMODATION_TYPES.map((type) => <option key={type} value={type}>{accommodationTypeLabels[type]}</option>)}</select></Field><Field label="Nightly price (R)"><input type="number" min={0} value={manualNightly} onChange={(event) => setManualNightly(event.target.value)} className="stay-input w-full" /></Field><Field label="Total price (R)"><input type="number" min={0} value={manualTotal} onChange={(event) => setManualTotal(event.target.value)} placeholder="Calculated if empty" className="stay-input w-full" /></Field><Field label="Address"><input value={manualAddress} onChange={(event) => setManualAddress(event.target.value)} className="stay-input w-full" /></Field><Field label="Website / booking link"><input type="url" value={manualUrl} onChange={(event) => setManualUrl(event.target.value)} className="stay-input w-full" /></Field><div className="flex items-end gap-2 md:col-span-2"><button onClick={() => void addManualStay()} disabled={savingId === "new"} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421] disabled:opacity-50">{savingId === "new" ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />} Save candidate</button><button onClick={() => setManualOpen(false)} className="h-10 rounded-xl border border-white/[0.08] px-4 text-xs text-[#d0d6d6]/55">Cancel</button></div></div>}

        {error && <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/15 bg-amber-300/[0.05] p-3 text-[10px] text-amber-100/70"><CircleAlert className="mt-0.5 size-3.5 shrink-0" />{error}</div>}
        {notice && <div className="mt-4 rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-3 text-[10px] text-[#86b9b0]">{notice}</div>}

        {loading ? <div className="grid min-h-48 place-items-center"><LoaderCircle className="size-6 animate-spin text-[#86b9b0]" /></div> : <div className="mt-5 grid gap-3 xl:grid-cols-2">{filteredStays.map((stay) => <StayCard key={stay.id} stay={stay} canEdit={canEdit} saving={savingId === stay.id} onPatch={(patch) => void patchStay(stay, patch)} onRemove={() => void removeStay(stay)} />)}{!filteredStays.length && <EmptyState title="No saved stays yet" detail="Add a mapped lodging place, save a manual option, or search a provider for current prices." />}</div>}
      </section>

      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex items-center gap-2"><MapPin className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Mapped lodging near this route</h3></div>
        <p className="mt-1 text-[10px] text-[#d0d6d6]/38">OpenStreetMap candidates are discovery leads. Confirm current details before relying on them.</p>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{lodging.slice(0, 12).map((place) => { const saved = stays.some((stay) => stay.sourceReference === place.id); const website = safeExternalUrl(place.website); return <article key={place.id} className="rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4"><div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><BedDouble className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{place.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/35">{place.distanceFromRouteKm.toFixed(1)} km from route · {place.distanceIntoRouteKm.toFixed(1)} km in</p></div></div><div className="mt-3 flex gap-2">{website && <a href={website} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-xl border border-white/[0.08] text-[#86b9b0]" aria-label={`Open ${place.name} website`}><Link2 className="size-3.5" /></a>}<button disabled={!canEdit || saved || savingId !== null} onClick={() => void addMappedPlace(place)} className="h-9 flex-1 rounded-xl border border-[#86b9b0]/18 text-[10px] font-semibold text-[#86b9b0] disabled:opacity-35">{saved ? "Saved" : "Add candidate"}</button></div></article>; })}{!lodging.length && <EmptyState title="No mapped lodging loaded" detail="Open this route on the dashboard so nearby lodging markers can be discovered first." />}</div>
      </section>
    </div>
  );
}

function StayCard({ stay, canEdit, saving, onPatch, onRemove }: { stay: AdventureStay; canEdit: boolean; saving: boolean; onPatch: (patch: Partial<AdventureStayDraft>) => void; onRemove: () => void }) {
  const perPerson = stay.totalPrice === undefined ? undefined : stay.totalPrice / Math.max(1, stay.adults);
  const sourceUrl = safeExternalUrl(stay.sourceUrl);
  function savePrivateDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const optionalPrice = (name: string) => {
      const value = String(form.get(name) ?? "").trim();
      return value === "" ? undefined : Number(value);
    };
    onPatch({
      checkIn: String(form.get("checkIn") ?? "") || undefined,
      checkOut: String(form.get("checkOut") ?? "") || undefined,
      nightlyPrice: optionalPrice("nightlyPrice"),
      totalPrice: optionalPrice("totalPrice"),
      contactPhone: String(form.get("contactPhone") ?? ""),
      contactEmail: String(form.get("contactEmail") ?? ""),
      bookingReference: String(form.get("bookingReference") ?? ""),
      notes: String(form.get("notes") ?? ""),
    });
  }
  return <article className={`rounded-2xl border p-4 ${stay.placement === "selected" ? "border-[#86b9b0]/36 bg-[#86b9b0]/[0.06]" : "border-white/[0.07] bg-[#041421]/35"}`}><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <BedDouble className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="truncate text-xs font-semibold text-white">{stay.name}</h4><span className="rounded-full bg-white/[0.05] px-2 py-1 text-[8px] font-bold uppercase tracking-wider text-[#86b9b0]">{placementLabels[stay.placement]}</span></div><p className="mt-1 truncate text-[9px] text-[#d0d6d6]/38">{accommodationTypeLabels[stay.accommodationType]}{stay.address ? ` · ${stay.address}` : ""}</p></div>{canEdit && <button onClick={onRemove} disabled={saving} className="grid size-8 place-items-center rounded-lg border border-white/[0.06] text-[#d0d6d6]/28 hover:text-rose-300" aria-label={`Remove ${stay.name}`}><Trash2 className="size-3.5" /></button>}</div><div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4"><SmallMetric icon={CalendarDays} value={stay.checkIn && stay.checkOut ? `${stay.checkIn.slice(5)} → ${stay.checkOut.slice(5)}` : "Dates needed"} /><SmallMetric icon={Users} value={`${stay.adults} people · ${stay.rooms} room${stay.rooms === 1 ? "" : "s"}`} /><SmallMetric icon={MapPin} value={stay.distanceFromRouteKm === undefined ? `Night ${stay.stageDay ?? "?"}` : `${stay.distanceFromRouteKm.toFixed(1)} km away`} /><SmallMetric icon={Star} value={stay.rating === undefined ? "No rating" : `${stay.rating.toFixed(1)} / 5`} /></div><div className="mt-4 flex flex-wrap items-end gap-2"><div className="mr-auto"><p className="text-lg font-semibold text-white">{money(stay.totalPrice, stay.currency)}</p><p className="text-[9px] text-[#d0d6d6]/35">{stay.nightlyPrice === undefined ? "Total price note" : `${money(stay.nightlyPrice, stay.currency)} nightly`} · {perPerson === undefined ? "per person unknown" : `${money(perPerson, stay.currency)} per person`}</p></div>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-xl border border-white/[0.08] text-[#86b9b0]" aria-label={`Open source for ${stay.name}`}><ExternalLink className="size-4" /></a>}{canEdit && <><select disabled={saving} value={stay.placement} onChange={(event) => onPatch({ placement: event.target.value as StayPlacement })} className="stay-input"><option value="candidate">Candidate</option><option value="selected">Selected</option><option value="backup">Backup</option></select><select disabled={saving} value={stay.reservationStatus} onChange={(event) => onPatch({ reservationStatus: event.target.value as ReservationStatus })} className="stay-input">{Object.entries(reservationLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></>}</div>{canEdit && <details className="mt-4 border-t border-white/[0.06] pt-3"><summary className="cursor-pointer text-[9px] font-semibold text-[#86b9b0]">Private booking and price details</summary><form onSubmit={savePrivateDetails} className="mt-3 grid gap-2 sm:grid-cols-2"><input name="checkIn" type="date" defaultValue={stay.checkIn} className="stay-input [color-scheme:dark]" aria-label="Check-in date" /><input name="checkOut" type="date" defaultValue={stay.checkOut} className="stay-input [color-scheme:dark]" aria-label="Check-out date" /><input name="nightlyPrice" type="number" min={0} step="0.01" defaultValue={stay.nightlyPrice} className="stay-input" placeholder="Nightly price" /><input name="totalPrice" type="number" min={0} step="0.01" defaultValue={stay.totalPrice} className="stay-input" placeholder="Total price" /><input name="contactPhone" defaultValue={stay.contactPhone} className="stay-input" placeholder="Contact number" /><input name="contactEmail" type="email" defaultValue={stay.contactEmail} className="stay-input" placeholder="Contact email" /><input name="bookingReference" defaultValue={stay.bookingReference} className="stay-input sm:col-span-2" placeholder="Booking reference" /><textarea name="notes" defaultValue={stay.notes} className="min-h-20 rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-[10px] text-white outline-none sm:col-span-2" placeholder="Cancellation terms, confirmation notes or access instructions" /><button disabled={saving} className="h-9 rounded-xl bg-[#86b9b0] px-4 text-[10px] font-bold text-[#041421] disabled:opacity-45 sm:col-span-2">Save private details</button></form></details>}</article>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55"><span className="mb-1 block">{label}</span>{children}</label>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="soft-panel rounded-2xl p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/36">{note}</p></article>;
}

function SmallMetric({ icon: Icon, value }: { icon: typeof CalendarDays; value: string }) {
  return <div className="rounded-xl bg-white/[0.025] p-2.5"><Icon className="size-3.5 text-[#86b9b0]" /><p className="mt-2 truncate text-[9px] text-[#d0d6d6]/50">{value}</p></div>;
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return <div className="col-span-full rounded-2xl border border-dashed border-white/[0.08] p-7 text-center"><BedDouble className="mx-auto size-5 text-[#86b9b0]/55" /><p className="mt-2 text-xs font-semibold text-white">{title}</p><p className="mx-auto mt-1 max-w-lg text-[10px] leading-5 text-[#d0d6d6]/38">{detail}</p></div>;
}
