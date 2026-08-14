"use client";

import { Backpack, BedDouble, Bike, CheckCircle2, CircleDollarSign, CircleGauge, MapPin, PackageCheck, TentTree, Users } from "lucide-react";
import type { AdventurePlan } from "@/types/adventure";
import type { RoutePoi } from "@/types/poi";

export type LogisticsWorkspaceName = "Stays" | "Gear" | "Funds";

const gearGroups = [
  ["Bike and repairs", "Pump, tubes, tools and drivetrain spares"],
  ["Sleep system", "Shelter, sleeping bag and insulation"],
  ["Navigation and power", "Primary navigation, backup and charging"],
  ["Food and water", "Carrying capacity, treatment and cooking"],
  ["Safety and medical", "First aid, visibility and emergency equipment"],
];

const fundGroups = ["Accommodation", "Food and groceries", "Transport and fuel", "Permits and activities", "Repairs", "Emergency buffer"];

export default function PhaseBWorkspace({ name, adventure, pois }: { name: LogisticsWorkspaceName; adventure?: AdventurePlan; pois: RoutePoi[] }) {
  const lodging = pois.filter((poi) => poi.category === "lodging");
  const overnight = (adventure?.anchors ?? []).filter((anchor) => anchor.kind === "overnight");
  const Icon = name === "Stays" ? TentTree : name === "Gear" ? Bike : CircleDollarSign;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <section className="rise-in flex flex-col gap-4 sm:flex-row sm:items-end"><div className="mr-auto"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Phase B workspace</p><div className="mt-2 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#86b9b0]/12 text-[#86b9b0]"><Icon className="size-5" /></span><div><h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">{name}</h2><p className="mt-1 text-xs text-[#d0d6d6]/42">{adventure?.name ?? "Select a saved route to begin planning."}</p></div></div></div><span className="rounded-full border border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">Foundation active</span></section>
      {name === "Stays" ? <StaysFoundation adventure={adventure} lodging={lodging} overnightCount={overnight.length} /> : name === "Gear" ? <GearFoundation adventure={adventure} /> : <FundsFoundation adventure={adventure} />}
    </div>
  );
}

function StaysFoundation({ adventure, lodging, overnightCount }: { adventure?: AdventurePlan; lodging: RoutePoi[]; overnightCount: number }) {
  const nights = Math.max(0, (adventure?.days ?? 1) - 1);
  return <div className="mt-7 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="glass-panel rounded-[22px] p-5"><div className="flex items-center gap-2"><BedDouble className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Stay search foundation</h3></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><WorkspaceMetric label="Nights required" value={String(nights)} /><WorkspaceMetric label="Stage ends set" value={`${Math.min(nights, overnightCount)}/${nights}`} /><WorkspaceMetric label="Mapped candidates" value={String(lodging.length)} /></div><div className="mt-5 rounded-2xl border border-dashed border-[#86b9b0]/18 p-6"><p className="text-xs font-semibold text-white">Next increment</p><p className="mt-2 max-w-2xl text-[10px] leading-5 text-[#d0d6d6]/42">Dated occupancy search, candidate comparison, selected and backup stays, reservation states, private booking references and shared permissions will live here.</p></div></section><CandidateList lodging={lodging} /></div>;
}

function GearFoundation({ adventure }: { adventure?: AdventurePlan }) {
  return <div className="mt-7 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">{gearGroups.map(([title, description], index) => <article key={title} className="glass-panel rounded-[22px] p-5"><div className="flex items-center justify-between"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]">{index === 0 ? <Bike className="size-4" /> : index === 1 ? <Backpack className="size-4" /> : <PackageCheck className="size-4" />}</span><span className="text-[9px] font-bold uppercase tracking-wider text-[#d0d6d6]/28">0 packed</span></div><h3 className="mt-5 text-sm font-semibold text-white">{title}</h3><p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/40">{description}</p><button disabled={!adventure} className="mt-5 w-full rounded-xl border border-white/[0.08] py-2.5 text-[10px] font-semibold text-[#86b9b0] disabled:opacity-35">Add first item</button></article>)}</div>;
}

function FundsFoundation({ adventure }: { adventure?: AdventurePlan }) {
  return <div className="mt-7 space-y-4"><section className="grid gap-3 sm:grid-cols-3"><WorkspaceMetric label="Estimated trip" value="R0" /><WorkspaceMetric label="Per person" value="R0" /><WorkspaceMetric label="Recorded costs" value="0" /></section><section className="glass-panel rounded-[22px] p-5"><div className="flex items-center gap-2"><CircleGauge className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Budget categories</h3></div><div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">{fundGroups.map((group) => <button key={group} disabled={!adventure} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4 text-left disabled:opacity-35"><span className="grid size-8 place-items-center rounded-full bg-[#86b9b0]/10 text-[#86b9b0]"><CircleDollarSign className="size-4" /></span><span><span className="block text-xs font-semibold text-white">{group}</span><span className="mt-1 block text-[9px] text-[#d0d6d6]/35">No estimate yet</span></span></button>)}</div><div className="mt-5 flex items-start gap-3 rounded-2xl border border-[#86b9b0]/14 bg-[#86b9b0]/[0.04] p-4"><Users className="mt-0.5 size-4 shrink-0 text-[#86b9b0]" /><p className="text-[10px] leading-5 text-[#d0d6d6]/45">The next Funds increment adds shared estimates, actual costs, payers, participants and balances without moving money.</p></div></section></div>;
}

function CandidateList({ lodging }: { lodging: RoutePoi[] }) {
  return <aside className="glass-panel rounded-[22px] p-5"><div className="flex items-center gap-2"><MapPin className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Route candidates</h3></div><div className="mt-4 space-y-2">{lodging.slice(0, 6).map((place) => <div key={place.id} className="rounded-xl border border-white/[0.07] p-3"><p className="truncate text-[10px] font-semibold text-white">{place.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/36">{place.distanceIntoRouteKm.toFixed(1)} km into route</p></div>)}{!lodging.length && <div className="rounded-xl border border-dashed border-white/[0.08] p-5 text-center"><CheckCircle2 className="mx-auto size-4 text-[#86b9b0]/55" /><p className="mt-2 text-[10px] text-[#d0d6d6]/38">Explore lodging markers on the route map to populate candidates.</p></div>}</div></aside>;
}

function WorkspaceMetric({ label, value }: { label: string; value: string }) {
  return <article className="soft-panel rounded-2xl p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p></article>;
}
