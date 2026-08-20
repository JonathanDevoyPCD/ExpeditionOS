"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarDays, CheckCircle2, ChevronRight, CircleDollarSign, CloudSun, LoaderCircle, PackageCheck, ShieldAlert } from "lucide-react";

import { loadAdventureFunds } from "@/lib/cloudFunds";
import { loadAdventureGear } from "@/lib/cloudGear";
import { loadAdventureStays } from "@/lib/cloudStays";
import { buildTripCommandSnapshot } from "@/lib/tripCommand.mjs";
import type { AdventurePlan } from "@/types/adventure";
import type { AdventureFundItem } from "@/types/funds";
import type { AdventureGearItem } from "@/types/gear";
import type { ItineraryWarning } from "@/types/itinerary";
import type { AdventureStay } from "@/types/stay";

type Workspace = "Weather" | "Stays" | "Gear" | "Funds";

function formatDate(date?: string) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" }) : "Date not set";
}

export default function TripCommandCentre({
  adventure,
  itineraryWarnings,
  onOpen,
}: {
  adventure?: AdventurePlan;
  itineraryWarnings: ItineraryWarning[];
  onOpen: (workspace: Workspace) => void;
}) {
  const [stays, setStays] = useState<AdventureStay[]>([]);
  const [gear, setGear] = useState<AdventureGearItem[]>([]);
  const [funds, setFunds] = useState<AdventureFundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canReadPrivateLogistics = Boolean(adventure && adventure.access?.isMember !== false);

  useEffect(() => {
    let active = true;
    if (!adventure || !canReadPrivateLogistics) return;
    queueMicrotask(() => { setLoading(true); setError(null); });
    Promise.all([
      loadAdventureStays(adventure.id),
      loadAdventureGear(adventure.id),
      loadAdventureFunds(adventure.id),
    ])
      .then(([nextStays, nextGear, nextFunds]) => {
        if (!active) return;
        setStays(nextStays);
        setGear(nextGear);
        setFunds(nextFunds);
      })
      .catch(() => { if (active) setError("Private trip readiness could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure, canReadPrivateLogistics]);

  const snapshot = useMemo(
    () => adventure ? buildTripCommandSnapshot(adventure, stays, gear, funds, itineraryWarnings) : null,
    [adventure, funds, gear, itineraryWarnings, stays],
  );

  if (!adventure) {
    return (
      <section className="glass-panel mt-5 rounded-[22px] border border-dashed border-[#86b9b0]/16 p-5 sm:p-6">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 text-[#86b9b0]" /><div><h3 className="text-sm font-semibold text-white">Save this route to activate Trip Command</h3><p className="mt-1 text-[11px] leading-5 text-[#d0d6d6]/42">A saved trip connects dates, stays, gear, funds, and readiness to this route.</p></div></div>
      </section>
    );
  }

  if (!canReadPrivateLogistics) {
    return (
      <section className="glass-panel mt-5 rounded-[22px] p-5 sm:p-6">
        <div className="flex items-start gap-3"><ShieldAlert className="mt-0.5 size-5 text-[#86b9b0]" /><div><h3 className="text-sm font-semibold text-white">Public route view</h3><p className="mt-1 text-[11px] leading-5 text-[#d0d6d6]/42">Accommodation, packing, and budget details are visible only to trip members.</p></div></div>
      </section>
    );
  }

  const status = snapshot && snapshot.blockers.length === 0 ? "Ready for final review" : "Action required";
  const statusStyle = snapshot && snapshot.blockers.length === 0 ? "bg-[#86b9b0]/12 text-[#86b9b0]" : "bg-amber-300/10 text-amber-200";

  return (
    <section className="glass-panel rise-in mt-5 overflow-hidden rounded-[22px]">
      <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="mr-auto">
          <div className="flex flex-wrap items-center gap-2"><ShieldAlert className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Trip Command Centre</h3>{snapshot && <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider ${statusStyle}`}>{status}</span>}</div>
          <p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/38">One operational view across your route, schedule, accommodation, gear, resupply, and budget.</p>
        </div>
        {loading && <span className="flex items-center gap-2 text-[10px] text-[#86b9b0]"><LoaderCircle className="size-3.5 animate-spin" /> Syncing trip data</span>}
      </div>

      {error ? <div className="m-5 rounded-xl border border-amber-300/14 bg-amber-300/[0.04] px-4 py-3 text-[10px] text-amber-100/70">{error}</div> : snapshot && (
        <div className="p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { icon: BedDouble, label: "Overnight stays", value: `${snapshot.selectedStays}/${snapshot.requiredNights}`, open: "Stays" as const },
              { icon: PackageCheck, label: "Critical gear", value: `${snapshot.packedCritical}/${snapshot.criticalTotal}`, open: "Gear" as const },
              { icon: CircleDollarSign, label: "Trip budget", value: snapshot.estimatedBudget ? `${snapshot.currency} ${snapshot.estimatedBudget.toLocaleString("en-ZA")}` : "Not set", open: "Funds" as const },
              { icon: CloudSun, label: "Forecast window", value: adventure.startsOn ? `${adventure.days} day${adventure.days === 1 ? "" : "s"}` : "Dates needed", open: "Weather" as const },
            ].map(({ icon: Icon, label, value, open }) => (
              <button key={label} onClick={() => onOpen(open)} className="rounded-2xl border border-white/[0.07] bg-[#041421]/38 p-4 text-left transition hover:border-[#86b9b0]/24 hover:bg-[#041421]/58">
                <div className="flex items-center justify-between"><Icon className="size-4 text-[#86b9b0]" /><ChevronRight className="size-3.5 text-[#d0d6d6]/24" /></div><p className="mt-4 text-lg font-semibold text-white">{value}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-[#d0d6d6]/34">{label}</p>
              </button>
            ))}
          </div>

          {(snapshot.blockers.length > 0 || snapshot.warnings.length > 0) && (
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {snapshot.blockers.length > 0 && <div className="rounded-2xl border border-amber-300/14 bg-amber-300/[0.035] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/75">Blocking departure</p><div className="mt-3 space-y-2">{snapshot.blockers.map((blocker) => <p key={blocker} className="flex gap-2 text-[10px] leading-4 text-[#d0d6d6]/58"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-300" />{blocker}</p>)}</div></div>}
              {snapshot.warnings.length > 0 && <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#86b9b0]/70">Review before leaving</p><div className="mt-3 space-y-2">{snapshot.warnings.map((warning) => <p key={warning} className="flex gap-2 text-[10px] leading-4 text-[#d0d6d6]/50"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#86b9b0]" />{warning}</p>)}</div></div>}
            </div>
          )}

          <details className="group mt-5 border-t border-white/[0.06] pt-1">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-1 py-3 outline-none transition hover:bg-white/[0.025] focus-visible:ring-2 focus-visible:ring-[#86b9b0]/45">
              <CalendarDays className="size-4 text-[#86b9b0]" />
              <div className="mr-auto"><h4 className="text-xs font-semibold text-white">Day-by-day operating plan</h4><p className="mt-1 text-[10px] text-[#d0d6d6]/35">{snapshot.days.length} stages with route, overnight, forecast and cost context</p></div>
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-[#86b9b0]">Review stages <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" /></span>
            </summary>
            <div className="mt-2 grid gap-3 xl:grid-cols-2">
              {snapshot.days.map((day) => (
                <article key={day.day} className="rounded-2xl border border-white/[0.07] bg-[#041421]/34 p-4">
                  <div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/12 text-[10px] font-bold text-[#86b9b0]">D{day.day}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h5 className="truncate text-xs font-semibold text-white">{day.title}</h5><span className="text-[9px] font-semibold uppercase tracking-wider text-[#86b9b0]/65">{formatDate(day.date)}</span></div><p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#d0d6d6]/40">{day.summary}</p></div></div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-[9px]"><div className="rounded-xl bg-[#041421]/55 p-2.5"><span className="block text-[#d0d6d6]/30">Route</span><strong className="mt-1 block text-white">{day.targetDistanceKm} km</strong></div><button onClick={() => onOpen("Stays")} className="rounded-xl bg-[#041421]/55 p-2.5 text-left"><span className="block text-[#d0d6d6]/30">Night</span><strong className="mt-1 block truncate text-white">{day.stay?.name ?? (day.day === snapshot.days.length ? "Finish" : "Not chosen")}</strong></button><button onClick={() => onOpen("Weather")} className="rounded-xl bg-[#041421]/55 p-2.5 text-left"><span className="block text-[#d0d6d6]/30">Forecast</span><strong className="mt-1 block text-white">{day.date ? "View day" : "Set date"}</strong></button></div>
                  {day.estimatedCost > 0 && <p className="mt-3 flex items-center gap-1.5 text-[9px] text-[#d0d6d6]/38"><CircleDollarSign className="size-3 text-[#86b9b0]" /> {snapshot.currency} {day.estimatedCost.toLocaleString("en-ZA")} assigned to this day</p>}
                </article>
              ))}
            </div>
          </details>

          {snapshot.blockers.length === 0 && snapshot.warnings.length === 0 && <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.04] p-4"><CheckCircle2 className="size-5 text-[#86b9b0]" /><p className="text-[10px] text-[#d0d6d6]/58">Core planning records are complete. Perform a final local conditions, access, and emergency review before departure.</p></div>}
        </div>
      )}
    </section>
  );
}
