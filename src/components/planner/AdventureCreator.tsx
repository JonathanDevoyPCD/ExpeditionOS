"use client";

import dynamic from "next/dynamic";
import {
  ArrowLeft,
  Bike,
  Bot,
  Check,
  ChevronRight,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Plus,
  RotateCcw,
  Route,
  Search,
  Sparkles,
  TentTree,
  Trash2,
  Undo2,
} from "lucide-react";
import { useMemo, useState } from "react";
import { createAdventureId } from "@/lib/adventures";
import type { AdventurePlan, CopilotBlueprint, GeocodeResult, RouteAnchor } from "@/types/adventure";
import type { PoiDataset, RoutePoi } from "@/types/poi";
import type { RouteDataset } from "@/types/route";

const RouteBuilderMap = dynamic(() => import("@/components/planner/RouteBuilderMap"), {
  ssr: false,
  loading: () => <div className="pulse-soft h-full min-h-[510px] bg-[#0a303a]" />,
});

function coordinateName(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function routeAnchor(name: string, lat: number, lon: number, index: number): RouteAnchor {
  return {
    id: `anchor-${Date.now().toString(36)}-${index}`,
    name,
    lat,
    lon,
    kind: index === 0 ? "start" : "via",
  };
}

function suggestedPlaces(dataset: PoiDataset | null, route: RouteDataset | null) {
  if (!dataset || !route) return [];
  const useful = dataset.items.filter((poi) => ["lodging", "fuel", "food", "groceries", "water"].includes(poi.category));
  const targets = [0.25, 0.5, 0.75].map((fraction) => fraction * route.metrics.distanceKm);
  return useful
    .sort((a, b) => {
      const aTarget = Math.min(...targets.map((target) => Math.abs(a.distanceIntoRouteKm - target)));
      const bTarget = Math.min(...targets.map((target) => Math.abs(b.distanceIntoRouteKm - target)));
      const aLodging = a.category === "lodging" ? -5 : 0;
      const bLodging = b.category === "lodging" ? -5 : 0;
      return aTarget + a.distanceFromRouteKm * 3 + aLodging - (bTarget + b.distanceFromRouteKm * 3 + bLodging);
    })
    .filter((poi, index, all) => all.findIndex((candidate) => candidate.name === poi.name && candidate.category === poi.category) === index)
    .slice(0, 8);
}

export default function AdventureCreator({
  onCancel,
  onSave,
}: {
  onCancel: () => void;
  onSave: (adventure: AdventurePlan, pois: PoiDataset | null) => void;
}) {
  const [mode, setMode] = useState<"manual" | "copilot">("copilot");
  const [name, setName] = useState("My new expedition");
  const [anchors, setAnchors] = useState<RouteAnchor[]>([]);
  const [route, setRoute] = useState<RouteDataset | null>(null);
  const [blueprint, setBlueprint] = useState<CopilotBlueprint | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [startLocation, setStartLocation] = useState("Gqeberha, Eastern Cape, South Africa");
  const [prompt, setPrompt] = useState("I want to do a bike-packing trip to Tsitsikamma and back over 4 days. Create a route with suggested overnight areas and resupply stops.");
  const [loading, setLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [poiDataset, setPoiDataset] = useState<PoiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const places = useMemo(() => suggestedPlaces(poiDataset, route), [poiDataset, route]);

  function resetPlanning(nextMode: "manual" | "copilot") {
    setMode(nextMode);
    setAnchors([]);
    setRoute(null);
    setBlueprint(null);
    setPoiDataset(null);
    setError(null);
  }

  async function loadPlaces(nextRoute: RouteDataset, routeAnchors: RouteAnchor[]) {
    setPlacesLoading(true);
    try {
      const response = await fetch("/api/pois", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ route: nextRoute, anchors: routeAnchors, corridorKm: 2 }),
      });
      const result = (await response.json()) as PoiDataset & { error?: string };
      if (!response.ok) throw new Error(result.error);
      setPoiDataset(result);
    } catch {
      setPoiDataset(null);
    } finally {
      setPlacesLoading(false);
    }
  }

  function addAnchor(lat: number, lon: number, label?: string) {
    setRoute(null);
    setPoiDataset(null);
    setAnchors((current) => [...current, routeAnchor(label ?? coordinateName(lat, lon), lat, lon, current.length)]);
  }

  async function searchPlace() {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/geocode?q=${encodeURIComponent(searchQuery.trim())}`);
      const result = (await response.json()) as { items?: GeocodeResult[]; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Place search failed.");
      setSearchResults(result.items ?? []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Place search failed.");
    } finally {
      setSearchLoading(false);
    }
  }

  async function buildManualRoute() {
    if (anchors.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const normalized = anchors.map((anchor, index) => ({
        ...anchor,
        kind: index === 0 ? "start" as const : index === anchors.length - 1 ? "finish" as const : "via" as const,
      }));
      const response = await fetch("/api/route/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, anchors: normalized }),
      });
      const result = (await response.json()) as { route?: RouteDataset; error?: string };
      if (!response.ok || !result.route) throw new Error(result.error ?? "The route could not be built.");
      setAnchors(normalized);
      setRoute(result.route);
      void loadPlaces(result.route, normalized);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The route could not be built.");
    } finally {
      setLoading(false);
    }
  }

  async function buildCopilotRoute() {
    setLoading(true);
    setError(null);
    setRoute(null);
    setPoiDataset(null);
    try {
      const response = await fetch("/api/route/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, startLocation }),
      });
      const result = (await response.json()) as {
        blueprint?: CopilotBlueprint;
        route?: RouteDataset;
        anchors?: RouteAnchor[];
        error?: string;
      };
      if (!response.ok || !result.blueprint || !result.route || !result.anchors) {
        throw new Error(result.error ?? "The Copilot could not create this route.");
      }
      setName(result.blueprint.name);
      setBlueprint(result.blueprint);
      setAnchors(result.anchors);
      setRoute(result.route);
      void loadPlaces(result.route, result.anchors);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Copilot could not create this route.");
    } finally {
      setLoading(false);
    }
  }

  function save() {
    if (!route) return;
    const now = new Date().toISOString();
    onSave({
      id: createAdventureId(),
      name: route.name,
      description: blueprint?.summary ?? `A custom cycling route with ${anchors.length} anchors.`,
      source: mode,
      createdAt: now,
      updatedAt: now,
      days: blueprint?.days ?? 1,
      route,
      anchors,
      blueprint: blueprint ?? undefined,
    }, poiDataset);
  }

  return (
    <div className="mx-auto max-w-[1740px] p-4 sm:p-6 xl:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button onClick={onCancel} className="mb-4 flex items-center gap-2 text-[11px] font-semibold text-[#86b9b0]/70 transition hover:text-[#86b9b0]"><ArrowLeft className="size-3.5" /> Back to dashboard</button>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Adventure creator</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Build a route your way</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0d6d6]/46">Place your own anchors on the map, search for locations, or describe a complete expedition to the Copilot.</p>
        </div>
        <div className="flex rounded-2xl border border-white/[0.08] bg-[#042630]/72 p-1.5">
          <button onClick={() => resetPlanning("manual")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "manual" ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/48 hover:text-white"}`}><MapPin className="size-4" /> Manual</button>
          <button onClick={() => resetPlanning("copilot")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "copilot" ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/48 hover:text-white"}`}><Sparkles className="size-4" /> Copilot</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {mode === "manual" ? (
            <article className="glass-panel rounded-[24px] p-5">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><Route className="size-5" /></span><div><h3 className="text-sm font-semibold text-white">Manual route</h3><p className="text-[10px] text-[#d0d6d6]/38">Click the map or search a place</p></div></div>
              <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Route name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/35" />
              <div className="mt-4 flex gap-2">
                <div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 focus-within:border-[#86b9b0]/35"><Search className="size-4 shrink-0 text-[#4c7273]" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchPlace(); }} placeholder="Search town or landmark" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none" /></div>
                <button onClick={searchPlace} disabled={searchLoading} className="grid size-11 place-items-center rounded-xl bg-[#86b9b0] text-[#041421] disabled:opacity-50">{searchLoading ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}</button>
              </div>
              {searchResults.length > 0 && <div className="mt-2 space-y-1 rounded-xl border border-white/[0.07] bg-[#041421]/70 p-2">{searchResults.map((result) => <button key={result.id} onClick={() => { addAnchor(result.lat, result.lon, result.name); setSearchResults([]); }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-white/[0.05]"><Plus className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" /><span><span className="block text-[11px] font-semibold text-white">{result.name}</span><span className="mt-0.5 line-clamp-2 block text-[9px] leading-4 text-[#d0d6d6]/38">{result.displayName}</span></span></button>)}</div>}
              <div className="mt-5 flex items-center justify-between"><p className="text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Anchors · {anchors.length}</p><div className="flex gap-2"><button onClick={() => { setAnchors((current) => current.slice(0, -1)); setRoute(null); }} disabled={!anchors.length} className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-[#d0d6d6]/48 disabled:opacity-25" title="Undo"><Undo2 className="size-3.5" /></button><button onClick={() => { setAnchors([]); setRoute(null); setPoiDataset(null); }} disabled={!anchors.length} className="grid size-8 place-items-center rounded-lg border border-white/[0.07] text-[#d0d6d6]/48 disabled:opacity-25" title="Clear"><Trash2 className="size-3.5" /></button></div></div>
              <div className="mt-3 max-h-52 space-y-2 overflow-y-auto">{anchors.map((anchor, index) => <div key={anchor.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#041421]/36 p-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-[#86b9b0] text-[9px] font-bold text-[#041421]">{index + 1}</span><span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white">{anchor.name}</span></div>)}</div>
              <button onClick={buildManualRoute} disabled={loading || anchors.length < 2} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] transition hover:bg-[#9ac9c0] disabled:cursor-not-allowed disabled:opacity-35">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Bike className="size-4" />}{loading ? "Finding cycleable roads…" : "Build cycling route"}</button>
            </article>
          ) : (
            <article className="glass-panel rounded-[24px] p-5">
              <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><Bot className="size-5" /></span><div><h3 className="text-sm font-semibold text-white">Expedition Copilot</h3><p className="text-[10px] text-[#d0d6d6]/38">Powered by GPT-5.6 Luna</p></div></div>
              <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Start and finish base</label>
              <input value={startLocation} onChange={(event) => setStartLocation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/35" />
              <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Describe the trip</label>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 h-40 w-full resize-none rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-xs leading-6 text-white outline-none focus:border-[#86b9b0]/35" />
              <p className="mt-3 text-[9px] leading-4 text-[#d0d6d6]/34">Copilot chooses real towns or areas; roads come from bicycle routing, and named places come from OpenStreetMap. Always verify access and accommodation.</p>
              <button onClick={buildCopilotRoute} disabled={loading || !prompt.trim() || !startLocation.trim()} className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] transition hover:bg-[#9ac9c0] disabled:cursor-not-allowed disabled:opacity-35">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? "Planning and routing…" : "Create route with Copilot"}</button>
            </article>
          )}

          {error && <div className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4 text-[11px] leading-5 text-amber-50/70">{error}</div>}
        </aside>

        <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#042630]/62">
          <div className="relative min-h-[510px]">
            <RouteBuilderMap anchors={anchors} route={route} onMapClick={(lat, lon) => { if (mode === "manual") addAnchor(lat, lon); }} />
            <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/[0.08] bg-[#041421]/88 px-3 py-2 text-[10px] text-[#d0d6d6]/58 shadow-xl backdrop-blur-xl">{mode === "manual" ? "Click anywhere to add a route anchor" : route ? "Copilot route preview" : "Your generated route will appear here"}</div>
          </div>

          <div className="border-t border-white/[0.07] p-5">
            {route ? (
              <div>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <span className="grid size-11 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><Check className="size-5" /></span>
                  <div className="min-w-0 flex-1"><p className="truncate text-base font-semibold text-white">{route.name}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/38">{route.metrics.distanceKm} km · {route.metrics.ascentM.toLocaleString()} m ascent · {Math.floor(route.metrics.estimatedMovingMinutes / 60)}h {route.metrics.estimatedMovingMinutes % 60}m routed time</p></div>
                  <button onClick={save} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421] transition hover:bg-[#9ac9c0]"><Plus className="size-4" /> Save and open route</button>
                </div>

                {blueprint && <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{blueprint.dailyPlan.map((day) => <article key={day.day} className="rounded-2xl border border-white/[0.07] bg-[#041421]/34 p-4"><p className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">Day {day.day} · ~{day.targetDistanceKm} km</p><p className="mt-2 text-xs font-semibold text-white">{day.title}</p><p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/40">{day.summary}</p></article>)}</div>}

                <div className="mt-5">
                  <div className="flex items-center gap-2"><TentTree className="size-4 text-[#86b9b0]" /><p className="text-xs font-semibold text-white">Mapped lodging and resupply suggestions</p>{placesLoading && <LoaderCircle className="size-3.5 animate-spin text-[#86b9b0]" />}</div>
                  {places.length > 0 ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{places.map((poi: RoutePoi) => <article key={poi.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#041421]/30 p-3"><MapPin className="size-4 shrink-0 text-[#86b9b0]" /><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-white">{poi.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/35">{poi.category} · {poi.distanceIntoRouteKm.toFixed(1)} km</p></div></article>)}</div> : !placesLoading && <p className="mt-2 text-[10px] text-[#d0d6d6]/34">No mapped candidates were confirmed yet. You can still save the route and search its map layers.</p>}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 text-[#d0d6d6]/38"><RotateCcw className="size-4" /><p className="text-xs">Add two or more anchors, or let Copilot create a complete route plan.</p><ChevronRight className="ml-auto size-4" /></div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
