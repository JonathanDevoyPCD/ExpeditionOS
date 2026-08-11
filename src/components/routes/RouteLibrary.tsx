"use client";

import { ArrowRight, CalendarDays, Map, Plus, Route, Sparkles, Trash2 } from "lucide-react";
import type { AdventurePlan } from "@/types/adventure";

export default function RouteLibrary({
  adventures,
  onOpen,
  onCreate,
  onDelete,
}: {
  adventures: AdventurePlan[];
  onOpen: (adventure: AdventurePlan) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[1740px] p-4 sm:p-6 xl:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Route library</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">My routes</h2><p className="mt-2 text-sm text-[#d0d6d6]/44">Your manually created and Copilot-planned adventures are kept privately in this browser.</p></div>
        <button onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421]"><Plus className="size-4" /> Create adventure</button>
      </div>
      {adventures.length ? (
        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {adventures.map((adventure) => (
            <article key={adventure.id} className="glass-panel group rounded-[24px] p-5 transition hover:-translate-y-1 hover:border-[#86b9b0]/25">
              <div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]">{adventure.source === "copilot" ? <Sparkles className="size-5" /> : <Route className="size-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{adventure.name}</p><p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{adventure.source} route</p></div><button onClick={() => onDelete(adventure.id)} className="grid size-8 place-items-center rounded-lg text-[#d0d6d6]/24 transition hover:bg-white/[0.05] hover:text-rose-200" aria-label={`Delete ${adventure.name}`}><Trash2 className="size-3.5" /></button></div>
              <p className="mt-4 line-clamp-2 min-h-10 text-[10px] leading-5 text-[#d0d6d6]/40">{adventure.description}</p>
              <div className="mt-5 grid grid-cols-3 gap-2"><div className="rounded-xl bg-[#041421]/40 p-3"><Map className="size-3.5 text-[#86b9b0]" /><p className="mt-2 text-sm font-semibold text-white">{adventure.route.metrics.distanceKm}</p><p className="text-[8px] uppercase text-[#d0d6d6]/30">kilometres</p></div><div className="rounded-xl bg-[#041421]/40 p-3"><Route className="size-3.5 text-[#86b9b0]" /><p className="mt-2 text-sm font-semibold text-white">{adventure.route.metrics.ascentM.toLocaleString()}</p><p className="text-[8px] uppercase text-[#d0d6d6]/30">metres up</p></div><div className="rounded-xl bg-[#041421]/40 p-3"><CalendarDays className="size-3.5 text-[#86b9b0]" /><p className="mt-2 text-sm font-semibold text-white">{adventure.days}</p><p className="text-[8px] uppercase text-[#d0d6d6]/30">days</p></div></div>
              <button onClick={() => onOpen(adventure)} className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/18 text-[10px] font-bold text-[#86b9b0] transition group-hover:bg-[#86b9b0]/8">Open route <ArrowRight className="size-3.5" /></button>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass-panel mt-7 rounded-[28px] px-6 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#86b9b0]/10 text-[#86b9b0]"><Route className="size-7" /></span><h3 className="mt-5 text-lg font-semibold text-white">Your route library is ready</h3><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#d0d6d6]/42">Create a route by clicking map anchors or describe a complete bike-packing trip to the Copilot.</p><button onClick={onCreate} className="mt-5 rounded-xl bg-[#86b9b0] px-5 py-3 text-xs font-bold text-[#041421]">Create your first adventure</button></div>
      )}
    </div>
  );
}
