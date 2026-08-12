"use client";

import { ChevronDown, Globe2, Layers3, Map, Mountain, Satellite } from "lucide-react";
import { useState, type ComponentType } from "react";
import type { BaseMapLayer } from "@/types/baseMap";

const options: Array<{ id: BaseMapLayer; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: "default", label: "Default", icon: Map },
  { id: "topographic", label: "Topographic", icon: Layers3 },
  { id: "terrain", label: "Terrain", icon: Mountain },
  { id: "satellite", label: "Satellite", icon: Satellite },
  { id: "global", label: "Global", icon: Globe2 },
];

export default function BaseLayerPicker({ active, googleAvailable, open, onOpenChange, onChange }: { active: BaseMapLayer; googleAvailable: boolean; open?: boolean; onOpenChange?: (open: boolean) => void; onChange: (layer: BaseMapLayer) => void }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const expanded = open ?? internalOpen;
  const setExpanded = (next: boolean) => {
    if (open === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const activeOption = options.find((option) => option.id === active) ?? options[0];
  const ActiveIcon = activeOption.icon;
  return (
    <div className="absolute right-3 top-3 z-30">
      <button onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#041421]/92 px-3 text-[9px] font-semibold text-white shadow-xl backdrop-blur-xl">
        <ActiveIcon className="size-3.5 text-[#86b9b0]" /> {activeOption.label}<ChevronDown className={`size-3 text-[#d0d6d6]/45 transition ${expanded ? "rotate-180" : ""}`} />
      </button>
      {expanded && <div className="absolute right-0 top-12 grid w-44 gap-1 rounded-xl border border-white/[0.1] bg-[#041421]/96 p-1.5 shadow-2xl backdrop-blur-xl">
        {options.map(({ id, label, icon: Icon }) => {
          const disabled = id === "satellite" && !googleAvailable;
          return <button key={id} disabled={disabled} onClick={() => { onChange(id); setExpanded(false); }} title={disabled ? "Enable Google Map Tiles API to use satellite imagery" : label} className={`flex items-center gap-2 rounded-lg px-3 py-2.5 text-left text-[9px] font-semibold transition ${active === id ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/55 hover:bg-white/[0.05] hover:text-white"} disabled:cursor-not-allowed disabled:opacity-25`}><Icon className="size-3.5" />{label}{disabled && <span className="ml-auto text-[7px]">OFF</span>}</button>;
        })}
      </div>}
    </div>
  );
}
