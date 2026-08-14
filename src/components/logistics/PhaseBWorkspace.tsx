"use client";

import { Bike, CircleDollarSign, TentTree } from "lucide-react";
import FundsWorkspace from "@/components/logistics/FundsWorkspace";
import GearWorkspace from "@/components/logistics/GearWorkspace";
import StaysWorkspace from "@/components/logistics/StaysWorkspace";
import type { AdventurePlan } from "@/types/adventure";
import type { RoutePoi } from "@/types/poi";

export type LogisticsWorkspaceName = "Stays" | "Gear" | "Funds";

export default function PhaseBWorkspace({ name, adventure, pois, userId, canEdit }: { name: LogisticsWorkspaceName; adventure?: AdventurePlan; pois: RoutePoi[]; userId: string; canEdit: boolean }) {
  const Icon = name === "Stays" ? TentTree : name === "Gear" ? Bike : CircleDollarSign;

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
      <section className="rise-in flex flex-col gap-4 sm:flex-row sm:items-end"><div className="mr-auto"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Phase B workspace</p><div className="mt-2 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#86b9b0]/12 text-[#86b9b0]"><Icon className="size-5" /></span><div><h2 className="text-2xl font-semibold tracking-[-0.035em] text-white">{name}</h2><p className="mt-1 text-xs text-[#d0d6d6]/42">{adventure?.name ?? "Select a saved route to begin planning."}</p></div></div></div><span className="rounded-full border border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">Shared workspace active</span></section>
      {name === "Stays" ? <StaysWorkspace adventure={adventure} pois={pois} userId={userId} canEdit={canEdit} /> : name === "Gear" ? <GearWorkspace adventure={adventure} userId={userId} canEdit={canEdit} /> : <FundsWorkspace adventure={adventure} userId={userId} canEdit={canEdit} />}
    </div>
  );
}
