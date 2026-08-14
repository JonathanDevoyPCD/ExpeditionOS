"use client";

import { BedDouble, CheckCircle2, CircleAlert, ExternalLink, MapPin, TentTree } from "lucide-react";
import { useEffect, useState } from "react";
import { loadAdventureStays } from "@/lib/cloudStays";
import type { AdventurePlan } from "@/types/adventure";
import type { RoutePoi } from "@/types/poi";
import type { AdventureStay } from "@/types/stay";

function price(value: number, currency = "ZAR") {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
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

export default function AccommodationDashboard({ adventure, pois, onOpenStays }: { adventure?: AdventurePlan; pois: RoutePoi[]; onOpenStays: () => void }) {
  const [stays, setStays] = useState<AdventureStay[]>([]);
  const nightsRequired = Math.max(0, (adventure?.days ?? 1) - 1);
  const overnightAnchors = (adventure?.anchors ?? []).filter((anchor) => anchor.kind === "overnight");
  const lodging = pois.filter((poi) => poi.category === "lodging").slice(0, 8);
  const covered = Math.min(nightsRequired, overnightAnchors.length);
  const selectedStays = stays.filter((stay) => stay.placement === "selected");
  const accommodationTotal = selectedStays.reduce((sum, stay) => sum + (stay.totalPrice ?? 0), 0);

  useEffect(() => {
    let active = true;
    if (!adventure) {
      queueMicrotask(() => { if (active) setStays([]); });
      return () => { active = false; };
    }
    loadAdventureStays(adventure.id).then((items) => { if (active) setStays(items); }).catch(() => { if (active) setStays([]); });
    return () => { active = false; };
  }, [adventure]);

  return (
    <div className="mt-5 space-y-4">
      <section className="grid gap-3 md:grid-cols-3">
        <SummaryCard label="Overnights required" value={String(nightsRequired)} note={`${adventure?.days ?? 1}-day expedition`} />
        <SummaryCard label="Stage ends placed" value={`${covered}/${nightsRequired}`} note={nightsRequired === covered ? "Every overnight has a location" : "Add overnight anchors to close the gaps"} />
        <SummaryCard label="Selected stays" value={`${selectedStays.length}/${nightsRequired}`} note={accommodationTotal ? `${price(accommodationTotal)} accommodation total` : `${stays.length} saved candidate${stays.length === 1 ? "" : "s"}`} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="glass-panel rounded-[22px] p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="mr-auto"><div className="flex items-center gap-2"><TentTree className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Overnight coverage</h3></div><p className="mt-1 text-[10px] text-[#d0d6d6]/38">Accommodation summary for the active trip.</p></div><button onClick={onOpenStays} className="rounded-xl bg-[#86b9b0] px-4 py-2.5 text-xs font-bold text-[#041421]">Open Stays workspace</button></div>
          <div className="mt-5 space-y-2">
            {Array.from({ length: nightsRequired }, (_, index) => {
              const anchor = overnightAnchors.find((candidate) => candidate.day === index + 1) ?? overnightAnchors[index];
              const stay = selectedStays.find((candidate) => candidate.stageDay === index + 1);
              return <div key={index} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4"><span className={`grid size-8 place-items-center rounded-full ${anchor && stay ? "bg-[#86b9b0] text-[#041421]" : "bg-amber-300/10 text-amber-200"}`}>{anchor && stay ? <CheckCircle2 className="size-4" /> : <CircleAlert className="size-4" />}</span><div className="min-w-0"><p className="text-xs font-semibold text-white">Night {index + 1}</p><p className="mt-1 truncate text-[10px] text-[#d0d6d6]/42">{stay?.name ?? anchor?.name ?? "No overnight location selected"}</p></div><span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{stay ? stay.reservationStatus : anchor ? "Stay needed" : "Stage needed"}</span></div>;
            })}
            {!nightsRequired && <div className="rounded-2xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-6 text-center"><CheckCircle2 className="mx-auto size-5 text-[#86b9b0]" /><p className="mt-2 text-xs font-semibold text-white">No overnight stay required</p><p className="mt-1 text-[10px] text-[#d0d6d6]/38">This route is currently planned as a single-day expedition.</p></div>}
          </div>
        </article>

        <aside className="glass-panel rounded-[22px] p-5">
          <div className="flex items-center gap-2"><BedDouble className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">{selectedStays.length ? "Selected stays" : "Nearby candidates"}</h3></div>
          <div className="mt-4 space-y-2">
            {selectedStays.map((stay) => { const sourceUrl = safeExternalUrl(stay.sourceUrl); return <div key={stay.id} className="rounded-xl border border-[#86b9b0]/14 bg-[#86b9b0]/[0.04] p-3"><div className="flex items-start gap-2"><CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-white">{stay.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/36">Night {stay.stageDay ?? "?"} · {stay.reservationStatus} · {stay.totalPrice === undefined ? "price needed" : price(stay.totalPrice, stay.currency)}</p>{sourceUrl && <a href={sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#86b9b0]">Open source <ExternalLink className="size-3" /></a>}</div></div></div>; })}
            {!selectedStays.length && lodging.slice(0, 5).map((place) => <div key={place.id} className="rounded-xl border border-white/[0.07] p-3"><div className="flex items-start gap-2"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" /><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-white">{place.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/36">{place.distanceIntoRouteKm.toFixed(1)} km into route · {place.distanceFromRouteKm.toFixed(1)} km away</p>{place.bookingSearchUrl && <a href={place.bookingSearchUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[9px] font-semibold text-[#86b9b0]">Search availability <ExternalLink className="size-3" /></a>}</div></div></div>)}
            {!selectedStays.length && !lodging.length && <p className="rounded-xl border border-dashed border-white/[0.08] p-5 text-center text-[10px] leading-5 text-[#d0d6d6]/38">No lodging markers are loaded near this route yet. Explore the Stays workspace around each stage end.</p>}
          </div>
        </aside>
      </section>
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="soft-panel rounded-2xl p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/36">{note}</p></article>;
}
