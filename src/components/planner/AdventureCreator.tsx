"use client";

import dynamic from "next/dynamic";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bike,
  Bot,
  Check,
  Clock3,
  ExternalLink,
  Globe2,
  Lock,
  Layers3,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Mountain,
  Phone,
  Plus,
  RefreshCw,
  Route,
  Search,
  Sparkles,
  Star,
  TentTree,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdventureId } from "@/lib/adventures";
import { DAY_COLORS } from "@/components/planner/RouteBuilderMap";
import GooglePlaceDetailsCard from "@/components/places/GooglePlaceDetailsCard";
import { buildRouteStages } from "@/lib/routeStages";
import type { AdventurePlan, AdventureVisibility, CopilotBlueprint, GeocodeResult, RouteAnchor, RoutePreferences } from "@/types/adventure";
import type { MapPlace, MapPlaceDataset, MapViewport } from "@/types/mapPlace";
import { POI_CATEGORIES, type PoiCategory, type PoiDataset, type RoutePoi } from "@/types/poi";
import type { RouteDataset } from "@/types/route";

const RouteBuilderMap = dynamic(() => import("@/components/planner/RouteBuilderMap"), {
  ssr: false,
  loading: () => <div className="pulse-soft h-full min-h-[620px] bg-[#0a303a]" />,
});

const DEFAULT_PREFERENCES: RoutePreferences = { bicycleType: "Hybrid", hillPreference: "balanced", roadPreference: "avoid_major" };
const PLACE_LABELS: Record<PoiCategory, string> = {
  fuel: "Fuel",
  food: "Food & cafés",
  groceries: "Groceries",
  shopping: "Shops",
  water: "Water",
  repair: "Bike repair",
  pharmacy: "Pharmacy",
  toilets: "Toilets",
  attraction: "Highlights",
  lodging: "Lodging",
};
const PLACE_COLORS: Record<PoiCategory, string> = {
  fuel: "#f2b766", food: "#d87979", groceries: "#86b9b0", shopping: "#e4a6c8", water: "#55a8d7", repair: "#9d83c6",
  pharmacy: "#e66b7b", toilets: "#d0d6d6", attraction: "#b8d36b", lodging: "#c9a277",
};

function coordinateName(lat: number, lon: number) {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

function routeAnchor(name: string, lat: number, lon: number, index: number): RouteAnchor {
  return { id: `anchor-${Date.now().toString(36)}-${index}`, name, lat, lon, kind: index === 0 ? "start" : "via" };
}

function suggestedPlaces(dataset: PoiDataset | null, route: RouteDataset | null) {
  if (!dataset || !route) return [];
  const useful = dataset.items.filter((poi) => ["lodging", "fuel", "food", "groceries", "water"].includes(poi.category));
  const targets = [0.25, 0.5, 0.75].map((fraction) => fraction * route.metrics.distanceKm);
  return useful
    .sort((a, b) => {
      const score = (poi: RoutePoi) => Math.min(...targets.map((target) => Math.abs(poi.distanceIntoRouteKm - target))) + poi.distanceFromRouteKm * 3 + (poi.category === "lodging" ? -5 : 0);
      return score(a) - score(b);
    })
    .filter((poi, index, all) => all.findIndex((candidate) => candidate.name === poi.name && candidate.category === poi.category) === index)
    .slice(0, 8);
}

export default function AdventureCreator({
  initialAdventure,
  onCancel,
  onSave,
}: {
  initialAdventure?: AdventurePlan | null;
  onCancel: () => void;
  onSave: (adventure: AdventurePlan, pois: PoiDataset | null) => void;
}) {
  const [mode, setMode] = useState<"manual" | "copilot">(initialAdventure?.source === "copilot" ? "copilot" : "manual");
  const [name, setName] = useState(initialAdventure?.name ?? "My new expedition");
  const [anchors, setAnchors] = useState<RouteAnchor[]>(initialAdventure?.anchors ?? []);
  const [route, setRoute] = useState<RouteDataset | null>(initialAdventure?.route ?? null);
  const [blueprint, setBlueprint] = useState<CopilotBlueprint | null>(initialAdventure?.blueprint ?? null);
  const [preferences, setPreferences] = useState<RoutePreferences>(initialAdventure?.preferences ?? DEFAULT_PREFERENCES);
  const [days, setDays] = useState(initialAdventure?.days ?? initialAdventure?.blueprint?.days ?? 1);
  const [visibility, setVisibility] = useState<AdventureVisibility>(initialAdventure?.visibility ?? "private");
  const [routeNeedsRebuild, setRouteNeedsRebuild] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodeResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [startLocation, setStartLocation] = useState("Gqeberha, Eastern Cape, South Africa");
  const [prompt, setPrompt] = useState("I want to do a bike-packing trip to Tsitsikamma and back over 4 days. Create a route with suggested overnight areas and resupply stops.");
  const [loading, setLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [poiDataset, setPoiDataset] = useState<PoiDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewport, setViewport] = useState<MapViewport | null>(null);
  const [mapPlaces, setMapPlaces] = useState<MapPlaceDataset | null>(null);
  const [mapPlacesLoading, setMapPlacesLoading] = useState(false);
  const [quickPlacesActive, setQuickPlacesActive] = useState(false);
  const [googleBaseMapActive, setGoogleBaseMapActive] = useState(false);
  const [activeMapPanel, setActiveMapPanel] = useState<"places" | "layers" | null>(null);
  const [mapPlacesError, setMapPlacesError] = useState<string | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<PoiCategory[]>([...POI_CATEGORIES]);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);
  const dayPlan = useMemo(() => buildRouteStages(route, days, anchors, blueprint), [route, days, anchors, blueprint]);
  const dayRanges = dayPlan.stages;
  const routePlaces = useMemo(() => suggestedPlaces(poiDataset, route), [poiDataset, route]);

  useEffect(() => {
    if (!viewport) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setMapPlacesLoading(true);
      setMapPlacesError(null);
      setQuickPlacesActive(false);
      const [[west, south], [east, north]] = viewport.bounds;
      const center = { lat: (south + north) / 2, lon: (west + east) / 2 };
      const radiusM = Math.min(20_000, Math.max(750, Math.hypot((north - south) * 111_000, (east - west) * 111_000 * Math.cos(center.lat * Math.PI / 180)) / 2));
      let quickItems: MapPlace[] = [];
      try {
        const communityRequest = fetch(`/api/places?west=${west}&south=${south}&east=${east}&north=${north}&zoom=${viewport.zoom}`, { signal: controller.signal });
        if (googleBaseMapActive && viewport.zoom >= 10) {
          try {
            const quickResponse = await fetch("/api/places/quick", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...center, radiusM, bounds: viewport.bounds, zoom: viewport.zoom }),
              signal: controller.signal,
            });
            const quickResult = await quickResponse.json() as MapPlaceDataset & { error?: string };
            if (quickResponse.ok) {
              quickItems = quickResult.items;
              setMapPlaces(quickResult);
              setQuickPlacesActive(true);
            }
          } catch (reason) {
            if (reason instanceof Error && reason.name === "AbortError") throw reason;
          }
        }
        const response = await communityRequest;
        const result = (await response.json()) as MapPlaceDataset & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Visible places could not be loaded.");
        const seen = new Set<string>();
        const items = [...quickItems, ...result.items].filter((place) => {
          const key = `${place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}:${place.lat.toFixed(3)}:${place.lon.toFixed(3)}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setMapPlaces({ ...result, items });
        setQuickPlacesActive(false);
      } catch (reason) {
        if (reason instanceof Error && reason.name !== "AbortError" && quickItems.length === 0) setMapPlacesError(reason.message);
      } finally {
        if (!controller.signal.aborted) {
          setMapPlacesLoading(false);
          setQuickPlacesActive(false);
        }
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [googleBaseMapActive, viewport]);

  function resetPlanning(nextMode: "manual" | "copilot") {
    setMode(nextMode);
    setAnchors([]);
    setRoute(null);
    setBlueprint(null);
    setPoiDataset(null);
    setRouteNeedsRebuild(false);
    setDays(1);
    setError(null);
  }

  async function loadRoutePlaces(nextRoute: RouteDataset, routeAnchors: RouteAnchor[]) {
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

  function markAnchors(next: RouteAnchor[]) {
    setAnchors(next);
    setRouteNeedsRebuild(Boolean(route));
    setPoiDataset(null);
  }

  function addAnchor(lat: number, lon: number, label?: string, kind: RouteAnchor["kind"] = "via") {
    const next = [...anchors, { ...routeAnchor(label ?? coordinateName(lat, lon), lat, lon, anchors.length), kind }];
    markAnchors(next);
  }

  function moveAnchor(id: string, lat: number, lon: number) {
    markAnchors(anchors.map((anchor) => anchor.id === id ? { ...anchor, lat, lon, name: anchor.name.includes(",") ? coordinateName(lat, lon) : anchor.name } : anchor));
  }

  function reorderAnchor(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= anchors.length) return;
    const next = [...anchors];
    [next[index], next[target]] = [next[target], next[index]];
    markAnchors(next);
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

  const buildFromAnchors = useCallback(async () => {
    if (anchors.length < 2) return;
    setLoading(true);
    setError(null);
    try {
      const normalized = anchors.map((anchor, index) => ({
        ...anchor,
        kind: index === 0 ? "start" as const : index === anchors.length - 1 ? "finish" as const : anchor.kind === "overnight" ? "overnight" as const : "via" as const,
      }));
      const response = await fetch("/api/route/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, anchors: normalized, preferences }),
      });
      const result = (await response.json()) as { route?: RouteDataset; error?: string };
      if (!response.ok || !result.route) throw new Error(result.error ?? "The route could not be built.");
      setAnchors(normalized);
      setRoute(result.route);
      setRouteNeedsRebuild(false);
      void loadRoutePlaces(result.route, normalized);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The route could not be built.");
    } finally {
      setLoading(false);
    }
  }, [anchors, name, preferences]);

  async function buildCopilotRoute() {
    setLoading(true);
    setError(null);
    setRoute(null);
    setPoiDataset(null);
    try {
      const response = await fetch("/api/route/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, startLocation, preferences }),
      });
      const result = (await response.json()) as { blueprint?: CopilotBlueprint; route?: RouteDataset; anchors?: RouteAnchor[]; error?: string };
      if (!response.ok || !result.blueprint || !result.route || !result.anchors) throw new Error(result.error ?? "The Copilot could not create this route.");
      setName(result.blueprint.name);
      setBlueprint(result.blueprint);
      setDays(result.blueprint.days);
      setAnchors(result.anchors);
      setRoute(result.route);
      setRouteNeedsRebuild(false);
      void loadRoutePlaces(result.route, result.anchors);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Copilot could not create this route.");
    } finally {
      setLoading(false);
    }
  }

  function addSelectedPlace(kind: "via" | "overnight") {
    if (!selectedPlace) return;
    const anchor = { ...routeAnchor(selectedPlace.name, selectedPlace.lat, selectedPlace.lon, anchors.length), kind, day: kind === "overnight" ? Math.min(days, Math.max(1, anchors.filter((item) => item.kind === "overnight").length + 1)) : undefined };
    const finishIndex = anchors.findIndex((item) => item.kind === "finish");
    const next = [...anchors];
    next.splice(finishIndex > 0 ? finishIndex : next.length, 0, anchor);
    markAnchors(next);
    setSelectedPlace(null);
  }

  function save() {
    if (!route || routeNeedsRebuild) return;
    const now = new Date().toISOString();
    onSave({
      id: initialAdventure?.id ?? createAdventureId(),
      name: route.name,
      description: blueprint?.summary ?? `A custom cycling route with ${anchors.length} anchors.`,
      source: mode,
      createdAt: initialAdventure?.createdAt ?? now,
      updatedAt: now,
      days,
      route,
      anchors,
      blueprint: blueprint ?? undefined,
      preferences,
      visibility,
      access: initialAdventure?.access,
    }, poiDataset);
  }

  return (
    <div className="mx-auto max-w-[1740px] p-4 sm:p-6 xl:p-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <button onClick={onCancel} className="mb-4 flex items-center gap-2 text-[11px] font-semibold text-[#86b9b0]/70 transition hover:text-[#86b9b0]"><ArrowLeft className="size-3.5" /> Back to dashboard</button>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Adventure review & day planner</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{initialAdventure ? "Refine your expedition" : "Build a route your way"}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#d0d6d6]/46">Explore every visible place first, shape the route around useful stops, then review each day before saving.</p>
        </div>
        <div className="flex rounded-2xl border border-white/[0.08] bg-[#042630]/72 p-1.5">
          <button onClick={() => resetPlanning("manual")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "manual" ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/48 hover:text-white"}`}><MapPin className="size-4" /> Manual</button>
          <button onClick={() => resetPlanning("copilot")} className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${mode === "copilot" ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/48 hover:text-white"}`}><Sparkles className="size-4" /> Copilot</button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <article className="glass-panel rounded-[24px] p-5">
            <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]">{mode === "manual" ? <Route className="size-5" /> : <Bot className="size-5" />}</span><div><h3 className="text-sm font-semibold text-white">{mode === "manual" ? "Manual route" : "Expedition Copilot"}</h3><p className="text-[10px] text-[#d0d6d6]/38">{mode === "manual" ? "Click, search or choose a mapped place" : "GPT-5.6 Luna creates the first draft"}</p></div></div>
            {mode === "manual" ? <>
              <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Route name</label>
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/35" />
              <div className="mt-4 flex gap-2"><div className="flex min-w-0 flex-1 items-center rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 focus-within:border-[#86b9b0]/35"><Search className="size-4 shrink-0 text-[#4c7273]" /><input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void searchPlace(); }} placeholder="Search town or landmark" className="h-11 min-w-0 flex-1 bg-transparent px-2 text-xs text-white outline-none" /></div><button onClick={searchPlace} disabled={searchLoading} className="grid size-11 place-items-center rounded-xl bg-[#86b9b0] text-[#041421] disabled:opacity-50">{searchLoading ? <LoaderCircle className="size-4 animate-spin" /> : <LocateFixed className="size-4" />}</button></div>
              {searchResults.length > 0 && <div className="mt-2 space-y-1 rounded-xl border border-white/[0.07] bg-[#041421]/70 p-2">{searchResults.map((result) => <button key={result.id} onClick={() => { addAnchor(result.lat, result.lon, result.name); setSearchResults([]); }} className="flex w-full items-start gap-2 rounded-lg p-2 text-left transition hover:bg-white/[0.05]"><Plus className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" /><span><span className="block text-[11px] font-semibold text-white">{result.name}</span><span className="mt-0.5 line-clamp-2 block text-[9px] leading-4 text-[#d0d6d6]/38">{result.displayName}</span></span></button>)}</div>}
            </> : <>
              <label className="mt-5 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Start and finish base</label>
              <input value={startLocation} onChange={(event) => setStartLocation(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/35" />
              <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-[#86b9b0]/55">Describe the trip</label>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} className="mt-2 h-32 w-full resize-none rounded-xl border border-white/[0.08] bg-[#041421]/55 p-3 text-xs leading-6 text-white outline-none focus:border-[#86b9b0]/35" />
              <button onClick={buildCopilotRoute} disabled={loading || !prompt.trim() || !startLocation.trim()} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] disabled:opacity-35">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? "Planning and routing…" : "Create route with Copilot"}</button>
            </>}
          </article>

          <article className="glass-panel rounded-[24px] p-5">
            <div className="flex items-center gap-2"><Lock className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Route visibility</h3></div>
            <p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/38">Private routes are invite-only. Public routes can be viewed by everyone, but only contributors can edit.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">{(["private", "public"] as const).map((value) => <button key={value} onClick={() => setVisibility(value)} disabled={Boolean(initialAdventure && initialAdventure.access?.role !== "owner")} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-semibold capitalize transition disabled:cursor-not-allowed ${visibility === value ? "border-[#86b9b0]/45 bg-[#86b9b0]/12 text-white" : "border-white/[0.07] text-[#d0d6d6]/40"}`}>{value === "private" ? <Lock className="size-3.5" /> : <Globe2 className="size-3.5" />}{value}</button>)}</div>
          </article>

          <article className="glass-panel rounded-[24px] p-5">
            <div className="flex items-center gap-2"><Bike className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Routing preferences</h3></div>
            <div className="mt-4 grid grid-cols-3 gap-2">{(["Road", "Hybrid", "Mountain"] as const).map((value) => <button key={value} onClick={() => { setPreferences((current) => ({ ...current, bicycleType: value })); setRouteNeedsRebuild(Boolean(route)); }} className={`rounded-xl border px-2 py-2.5 text-[10px] font-semibold transition ${preferences.bicycleType === value ? "border-[#86b9b0]/45 bg-[#86b9b0]/12 text-white" : "border-white/[0.07] text-[#d0d6d6]/40"}`}>{value}</button>)}</div>
            <div className="mt-3 grid grid-cols-2 gap-2"><button onClick={() => { setPreferences((current) => ({ ...current, hillPreference: current.hillPreference === "avoid" ? "balanced" : "avoid" })); setRouteNeedsRebuild(Boolean(route)); }} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-[10px] font-semibold ${preferences.hillPreference === "avoid" ? "border-[#86b9b0]/45 bg-[#86b9b0]/12 text-white" : "border-white/[0.07] text-[#d0d6d6]/40"}`}><Mountain className="size-3.5" /> Avoid hills</button><button onClick={() => { setPreferences((current) => ({ ...current, roadPreference: current.roadPreference === "avoid_major" ? "balanced" : "avoid_major" })); setRouteNeedsRebuild(Boolean(route)); }} className={`rounded-xl border px-3 py-2.5 text-[10px] font-semibold ${preferences.roadPreference === "avoid_major" ? "border-[#86b9b0]/45 bg-[#86b9b0]/12 text-white" : "border-white/[0.07] text-[#d0d6d6]/40"}`}>Avoid major roads</button></div>
          </article>

          <article className="glass-panel rounded-[24px] p-5">
            <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold text-white">Route anchors</h3><p className="mt-1 text-[9px] text-[#d0d6d6]/34">Drag markers or reorder them here</p></div><span className="rounded-full bg-[#86b9b0]/10 px-2.5 py-1 text-[9px] font-bold text-[#86b9b0]">{anchors.length}</span></div>
            <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">{anchors.map((anchor, index) => <div key={anchor.id} className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#041421]/36 p-2.5"><span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#86b9b0] text-[9px] font-bold text-[#041421]">{index + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-white">{anchor.name}</p><p className="mt-0.5 text-[8px] uppercase text-[#d0d6d6]/28">{anchor.kind ?? "via"}</p></div><button onClick={() => reorderAnchor(index, -1)} disabled={index === 0} className="grid size-7 place-items-center rounded-lg text-[#d0d6d6]/35 disabled:opacity-20"><ArrowUp className="size-3" /></button><button onClick={() => reorderAnchor(index, 1)} disabled={index === anchors.length - 1} className="grid size-7 place-items-center rounded-lg text-[#d0d6d6]/35 disabled:opacity-20"><ArrowDown className="size-3" /></button><button onClick={() => markAnchors(anchors.filter((item) => item.id !== anchor.id))} className="grid size-7 place-items-center rounded-lg text-[#d0d6d6]/28 hover:text-rose-200"><Trash2 className="size-3" /></button></div>)}</div>
            {mode === "manual" && <button onClick={buildFromAnchors} disabled={loading || anchors.length < 2} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] disabled:opacity-35">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Bike className="size-4" />}{loading ? "Finding cycleable roads…" : route ? "Rebuild cycling route" : "Build cycling route"}</button>}
            {mode === "copilot" && routeNeedsRebuild && <button onClick={buildFromAnchors} disabled={loading || anchors.length < 2} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421]"><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} /> Apply edits and reroute</button>}
            {initialAdventure?.source === "gpx" && <p className="mt-3 text-[9px] leading-4 text-amber-100/45">Rebuilding replaces the imported GPX track with a new road-routed line through these anchors. The original GPX file is not changed.</p>}
          </article>
          {error && <div className="rounded-2xl border border-amber-200/15 bg-amber-200/[0.05] p-4 text-[11px] leading-5 text-amber-50/70">{error}</div>}
        </aside>

        <section className="overflow-hidden rounded-[26px] border border-white/[0.08] bg-[#042630]/62">
          <div className="relative min-h-[620px]">
            <RouteBuilderMap anchors={anchors} route={route} dayRanges={dayRanges} places={mapPlaces?.items ?? []} visibleCategories={visibleCategories} selectedPlaceId={selectedPlace?.id ?? null} onMapClick={(lat, lon) => { if (mode === "manual") addAnchor(lat, lon); }} onMoveAnchor={moveAnchor} onViewportChange={setViewport} onSelectPlace={setSelectedPlace} onGoogleBaseMapChange={setGoogleBaseMapActive} baseLayersOpen={activeMapPanel === "layers"} onBaseLayersOpenChange={(open) => setActiveMapPanel(open ? "layers" : null)} />
            <div className="absolute left-4 top-4 z-30">
              <button onClick={() => setActiveMapPanel((current) => current === "places" ? null : "places")} aria-expanded={activeMapPanel === "places"} className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.1] bg-[#041421]/92 px-3 text-[9px] font-semibold text-white shadow-xl backdrop-blur-xl">
                <Layers3 className="size-3.5 text-[#86b9b0]" /> Places <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[8px] text-[#d0d6d6]/55">{mapPlaces?.items.length ?? 0}</span>{mapPlacesLoading && <LoaderCircle className="size-3 animate-spin text-[#86b9b0]" />}
              </button>
              {activeMapPanel === "places" && <div className="absolute left-0 top-12 w-[min(560px,calc(100vw-5rem))] rounded-2xl border border-white/[0.1] bg-[#041421]/96 p-3 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold text-white">Explore places</p><p className="mt-1 text-[8px] text-[#d0d6d6]/34">{mapPlaces?.items.length ?? 0} visible{quickPlacesActive ? " · adding community places" : ""}</p></div><button onClick={() => setActiveMapPanel(null)} className="text-[8px] font-semibold text-[#86b9b0]">Done</button></div>
                <div className="mt-3 flex flex-wrap gap-1.5">{POI_CATEGORIES.map((category) => { const active = visibleCategories.includes(category); return <button key={category} onClick={() => setVisibleCategories((current) => active ? current.filter((item) => item !== category) : [...current, category])} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[8px] font-semibold transition ${active ? "border-white/[0.12] bg-white/[0.07] text-white" : "border-white/[0.05] text-[#d0d6d6]/26"}`}><span className="size-1.5 rounded-full" style={{ background: PLACE_COLORS[category] }} />{PLACE_LABELS[category]}</button>; })}</div>
                {mapPlaces?.zoomRequired && <p className="mt-2 text-[9px] text-amber-100/55">Zoom in to load every place in the visible area.</p>}
                {mapPlacesError && <p className="mt-2 text-[9px] text-amber-100/55">{mapPlacesError}</p>}
              </div>}
            </div>

            {selectedPlace && <article className="absolute bottom-4 left-4 z-10 w-[min(360px,calc(100%-2rem))] rounded-2xl border border-white/[0.1] bg-[#041421]/94 p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start gap-3"><span className="mt-0.5 size-3 shrink-0 rounded-full" style={{ background: PLACE_COLORS[selectedPlace.category] }} /><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">{selectedPlace.name}</p><p className="mt-1 text-[9px] uppercase tracking-wider text-[#86b9b0]/65">{PLACE_LABELS[selectedPlace.category]} · {selectedPlace.subcategory.replaceAll("_", " ")}</p></div><button onClick={() => setSelectedPlace(null)} className="text-[10px] text-[#d0d6d6]/35">Close</button></div>
              {selectedPlace.address && <p className="mt-3 flex gap-2 text-[10px] leading-5 text-[#d0d6d6]/48"><MapPin className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" />{selectedPlace.address}</p>}
              {selectedPlace.openingHours && <p className="mt-2 flex gap-2 text-[10px] leading-5 text-[#d0d6d6]/48"><Clock3 className="mt-0.5 size-3.5 shrink-0 text-[#86b9b0]" />Listed hours: {selectedPlace.openingHours}</p>}
              {selectedPlace.classificationStars && <p className="mt-2 flex items-center gap-2 text-[10px] text-[#d0d6d6]/48"><Star className="size-3.5 text-[#f2b766]" />{selectedPlace.classificationStars}-star property classification <span className="text-[#d0d6d6]/25">(not a user rating)</span></p>}
              <GooglePlaceDetailsCard place={selectedPlace} />
              <div className="mt-4 flex flex-wrap gap-2"><button onClick={() => addSelectedPlace("via")} className="rounded-lg bg-[#86b9b0] px-3 py-2 text-[9px] font-bold text-[#041421]">Add route anchor</button>{selectedPlace.category === "lodging" && <button onClick={() => addSelectedPlace("overnight")} className="rounded-lg border border-[#86b9b0]/25 px-3 py-2 text-[9px] font-bold text-[#86b9b0]">Use as overnight</button>}{selectedPlace.website && <a href={selectedPlace.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] text-[#d0d6d6]/60"><Globe2 className="size-3" /> Website</a>}{selectedPlace.phone && <a href={`tel:${selectedPlace.phone}`} className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] text-[#d0d6d6]/60"><Phone className="size-3" /> Call</a>}{selectedPlace.bookingSearchUrl && <a href={selectedPlace.bookingSearchUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] px-3 py-2 text-[9px] text-[#d0d6d6]/60"><ExternalLink className="size-3" /> Search Booking.com</a>}</div>
              <p className="mt-3 text-[8px] leading-4 text-[#d0d6d6]/25">{selectedPlace.source === "google_places" ? "Popular nearby result from Google Maps" : "OpenStreetMap listing"} · verify hours, access and booking availability directly.</p>
            </article>}
          </div>

          <div className="border-t border-white/[0.07] p-5">
            {route ? <div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center"><span className={`grid size-11 place-items-center rounded-xl ${routeNeedsRebuild ? "bg-amber-200/10 text-amber-100" : "bg-[#86b9b0]/12 text-[#86b9b0]"}`}>{routeNeedsRebuild ? <RefreshCw className="size-5" /> : <Check className="size-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-base font-semibold text-white">{route.name}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/38">{route.metrics.distanceKm} km · {route.metrics.ascentM.toLocaleString()} m ascent · {Math.floor(route.metrics.estimatedMovingMinutes / 60)}h {route.metrics.estimatedMovingMinutes % 60}m routed time</p>{routeNeedsRebuild && <p className="mt-1 text-[9px] text-amber-100/55">Anchors or preferences changed. Reroute before saving.</p>}</div><label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-[#041421]/42 px-3 py-2 text-[10px] text-[#d0d6d6]/48">Days <input type="number" min={1} max={7} value={days} onChange={(event) => setDays(Math.max(1, Math.min(7, Number(event.target.value))))} className="w-10 bg-transparent text-center font-bold text-white outline-none" /></label><button onClick={save} disabled={routeNeedsRebuild} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421] disabled:cursor-not-allowed disabled:opacity-35"><Plus className="size-4" /> {initialAdventure ? "Save revision" : "Save and open route"}</button></div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">{dayRanges.map((stage) => { const planned = blueprint?.dailyPlan.find((item) => item.day === stage.day); return <article key={stage.day} className="rounded-2xl border border-white/[0.07] bg-[#041421]/34 p-4"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-wider" style={{ color: DAY_COLORS[(stage.day - 1) % DAY_COLORS.length] }}>Day {stage.day}</p><span className="text-[9px] text-[#d0d6d6]/32">{stage.startKm.toFixed(0)}–{stage.endKm.toFixed(0)} km</span></div><p className="mt-2 text-xs font-semibold text-white">{planned?.title ?? `${stage.distanceKm.toFixed(0)} km stage`}</p><p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/40">{stage.distanceKm.toFixed(1)} km · {stage.ascentM.toLocaleString()} m up · {Math.floor(stage.estimatedMovingMinutes / 60)}h {stage.estimatedMovingMinutes % 60}m</p>{planned?.summary && <p className="mt-2 line-clamp-3 text-[9px] leading-4 text-[#d0d6d6]/30">{planned.summary}</p>}</article>; })}</div>

              <div className="mt-5"><div className="flex items-center gap-2"><TentTree className="size-4 text-[#86b9b0]" /><p className="text-xs font-semibold text-white">Route-specific lodging and resupply</p>{placesLoading && <LoaderCircle className="size-3.5 animate-spin text-[#86b9b0]" />}</div>{routePlaces.length > 0 ? <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">{routePlaces.map((poi) => <article key={poi.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#041421]/30 p-3"><MapPin className="size-4 shrink-0 text-[#86b9b0]" /><div className="min-w-0"><p className="truncate text-[10px] font-semibold text-white">{poi.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/35">{poi.category} · {poi.distanceIntoRouteKm.toFixed(1)} km</p></div></article>)}</div> : !placesLoading && <p className="mt-2 text-[10px] text-[#d0d6d6]/34">Zoom and explore the map to choose places before finalising the route.</p>}</div>
            </div> : <div className="flex items-center gap-3 text-[#d0d6d6]/38"><Globe2 className="size-4" /><p className="text-xs">Explore the visible places, then add route anchors or ask Copilot for a complete plan.</p></div>}
          </div>
        </section>
      </div>
    </div>
  );
}
