"use client";

import dynamic from "next/dynamic";
import {
  AlertTriangle,
  Bell,
  Bike,
  CalendarDays,
  ChevronDown,
  CircleGauge,
  CloudSun,
  Compass,
  CheckCircle2,
  Download,
  Filter,
  Flag,
  Gauge,
  Layers3,
  LoaderCircle,
  Map,
  MapPin,
  Menu,
  Mountain,
  Navigation,
  Plus,
  PencilLine,
  Route,
  Search,
  Settings,
  ShieldAlert,
  LogOut,
  Sparkles,
  TentTree,
  Timer,
  Trash2,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import ElevationProfile from "@/components/dashboard/ElevationProfile";
import AdventureCreator from "@/components/planner/AdventureCreator";
import GooglePlaceDetailsCard from "@/components/places/GooglePlaceDetailsCard";
import AccommodationDashboard from "@/components/logistics/AccommodationDashboard";
import PhaseBWorkspace, { type LogisticsWorkspaceName } from "@/components/logistics/PhaseBWorkspace";
import ReadinessWorkspace from "@/components/readiness/ReadinessWorkspace";
import RouteLibrary from "@/components/routes/RouteLibrary";
import WeatherWorkspace from "@/components/weather/WeatherWorkspace";
import { deleteAdventure, loadAdventures, replaceLocalAdventures, saveAdventure } from "@/lib/adventures";
import { cloudAdventureId, deleteCloudAdventure, loadCloudAdventures, saveCloudAdventure } from "@/lib/cloudAdventures";
import { buildItinerary, buildItineraryGpx, findItineraryWarnings, formatClock, suggestRouteStops } from "@/lib/itinerary";
import type { AnalysisResponse, RouteAnalysis } from "@/types/analysis";
import type { AdventurePlan, RouteAnchor } from "@/types/adventure";
import type { ExpeditionProfile } from "@/types/profile";
import { POI_CATEGORIES, type PoiCategory, type PoiDataset, type RoutePoi } from "@/types/poi";
import type { RouteDataset, RoutePoint } from "@/types/route";
import type { CopilotReadinessEvidencePacket } from "@/types/strava";

const ExpeditionMap = dynamic(() => import("@/components/map/ExpeditionMap"), {
  ssr: false,
  loading: () => <div className="pulse-soft h-full min-h-[420px] bg-[#0a303a]" />,
});

type Icon = ComponentType<{ className?: string; strokeWidth?: number }>;
type WorkspaceTab = "Route Intelligence" | "Accommodation" | "Weather";

const navigation: { label: string; icon: Icon }[] = [
  { label: "Dashboard", icon: CircleGauge },
  { label: "Plan adventure", icon: Sparkles },
  { label: "My routes", icon: Route },
  { label: "Readiness", icon: Gauge },
  { label: "Stays", icon: TentTree },
  { label: "Gear", icon: Bike },
  { label: "Funds", icon: WalletCards },
];

const tabs: WorkspaceTab[] = ["Route Intelligence", "Accommodation", "Weather"];

const poiLabels: Record<PoiCategory, string> = {
  fuel: "Fuel",
  food: "Food & cafés",
  groceries: "Groceries",
  shopping: "Shops",
  water: "Drinking water",
  repair: "Bike repair",
  pharmacy: "Pharmacies",
  toilets: "Toilets",
  attraction: "Highlights",
  lodging: "Lodging",
};

const poiColors: Record<PoiCategory, string> = {
  fuel: "#f2b766",
  food: "#d87979",
  groceries: "#86b9b0",
  shopping: "#e4a6c8",
  water: "#55a8d7",
  repair: "#9d83c6",
  pharmacy: "#e66b7b",
  toilets: "#d0d6d6",
  attraction: "#b8d36b",
  lodging: "#c9a277",
};

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function MetricCard({
  icon: MetricIcon,
  label,
  value,
  note,
  delay,
}: {
  icon: Icon;
  label: string;
  value: string;
  note: string;
  delay: number;
}) {
  return (
    <article className="soft-panel rise-in rounded-2xl p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-5 flex items-start justify-between">
        <span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]">
          <MetricIcon className="size-[18px]" strokeWidth={1.8} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86b9b0]/55">Route</span>
      </div>
      <p className="text-xs font-medium text-[#d0d6d6]/52">{label}</p>
      <p className="mt-1 text-[1.6rem] font-semibold tracking-[-0.035em] text-white">{value}</p>
      <p className="mt-1 text-[11px] text-[#d0d6d6]/38">{note}</p>
    </article>
  );
}

function Sidebar({
  active,
  onChange,
  open,
  onClose,
  profile,
  onOpenProfile,
  onSignOut,
}: {
  active: string;
  onChange: (label: string) => void;
  open: boolean;
  onClose: () => void;
  profile: ExpeditionProfile;
  onOpenProfile: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col border-r border-white/[0.07] bg-[#042630] px-4 py-5 shadow-2xl transition-transform duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="flex h-12 items-center justify-between px-2">
        <button className="flex items-center gap-3" onClick={() => onChange("Dashboard")}>
          <span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0] text-[#041421] shadow-[0_8px_24px_rgba(134,185,176,0.2)]">
            <Mountain className="size-5" strokeWidth={2.4} />
          </span>
          <span className="text-[15px] font-bold tracking-[-0.02em] text-white">
            Expedition<span className="font-medium text-[#86b9b0]">OS</span>
          </span>
        </button>
        <button
          className="grid size-9 place-items-center rounded-xl text-[#d0d6d6]/55 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="mt-8 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#d0d6d6]/32">
        Expedition
      </div>
      <nav className="mt-3 space-y-1">
        {navigation.map((item) => {
          const NavIcon = item.icon;
          const isActive = active === item.label;
          return (
            <button
              key={item.label}
              onClick={() => {
                onChange(item.label);
                onClose();
              }}
              className={`group relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] font-medium transition-all duration-200 ${
                isActive
                  ? "bg-[#86b9b0]/12 text-white"
                  : "text-[#d0d6d6]/52 hover:bg-white/[0.045] hover:text-[#d0d6d6]"
              }`}
            >
              {isActive && <span className="absolute -left-4 h-6 w-[3px] rounded-r-full bg-[#86b9b0]" />}
              <NavIcon className={`size-[18px] ${isActive ? "text-[#86b9b0]" : "text-[#4c7273] group-hover:text-[#86b9b0]"}`} strokeWidth={1.8} />
              {item.label}
              {item.label === "Plan adventure" && (
                <span className="ml-auto rounded-full bg-[#86b9b0]/12 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">
                  AI
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="mb-4 rounded-2xl border border-[#86b9b0]/12 bg-[#041421]/48 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-[#86b9b0]">
            <Zap className="size-3.5" fill="currentColor" />
            Readiness baseline
          </div>
          <p className="mt-2 text-xs leading-5 text-[#d0d6d6]/48">Connect Strava to compare this route with your recent training.</p>
          <button onClick={() => { onChange("Readiness"); onClose(); }} className="mt-3 text-[11px] font-semibold text-[#d0d6d6] transition hover:text-white">Connect account →</button>
        </div>
        <button onClick={onOpenProfile} className="mb-1 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-white/[0.045]">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/12 text-xs font-bold text-[#86b9b0]">{profile.firstName.slice(0, 1)}{profile.lastName.slice(0, 1)}</span>
          <span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{profile.displayName || profile.firstName}</span><span className="block truncate text-[9px] text-[#d0d6d6]/30">Profile & safety</span></span>
        </button>
        <button onClick={onOpenProfile} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[12px] font-medium text-[#d0d6d6]/48 transition hover:bg-white/[0.045] hover:text-white">
          <Settings className="size-[18px] text-[#4c7273]" strokeWidth={1.8} />
          Settings
        </button>
        <button onClick={onSignOut} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-[12px] font-medium text-[#d0d6d6]/35 transition hover:bg-white/[0.045] hover:text-rose-100">
          <LogOut className="size-[18px] text-[#4c7273]" strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}

function LoadingDashboard() {
  return (
    <div className="grid min-h-screen place-items-center bg-[#041421] px-6">
      <div className="text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#86b9b0]/12 text-[#86b9b0] pulse-soft">
          <Mountain className="size-7" />
        </span>
        <p className="mt-4 text-sm font-medium text-[#d0d6d6]/70">Loading your expedition route…</p>
      </div>
    </div>
  );
}

function AnalysisDrawer({
  analysis,
  places,
  model,
  error,
  loading,
  routeName,
  onClose,
}: {
  analysis: RouteAnalysis | null;
  places: RoutePoi[];
  model: string | null;
  error: string | null;
  loading: boolean;
  routeName: string;
  onClose: () => void;
}) {
  const verdictTone = analysis?.verdict === "High risk" ? "text-amber-200 bg-amber-300/10" : "text-[#86b9b0] bg-[#86b9b0]/10";

  return (
    <>
      <button className="fixed inset-0 z-[60] bg-[#041421]/76 backdrop-blur-sm" onClick={onClose} aria-label="Close route analysis" />
      <section
        className="fixed inset-y-0 right-0 z-[70] w-full max-w-[560px] overflow-y-auto border-l border-white/[0.08] bg-[#041421] shadow-[-30px_0_80px_rgba(0,0,0,0.38)] rise-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="analysis-title"
      >
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/[0.07] bg-[#041421]/92 px-5 py-4 backdrop-blur-xl sm:px-7">
          <span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><Sparkles className="size-5" /></span>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">OpenAI route intelligence</p>
            <h2 id="analysis-title" className="mt-0.5 text-base font-semibold text-white">{routeName}</h2>
          </div>
          {model && <span className="ml-auto rounded-full bg-[#86b9b0]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">{model.endsWith("luna") ? "Luna" : model.endsWith("terra") ? "Terra" : model}</span>}
          <button onClick={onClose} className="grid size-9 place-items-center rounded-xl border border-white/[0.08] text-[#d0d6d6]/55 transition hover:bg-white/[0.05] hover:text-white" aria-label="Close analysis panel">
            <X className="size-4" />
          </button>
        </header>

        <div className="p-5 sm:p-7">
          {loading && (
            <div className="grid min-h-[520px] place-items-center text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#86b9b0]/10 text-[#86b9b0]"><LoaderCircle className="size-7 animate-spin" /></span>
                <h3 className="mt-5 text-lg font-semibold text-white">Analyzing the route</h3>
                <p className="mx-auto mt-2 max-w-xs text-xs leading-5 text-[#d0d6d6]/42">Reviewing distance, climbing, grade, mapped places and the full elevation profile.</p>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="rounded-3xl border border-amber-200/12 bg-amber-200/[0.04] p-6 text-center">
              <AlertTriangle className="mx-auto size-8 text-amber-200/75" />
              <h3 className="mt-4 text-base font-semibold text-white">Analysis unavailable</h3>
              <p className="mt-2 text-xs leading-6 text-[#d0d6d6]/52">{error}</p>
            </div>
          )}

          {!loading && analysis && (
            <div className="space-y-5">
              <article className="glass-panel rounded-3xl p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.12em] ${verdictTone}`}>{analysis.verdict}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#d0d6d6]/35">{analysis.confidence} confidence</span>
                </div>
                <p className="mt-4 text-sm leading-7 text-[#d0d6d6]/76">{analysis.summary}</p>
              </article>

              <div className="grid grid-cols-2 gap-3">
                {analysis.highlights.map((highlight) => (
                  <article key={`${highlight.label}-${highlight.value}`} className="soft-panel rounded-2xl p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#86b9b0]/58">{highlight.label}</p>
                    <p className="mt-2 text-lg font-semibold tracking-[-0.02em] text-white">{highlight.value}</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#d0d6d6]/38">{highlight.note}</p>
                  </article>
                ))}
              </div>

              {places.length > 0 && (
                <article className="glass-panel rounded-3xl p-5">
                  <div className="flex items-center gap-2"><MapPin className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Recommended route stops</h3></div>
                  <div className="mt-4 space-y-3">
                    {places.map((place) => (
                      <a key={place.id} href={`https://www.openstreetmap.org/${place.osmType}/${place.osmId}`} target="_blank" rel="noreferrer" className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-[#041421]/42 p-4 transition hover:border-[#86b9b0]/25">
                        <span className="mt-1 size-2.5 shrink-0 rounded-full" style={{ background: poiColors[place.category] }} />
                        <span>
                          <span className="block text-xs font-semibold text-white">{place.name}</span>
                          <span className="mt-1 block text-[10px] text-[#d0d6d6]/44">At {place.distanceIntoRouteKm.toFixed(1)} km · {place.distanceFromRouteKm.toFixed(1)} km off route · OpenStreetMap</span>
                        </span>
                      </a>
                    ))}
                  </div>
                </article>
              )}

              <article className="glass-panel rounded-3xl p-5">
                <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Risks to resolve</h3></div>
                <div className="mt-4 space-y-3">
                  {analysis.risks.map((risk) => (
                    <div key={risk.title} className="rounded-2xl border border-white/[0.07] bg-[#041421]/42 p-4">
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${risk.severity === "high" ? "bg-amber-300" : risk.severity === "medium" ? "bg-[#86b9b0]" : "bg-[#4c7273]"}`} />
                        <p className="text-xs font-semibold text-white">{risk.title}</p>
                        <span className="ml-auto text-[9px] font-bold uppercase tracking-wider text-[#d0d6d6]/30">{risk.severity}</span>
                      </div>
                      <p className="mt-2 text-[11px] leading-5 text-[#d0d6d6]/45">{risk.detail}</p>
                      <p className="mt-2 text-[11px] leading-5 text-[#86b9b0]/72"><span className="font-semibold">Plan:</span> {risk.mitigation}</p>
                    </div>
                  ))}
                </div>
              </article>

              <article className="glass-panel rounded-3xl p-5">
                <div className="flex items-center gap-2"><CheckCircle2 className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Recommended next steps</h3></div>
                <ol className="mt-4 space-y-3">
                  {analysis.recommendations.map((recommendation, index) => (
                    <li key={recommendation} className="flex gap-3 text-[11px] leading-5 text-[#d0d6d6]/58">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#86b9b0]/10 text-[9px] font-bold text-[#86b9b0]">{index + 1}</span>
                      {recommendation}
                    </li>
                  ))}
                </ol>
              </article>

              <div className="grid gap-4 sm:grid-cols-2">
                <article className="soft-panel rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-white">Training focus</h3>
                  <ul className="mt-3 space-y-2 text-[10px] leading-4 text-[#d0d6d6]/48">
                    {analysis.trainingFocus.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </article>
                <article className="soft-panel rounded-2xl p-4">
                  <h3 className="text-xs font-semibold text-white">Important assumptions</h3>
                  <ul className="mt-3 space-y-2 text-[10px] leading-4 text-[#d0d6d6]/48">
                    {analysis.assumptions.map((item) => <li key={item}>• {item}</li>)}
                  </ul>
                </article>
              </div>

              <p className="px-2 text-[9px] leading-4 text-[#d0d6d6]/25">AI planning guidance is based on the active route and is not a safety guarantee. Confirm access, conditions and emergency plans locally before riding.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default function ExpeditionDashboard({ userId, profile, onOpenProfile, onSignOut }: { userId: string; profile: ExpeditionProfile; onOpenProfile: () => void; onSignOut: () => void }) {
  const [route, setRoute] = useState<RouteDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("Route Intelligence");
  const [terrainEnabled, setTerrainEnabled] = useState(true);
  const [focusPoint, setFocusPoint] = useState<RoutePoint | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [poiDataset, setPoiDataset] = useState<PoiDataset | null>(null);
  const [poiError, setPoiError] = useState<string | null>(null);
  const [poiLoading, setPoiLoading] = useState(true);
  const [visiblePoiCategories, setVisiblePoiCategories] = useState<PoiCategory[]>([...POI_CATEGORIES]);
  const [selectedPoi, setSelectedPoi] = useState<RoutePoi | null>(null);
  const [plannedPoiIds, setPlannedPoiIds] = useState<string[]>([]);
  const [itineraryStartTime, setItineraryStartTime] = useState("07:00");
  const [itineraryLoading, setItineraryLoading] = useState(false);
  const [itineraryStatus, setItineraryStatus] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisPlaces, setAnalysisPlaces] = useState<RoutePoi[]>([]);
  const [analysisModel, setAnalysisModel] = useState<string | null>(null);
  const [analysisRouteName, setAnalysisRouteName] = useState<string | null>(null);
  const [copilotQuestion, setCopilotQuestion] = useState("");
  const [adventures, setAdventures] = useState<AdventurePlan[]>([]);
  const [editingAdventure, setEditingAdventure] = useState<AdventurePlan | null>(null);
  const [cloudStatus, setCloudStatus] = useState("Syncing routes…");

  useEffect(() => {
    const view = new URLSearchParams(window.location.search).get("view");
    if (view === "readiness") queueMicrotask(() => setActiveNav("Readiness"));
  }, []);

  useEffect(() => {
    let active = true;
    async function syncRoutes() {
      try {
        const local = loadAdventures(userId);
        let cloud = await loadCloudAdventures(userId);
        const cloudIds = new Set(cloud.map((adventure) => adventure.id));
        const pendingImports = local.filter((adventure) => !adventure.access && !cloudIds.has(cloudAdventureId(adventure.id, userId)));
        if (pendingImports.length) {
          await Promise.all(pendingImports.map((adventure) => saveCloudAdventure(adventure, userId)));
          cloud = await loadCloudAdventures(userId);
        }
        if (active) {
          setAdventures(replaceLocalAdventures(cloud, userId));
          setCloudStatus(pendingImports.length ? `${pendingImports.length} browser route${pendingImports.length === 1 ? "" : "s"} moved to your account` : "Routes synced securely");
        }
      } catch {
        if (active) {
          setAdventures(loadAdventures(userId));
          setCloudStatus("Offline — your private browser copy is in use");
        }
      }
    }
    syncRoutes();
    return () => { active = false; };
  }, [userId]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/routes/summit-leg-breaker", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The Summit Leg Breaker route could not be loaded.");
        return (await response.json()) as RouteDataset;
      })
      .then(setRoute)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!route) return;
    const controller = new AbortController();
    const routeAnchors = adventures.find((adventure) => adventure.route.id === route.id)?.anchors ?? [];
    queueMicrotask(() => {
      if (controller.signal.aborted) return;
      setPoiLoading(true);
      setPoiDataset(null);
      setPoiError(null);
      setSelectedPoi(null);
      setPlannedPoiIds([]);
    });
    const request = route.id === "summit-leg-breaker"
      ? fetch("/api/pois?corridorKm=1.5", { signal: controller.signal })
      : fetch("/api/pois", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ route, anchors: routeAnchors, corridorKm: 2 }),
          signal: controller.signal,
        });
    request
      .then(async (response) => {
        const result = (await response.json()) as PoiDataset & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Live route services could not be loaded.");
        return result;
      })
      .then((result) => {
        setPoiDataset(result);
        setPoiError(null);
      })
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name !== "AbortError") setPoiError(reason.message);
      })
      .finally(() => setPoiLoading(false));
    return () => controller.abort();
  }, [route, adventures]);

  const summitPoint = useMemo(
    () => route?.points.reduce((highest, point) => (point.elevationM > highest.elevationM ? point : highest)),
    [route],
  );

  const plannedStops = useMemo(
    () => (poiDataset?.items ?? []).filter((poi) => plannedPoiIds.includes(poi.id)).sort((a, b) => a.distanceIntoRouteKm - b.distanceIntoRouteKm),
    [poiDataset, plannedPoiIds],
  );

  const itinerary = useMemo(
    () => route ? buildItinerary(plannedStops, route, itineraryStartTime) : null,
    [plannedStops, route, itineraryStartTime],
  );

  const itineraryWarnings = useMemo(
    () => route ? findItineraryWarnings(plannedStops, route.metrics.distanceKm) : [],
    [plannedStops, route],
  );

  function togglePlannedPoi(poi: RoutePoi) {
    setPlannedPoiIds((current) => current.includes(poi.id) ? current.filter((id) => id !== poi.id) : [...current, poi.id]);
    setItineraryStatus(null);
  }

  async function suggestItinerary() {
    if (!route || !poiDataset) return;
    setItineraryLoading(true);
    setItineraryStatus(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: "Select a balanced set of mapped fuel, drinking water, food and grocery stops for this ride. Spread them across the route, prefer places close to the track, and return their exact place IDs.",
          route,
          routeAnchors: adventures.find((adventure) => adventure.route.id === route.id)?.anchors ?? [],
        }),
      });
      const result = (await response.json()) as Partial<AnalysisResponse> & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Copilot could not suggest stops.");
      const suggestions = result.places?.length ? result.places : suggestRouteStops(poiDataset.items, route.metrics.distanceKm);
      setPlannedPoiIds(suggestions.map((poi) => poi.id));
      setAnalysis(result.analysis ?? null);
      setAnalysisPlaces(result.places ?? []);
      setAnalysisModel(result.model ?? null);
      setItineraryStatus(`${suggestions.length} route-aware stops suggested by ${result.model?.endsWith("luna") ? "Luna" : "the Copilot"}.`);
    } catch {
      const suggestions = suggestRouteStops(poiDataset.items, route.metrics.distanceKm);
      setPlannedPoiIds(suggestions.map((poi) => poi.id));
      setItineraryStatus(`${suggestions.length} balanced stops suggested from mapped route services.`);
    } finally {
      setItineraryLoading(false);
    }
  }

  async function requestAnalysis(question?: string, readinessEvidence?: CopilotReadinessEvidencePacket, routeOverride?: RouteDataset, anchorsOverride?: RouteAnchor[]) {
    const analysisRoute = routeOverride ?? route;
    if (!analysisRoute) return;
    setAnalysisOpen(true);
    setAnalysisLoading(true);
    setAnalysisError(null);
    setAnalysisRouteName(analysisRoute.name);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: question?.trim() || undefined,
          route: analysisRoute,
          routeAnchors: anchorsOverride ?? adventures.find((adventure) => adventure.route.id === analysisRoute.id)?.anchors ?? [],
          readinessEvidence,
        }),
      });
      const result = (await response.json()) as Partial<AnalysisResponse> & { error?: string };
      if (!response.ok || !result.analysis) throw new Error(result.error ?? "The route analysis could not be completed.");
      setAnalysis(result.analysis);
      setAnalysisPlaces(result.places ?? []);
      setAnalysisModel(result.model ?? null);
    } catch (reason) {
      setAnalysisError(reason instanceof Error ? reason.message : "The route analysis could not be completed.");
    } finally {
      setAnalysisLoading(false);
    }
  }

  function openAdventure(adventure: AdventurePlan) {
    setEditingAdventure(null);
    setRoute(adventure.route);
    setAnalysis(null);
    setAnalysisPlaces([]);
    setFocusPoint(null);
    setActiveNav("Dashboard");
  }

  async function storeAdventure(adventure: AdventurePlan, initialPois: PoiDataset | null) {
    setAdventures(saveAdventure(adventure, userId));
    setRoute(adventure.route);
    setPoiDataset(initialPois);
    setAnalysis(null);
    setAnalysisPlaces([]);
    setFocusPoint(null);
    setEditingAdventure(null);
    setActiveNav("Dashboard");
    setCloudStatus("Saving route…");
    try {
      await saveCloudAdventure(adventure, userId);
      setAdventures(replaceLocalAdventures(await loadCloudAdventures(userId), userId));
      setCloudStatus("Route saved to your account");
    } catch {
      setCloudStatus("Cloud save failed — browser copy retained");
    }
  }

  function editCurrentRoute() {
    if (!route) return;
    const saved = adventures.find((adventure) => adventure.route.id === route.id);
    const now = new Date().toISOString();
    setEditingAdventure(saved ?? {
      id: `adventure-${route.id}`,
      name: route.name,
      description: "Imported GPX route ready for review and editing.",
      source: "gpx",
      createdAt: now,
      updatedAt: now,
      days: 1,
      visibility: "private",
      route,
      anchors: [
        { id: `anchor-${route.id}-start`, name: "Route start", lat: route.start.lat, lon: route.start.lon, kind: "start" },
        { id: `anchor-${route.id}-finish`, name: "Route finish", lat: route.finish.lat, lon: route.finish.lon, kind: "finish" },
      ],
    });
    setActiveNav("Plan adventure");
  }

  function navigate(label: string) {
    if (label === "Plan adventure") setEditingAdventure(null);
    setActiveNav(label);
  }

  async function updateTripSchedule(startsOn: string | undefined, departureTime: string) {
    const saved = adventures.find((adventure) => adventure.route.id === route?.id);
    if (!saved) throw new Error("Save this route before setting its trip schedule.");
    if (saved.access?.role === "viewer") throw new Error("Viewers cannot change the trip schedule.");
    const updated: AdventurePlan = { ...saved, startsOn, departureTime, updatedAt: new Date().toISOString() };
    setAdventures(saveAdventure(updated, userId));
    setCloudStatus("Saving trip schedule…");
    try {
      await saveCloudAdventure(updated, userId);
      setAdventures(replaceLocalAdventures(await loadCloudAdventures(userId), userId));
      setCloudStatus("Trip schedule saved");
    } catch (reason) {
      setCloudStatus("Trip schedule cloud save failed");
      throw reason;
    }
  }

  async function removeAdventure(id: string) {
    setAdventures(deleteAdventure(id, userId));
    try {
      await deleteCloudAdventure(id);
      setAdventures(replaceLocalAdventures(await loadCloudAdventures(userId), userId));
      setCloudStatus("Route removed");
    } catch {
      setCloudStatus("Only trip owners can remove shared routes");
    }
  }

  async function refreshCloudRoutes() {
    setAdventures(replaceLocalAdventures(await loadCloudAdventures(userId), userId));
    setCloudStatus("Routes synced securely");
  }

  function exportItinerary() {
    if (!route) return;
    const contents = buildItineraryGpx(route, plannedStops);
    const blob = new Blob([contents], { type: "application/gpx+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${route.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "expedition"}-itinerary.gpx`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#041421] px-6">
        <div className="glass-panel max-w-md rounded-3xl p-8 text-center">
          <Mountain className="mx-auto size-9 text-[#86b9b0]" />
          <h1 className="mt-4 text-xl font-semibold text-white">Route unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-[#d0d6d6]/58">{error}</p>
        </div>
      </main>
    );
  }

  if (!route) return <LoadingDashboard />;

  const metrics = route.metrics;
  const selectedPoint = focusPoint ?? summitPoint;
  const activeAdventure = adventures.find((adventure) => adventure.route.id === route.id);
  const canEditActiveRoute = activeAdventure?.access?.role !== "viewer";

  const logisticsWorkspace = (["Stays", "Gear", "Funds"] as LogisticsWorkspaceName[]).find((name) => name === activeNav);

  if (activeNav === "Plan adventure" || activeNav === "My routes" || activeNav === "Readiness" || logisticsWorkspace) {
    return (
      <div className="min-h-screen bg-[#041421] text-[#d0d6d6] lg:flex">
        {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
        <Sidebar active={activeNav} onChange={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} profile={profile} onOpenProfile={onOpenProfile} onSignOut={onSignOut} />
        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-white/[0.06] bg-[#041421]/88 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
            <button onClick={() => setSidebarOpen(true)} className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-[#042630] text-[#d0d6d6]/70 lg:hidden" aria-label="Open navigation"><Menu className="size-5" /></button>
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86b9b0]/48">Workspace</p><h1 className="text-[15px] font-semibold tracking-[-0.01em] text-white">{activeNav}</h1></div>
            {activeNav !== "Readiness" && !logisticsWorkspace && <button onClick={() => { setEditingAdventure(null); setActiveNav("Plan adventure"); }} className="ml-auto hidden h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#042630]/68 px-4 text-xs font-semibold text-[#d0d6d6]/64 transition hover:text-white sm:flex"><Plus className="size-4 text-[#86b9b0]" /> New route</button>}
            {(activeNav === "Readiness" || logisticsWorkspace) && <span className="ml-auto" />}
            <button className="relative grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-[#042630]/68 text-[#d0d6d6]/58" aria-label="Notifications"><Bell className="size-[18px]" /></button>
          </header>
          {activeNav === "Plan adventure" ? (
            <AdventureCreator initialAdventure={editingAdventure} onCancel={() => { setEditingAdventure(null); setActiveNav("Dashboard"); }} onSave={storeAdventure} />
          ) : activeNav === "Readiness" ? (
            <ReadinessWorkspace profile={profile} adventures={adventures} activeRoute={route} onAnalyzeEvidence={(packet, selectedRoute, anchors) => requestAnalysis("Explain the most important preparation gaps for this route using my deterministic readiness evidence. Keep the readiness score unchanged and distinguish measured evidence from advice.", packet, selectedRoute, anchors)} />
          ) : logisticsWorkspace ? (
            <PhaseBWorkspace name={logisticsWorkspace} adventure={activeAdventure} pois={poiDataset?.items ?? []} />
          ) : (
            <RouteLibrary adventures={adventures} syncStatus={cloudStatus} currentUserId={userId} onOpen={openAdventure} onCreate={() => { setEditingAdventure(null); setActiveNav("Plan adventure"); }} onDelete={removeAdventure} onRefresh={refreshCloudRoutes} />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#041421] text-[#d0d6d6] lg:flex">
      {sidebarOpen && <button className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close navigation overlay" />}
      <Sidebar active={activeNav} onChange={navigate} open={sidebarOpen} onClose={() => setSidebarOpen(false)} profile={profile} onOpenProfile={onOpenProfile} onSignOut={onSignOut} />

      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-[76px] items-center gap-3 border-b border-white/[0.06] bg-[#041421]/88 px-4 backdrop-blur-xl sm:px-6 xl:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-[#042630] text-[#d0d6d6]/70 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#86b9b0]/48">Workspace</p>
            <h1 className="text-[15px] font-semibold tracking-[-0.01em] text-white">Expedition dashboard</h1>
          </div>
          <div className="ml-auto hidden w-full max-w-[370px] items-center rounded-xl border border-white/[0.07] bg-[#042630]/68 px-3 transition focus-within:border-[#86b9b0]/35 md:flex">
            <Search className="size-4 text-[#4c7273]" />
            <input
              className="h-10 w-full bg-transparent px-3 text-xs text-white outline-none placeholder:text-[#d0d6d6]/30"
              placeholder="Search routes, places or stays"
              aria-label="Search Expedition OS"
            />
            <span className="rounded-md border border-white/[0.08] px-1.5 py-0.5 text-[9px] text-[#d0d6d6]/35">⌘K</span>
          </div>
          <button className="relative grid size-10 place-items-center rounded-xl border border-white/[0.07] bg-[#042630]/68 text-[#d0d6d6]/58 transition hover:text-white" aria-label="Notifications">
            <Bell className="size-[18px]" strokeWidth={1.7} />
            <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-[#86b9b0]" />
          </button>
          <button onClick={onOpenProfile} className="flex items-center gap-2 rounded-xl p-1.5 pr-2 text-left transition hover:bg-white/[0.04]">
            <span className="grid size-8 place-items-center rounded-lg bg-[#4c7273]/30 text-[10px] font-bold text-[#86b9b0]">{profile.firstName.slice(0, 1)}{profile.lastName.slice(0, 1)}</span>
            <ChevronDown className="hidden size-3.5 text-[#d0d6d6]/35 sm:block" />
          </button>
        </header>

        <div className="mx-auto max-w-[1740px] p-4 sm:p-6 xl:p-8">
          <section className="rise-in flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-[#86b9b0]/65">
                <Compass className="size-3.5" />
                {route.source.toLowerCase().includes("gpx") ? "Lady's Slipper · Eastern Cape" : route.source.includes("Copilot") ? "Copilot-created expedition" : "Custom cycling expedition"}
              </div>
              <h2 className="max-w-3xl text-2xl font-semibold tracking-[-0.035em] text-white sm:text-[2rem]">{route.name}</h2>
              <p className="mt-2 text-sm text-[#d0d6d6]/45">A live workspace for elevation, mapped services, route intelligence and itinerary planning.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canEditActiveRoute && <button onClick={editCurrentRoute} className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#042630]/72 px-4 text-xs font-semibold text-[#d0d6d6]/72 transition hover:border-[#86b9b0]/24 hover:text-white">
                <PencilLine className="size-4 text-[#86b9b0]" /> Edit route
              </button>}
              <button onClick={() => setActiveTab("Weather")} className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#042630]/72 px-4 text-xs font-semibold text-[#d0d6d6]/72 transition hover:border-[#86b9b0]/24 hover:text-white">
                <CalendarDays className="size-4 text-[#86b9b0]" />
                {activeAdventure?.startsOn ? new Date(`${activeAdventure.startsOn}T12:00:00`).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }) : "Set trip date"}
              </button>
              <button onClick={() => requestAnalysis()} disabled={analysisLoading} className="flex h-10 items-center gap-2 rounded-xl bg-[#86b9b0] px-4 text-xs font-bold text-[#041421] shadow-[0_10px_30px_rgba(134,185,176,0.17)] transition hover:-translate-y-0.5 hover:bg-[#9ac9c0] disabled:cursor-wait disabled:opacity-65">
                {analysisLoading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
                {analysisLoading ? "Analyzing…" : "Analyze route"}
              </button>
            </div>
          </section>

          <div className="mt-7 flex gap-1 overflow-x-auto border-b border-white/[0.07]">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`relative h-11 shrink-0 px-4 text-xs font-semibold transition ${activeTab === tab ? "text-white" : "text-[#d0d6d6]/38 hover:text-[#d0d6d6]/70"}`}
              >
                {tab}
                {activeTab === tab && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-[#86b9b0]" />}
              </button>
            ))}
          </div>

          {activeTab === "Weather" ? (
            <WeatherWorkspace route={route} adventure={activeAdventure} canEdit={Boolean(activeAdventure) && canEditActiveRoute} onScheduleChange={updateTripSchedule} />
          ) : activeTab === "Accommodation" ? (
            <AccommodationDashboard adventure={activeAdventure} pois={poiDataset?.items ?? []} onOpenStays={() => setActiveNav("Stays")} />
          ) : (
          <>
          <section className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <MetricCard icon={Navigation} label="Distance" value={`${metrics.distanceKm} km`} note="Total track length" delay={40} />
            <MetricCard icon={TrendingUp} label="Total ascent" value={`${metrics.ascentM.toLocaleString()} m`} note={`${metrics.descentM.toLocaleString()} m descent`} delay={80} />
            <MetricCard icon={Mountain} label="Highest point" value={`${metrics.maxElevationM.toLocaleString()} m`} note={`${metrics.minElevationM.toLocaleString()} m lowest`} delay={120} />
            <MetricCard icon={Timer} label="Moving estimate" value={formatDuration(metrics.estimatedMovingMinutes)} note="Baseline at 15 km/h" delay={160} />
          </section>

          <section className="mt-4 grid gap-4 2xl:grid-cols-[minmax(0,1fr)_330px]">
            <div className="glass-panel rise-in overflow-hidden rounded-[22px]" style={{ animationDelay: "180ms" }}>
              <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-5">
                <div className="mr-auto">
                  <div className="flex items-center gap-2">
                    <Map className="size-4 text-[#86b9b0]" />
                    <h3 className="text-sm font-semibold text-white">Live route map</h3>
                  </div>
                  <p className="mt-1 text-[10px] text-[#d0d6d6]/35">Hover the elevation profile to inspect the route</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setLayersOpen((open) => !open)}
                    className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#041421]/45 px-3 text-[11px] font-semibold text-[#d0d6d6]/65 transition hover:text-white"
                  >
                    <Layers3 className="size-3.5 text-[#86b9b0]" /> Layers
                  </button>
                  {layersOpen && (
                    <div className="absolute right-0 top-11 z-20 w-52 rounded-2xl border border-white/[0.1] bg-[#042630]/95 p-2 shadow-2xl backdrop-blur-xl">
                      {["Route line", "Start & finish", "Elevation terrain", "Route services"].map((layer, index) => (
                        <div key={layer} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] text-[#d0d6d6]/65">
                          <span className={`size-2 rounded-full ${index === 2 && !terrainEnabled ? "bg-[#4c7273]/35" : "bg-[#86b9b0]"}`} />
                          {layer}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex rounded-xl border border-white/[0.08] bg-[#041421]/45 p-1">
                  <button onClick={() => setTerrainEnabled(false)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${!terrainEnabled ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/45"}`}>2D</button>
                  <button onClick={() => setTerrainEnabled(true)} className={`rounded-lg px-3 py-1.5 text-[10px] font-bold transition ${terrainEnabled ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/45"}`}>3D</button>
                </div>
                <div className="relative">
                  <button onClick={() => setFiltersOpen((open) => !open)} className={`grid size-9 place-items-center rounded-xl border bg-[#041421]/45 transition hover:text-white ${filtersOpen ? "border-[#86b9b0]/35 text-[#86b9b0]" : "border-white/[0.08] text-[#d0d6d6]/55"}`} aria-label="Map filters">
                    <Filter className="size-3.5" />
                  </button>
                  {filtersOpen && (
                    <div className="absolute right-0 top-11 z-30 w-60 rounded-2xl border border-white/[0.1] bg-[#042630]/96 p-2 shadow-2xl backdrop-blur-xl">
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#d0d6d6]/42">Route services</span>
                        <button onClick={() => setVisiblePoiCategories(visiblePoiCategories.length === POI_CATEGORIES.length ? [] : [...POI_CATEGORIES])} className="text-[9px] font-semibold text-[#86b9b0]">{visiblePoiCategories.length === POI_CATEGORIES.length ? "Hide all" : "Show all"}</button>
                      </div>
                      {POI_CATEGORIES.map((category) => {
                        const active = visiblePoiCategories.includes(category);
                        const count = poiDataset?.items.filter((poi) => poi.category === category).length ?? 0;
                        return (
                          <button key={category} onClick={() => setVisiblePoiCategories((current) => active ? current.filter((item) => item !== category) : [...current, category])} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-[11px] text-[#d0d6d6]/68 transition hover:bg-white/[0.04]">
                            <span className="size-2.5 rounded-full" style={{ background: active ? poiColors[category] : "#4c727355" }} />
                            <span className={active ? "text-white" : ""}>{poiLabels[category]}</span>
                            <span className="ml-auto text-[9px] text-[#d0d6d6]/32">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <div className="map-shell relative h-[490px] overflow-hidden bg-[#0a303a] xl:h-[560px]">
                <ExpeditionMap
                  route={route}
                  focusPoint={focusPoint}
                  terrainEnabled={terrainEnabled}
                  pois={poiDataset?.items ?? []}
                  visiblePoiCategories={visiblePoiCategories}
                  selectedPoiId={selectedPoi?.id ?? null}
                  plannedPoiIds={plannedPoiIds}
                  onSelectPoi={setSelectedPoi}
                />
                {selectedPoi && (
                  <div className="absolute left-4 top-4 z-10 w-[min(340px,calc(100%-2rem))] rounded-2xl border border-white/[0.12] bg-[#041421]/92 p-4 shadow-2xl backdrop-blur-xl">
                    <div className="flex items-start gap-3">
                      <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: poiColors[selectedPoi.category] }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{selectedPoi.name}</p>
                        <p className="mt-1 text-[10px] text-[#86b9b0]">{poiLabels[selectedPoi.category]} · {selectedPoi.distanceIntoRouteKm.toFixed(1)} km into route</p>
                        <p className="mt-2 text-[10px] leading-4 text-[#d0d6d6]/48">{selectedPoi.distanceFromRouteKm.toFixed(1)} km from the track{selectedPoi.openingHours ? ` · Hours: ${selectedPoi.openingHours}` : " · Opening hours not listed"}</p>
                        <GooglePlaceDetailsCard place={selectedPoi} />
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button onClick={() => togglePlannedPoi(selectedPoi)} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition ${plannedPoiIds.includes(selectedPoi.id) ? "bg-white/[0.08] text-white" : "bg-[#86b9b0] text-[#041421] hover:bg-[#9ac9c0]"}`}>
                            {plannedPoiIds.includes(selectedPoi.id) ? <Trash2 className="size-3" /> : <Plus className="size-3" />}
                            {plannedPoiIds.includes(selectedPoi.id) ? "Remove from itinerary" : "Add to itinerary"}
                          </button>
                          <a href={`https://www.openstreetmap.org/${selectedPoi.osmType}/${selectedPoi.osmId}`} target="_blank" rel="noreferrer" className="text-[10px] font-semibold text-[#86b9b0] hover:text-white">OpenStreetMap →</a>
                        </div>
                      </div>
                      <button onClick={() => setSelectedPoi(null)} className="ml-auto text-[#d0d6d6]/40 hover:text-white" aria-label="Close place details"><X className="size-4" /></button>
                    </div>
                  </div>
                )}
                <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex gap-2">
                  <span className="rounded-lg border border-white/[0.09] bg-[#041421]/78 px-2.5 py-1.5 text-[9px] font-semibold text-[#d0d6d6]/60 backdrop-blur-lg">OPEN MAP</span>
                  <span className="rounded-lg border border-white/[0.09] bg-[#041421]/78 px-2.5 py-1.5 text-[9px] font-semibold text-[#86b9b0] backdrop-blur-lg">TERRAIN {terrainEnabled ? "ON" : "OFF"}</span>
                  <span className="rounded-lg border border-white/[0.09] bg-[#041421]/78 px-2.5 py-1.5 text-[9px] font-semibold text-[#86b9b0] backdrop-blur-lg">{poiLoading ? "PLACES LOADING" : `${poiDataset?.items.length ?? 0} SERVICES`}</span>
                </div>
              </div>
              <div className="px-4 pb-4 pt-4 sm:px-5">
                <div className="mb-1 flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-xs font-semibold text-white">Elevation profile</h3>
                    <p className="mt-0.5 text-[10px] text-[#d0d6d6]/35">Distance and route elevation</p>
                  </div>
                  {selectedPoint && (
                    <div className="text-right">
                      <p className="text-sm font-semibold text-white">{Math.round(selectedPoint.elevationM).toLocaleString()} m</p>
                      <p className="text-[10px] text-[#86b9b0]/65">at {selectedPoint.distanceKm.toFixed(1)} km</p>
                    </div>
                  )}
                </div>
                <ElevationProfile points={route.elevationProfile} onHover={setFocusPoint} />
                <div className="flex justify-between text-[9px] font-medium text-[#d0d6d6]/28">
                  <span>START</span><span>{(metrics.distanceKm / 2).toFixed(1)} KM</span><span>FINISH · {metrics.distanceKm} KM</span>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
              <article className="glass-panel rise-in rounded-[22px] p-5" style={{ animationDelay: "220ms" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flag className="size-4 text-[#86b9b0]" />
                    <h3 className="text-sm font-semibold text-white">Route intelligence</h3>
                  </div>
                  <span className="rounded-full bg-[#86b9b0]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">Route ready</span>
                </div>
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-[#041421]/48 p-4">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#d0d6d6]/46">Maximum climb grade</span>
                      <span className="font-semibold text-white">{metrics.maxGradePct}%</span>
                    </div>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#4c7273]/15">
                      <div className="h-full rounded-full bg-[#86b9b0]" style={{ width: `${Math.min(100, metrics.maxGradePct * 4)}%` }} />
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-2xl border border-white/[0.07] p-4">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-[#86b9b0]" />
                    <div>
                      <p className="text-xs font-semibold text-white">Start and finish located</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#d0d6d6]/42">The route contains confirmed start and finish coordinates.</p>
                    </div>
                  </div>
                </div>
                <button onClick={() => analysis ? setAnalysisOpen(true) : requestAnalysis()} className="mt-5 w-full rounded-xl border border-[#86b9b0]/18 py-2.5 text-[11px] font-semibold text-[#86b9b0] transition hover:bg-[#86b9b0]/8">{analysis ? "View full analysis" : "Run full analysis"}</button>
              </article>

              <article className="glass-panel rise-in rounded-[22px] p-5" style={{ animationDelay: "260ms" }}>
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#86b9b0]" />
                  <h3 className="text-sm font-semibold text-white">Expedition copilot</h3>
                </div>
                <p className="mt-2 text-[11px] leading-5 text-[#d0d6d6]/42">Ask for planning help using this route as context.</p>
                <div className="mt-4 rounded-2xl border border-white/[0.08] bg-[#041421]/48 p-3">
                  <textarea
                    value={copilotQuestion}
                    onChange={(event) => setCopilotQuestion(event.target.value)}
                    className="h-20 w-full resize-none bg-transparent text-xs leading-5 text-white outline-none placeholder:text-[#d0d6d6]/26"
                    placeholder="Could I complete this route based on my recent training?"
                    aria-label="Ask Expedition copilot"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#d0d6d6]/28">Route attached</span>
                    <button onClick={() => requestAnalysis(copilotQuestion)} disabled={analysisLoading || !copilotQuestion.trim()} className="grid size-8 place-items-center rounded-lg bg-[#86b9b0] text-[#041421] transition hover:bg-[#9ac9c0] disabled:cursor-not-allowed disabled:opacity-35" aria-label="Send question">
                      {analysisLoading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Navigation className="size-3.5" fill="currentColor" />}
                    </button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Find stays", "Check difficulty", "Build packing list"].map((prompt) => (
                    <button key={prompt} onClick={() => setCopilotQuestion(prompt === "Find stays" ? "What kinds of overnight or resupply stops should I plan for? Be clear that live search is not yet connected." : prompt === "Check difficulty" ? "How difficult is this route, and what training should I complete first?" : "Build a practical packing list for this route, grouped by essential categories.")} className="rounded-lg bg-white/[0.035] px-2.5 py-1.5 text-[9px] text-[#d0d6d6]/46 transition hover:bg-white/[0.07] hover:text-white">{prompt}</button>
                  ))}
                </div>
              </article>

              <article className="glass-panel rise-in rounded-[22px] p-5 sm:col-span-2 2xl:col-span-1" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TentTree className="size-4 text-[#86b9b0]" />
                    <h3 className="text-sm font-semibold text-white">Route services</h3>
                  </div>
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-[#86b9b0]/65">{poiLoading ? "Searching" : poiError ? "Offline" : "Live OSM"}</span>
                </div>
                {poiError ? (
                  <div className="mt-4 rounded-2xl border border-amber-200/12 bg-amber-200/[0.04] p-4 text-[10px] leading-5 text-[#d0d6d6]/48">{poiError}</div>
                ) : (
                  <>
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {(["fuel", "food", "groceries"] as PoiCategory[]).map((category) => (
                        <button key={category} onClick={() => setFiltersOpen(true)} className="rounded-xl bg-[#041421]/48 p-3 text-left transition hover:bg-[#041421]/75">
                          <span className="text-lg font-semibold text-white">{poiDataset?.items.filter((poi) => poi.category === category).length ?? "–"}</span>
                          <span className="mt-1 block text-[9px] text-[#d0d6d6]/38">{poiLabels[category]}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 space-y-2">
                      {(poiDataset?.items.filter((poi) => ["fuel", "water", "groceries", "food"].includes(poi.category)).slice(0, 3) ?? []).map((poi) => (
                        <button key={poi.id} onClick={() => setSelectedPoi(poi)} className="flex w-full items-center gap-3 rounded-xl border border-white/[0.06] px-3 py-2.5 text-left transition hover:border-[#86b9b0]/22">
                          <span className="size-2 rounded-full" style={{ background: poiColors[poi.category] }} />
                          <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-white">{poi.name}</span>
                          <span className="text-[9px] text-[#d0d6d6]/34">{poi.distanceIntoRouteKm.toFixed(1)} km</span>
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[9px] leading-4 text-[#d0d6d6]/28">Within {poiDataset?.corridorKm ?? 1.5} km of the route · OSM {poiDataset?.osmTimestamp ? `updated ${new Date(poiDataset.osmTimestamp).toLocaleDateString()}` : "live data"} · Google Places {poiDataset?.providers.google === "configured" ? "details load when a place is selected" : "pending a separate key"}</p>
                  </>
                )}
              </article>
            </div>
          </section>

          <section className="glass-panel rise-in mt-4 overflow-hidden rounded-[22px]" style={{ animationDelay: "340ms" }}>
            <div className="flex flex-col gap-4 border-b border-white/[0.07] px-5 py-4 lg:flex-row lg:items-center">
              <div className="mr-auto">
                <div className="flex items-center gap-2">
                  <Route className="size-4 text-[#86b9b0]" />
                  <h3 className="text-sm font-semibold text-white">Route itinerary</h3>
                  <span className="rounded-full bg-[#86b9b0]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]">{plannedStops.length} {plannedStops.length === 1 ? "stop" : "stops"}</span>
                </div>
                <p className="mt-1 text-[10px] text-[#d0d6d6]/38">Select places on the map, estimate arrivals and export the plan to GPX.</p>
              </div>
              <label className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#041421]/45 px-3 text-[10px] text-[#d0d6d6]/48">
                <Timer className="size-3.5 text-[#86b9b0]" />
                Start
                <input type="time" value={itineraryStartTime} onInput={(event) => setItineraryStartTime(event.currentTarget.value)} className="bg-transparent font-semibold text-white outline-none [color-scheme:dark]" aria-label="Itinerary start time" />
              </label>
              <button onClick={suggestItinerary} disabled={itineraryLoading || poiLoading || !poiDataset} className="flex h-9 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-3 text-[10px] font-bold text-[#041421] transition hover:bg-[#9ac9c0] disabled:cursor-wait disabled:opacity-45">
                {itineraryLoading ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                {itineraryLoading ? "Planning…" : "Copilot suggest stops"}
              </button>
              <button onClick={exportItinerary} className="flex h-9 items-center justify-center gap-2 rounded-xl border border-white/[0.09] bg-[#041421]/45 px-3 text-[10px] font-bold text-[#d0d6d6]/65 transition hover:border-[#86b9b0]/24 hover:text-white"><Download className="size-3.5" /> Export GPX</button>
            </div>

            <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div>
                <div className="relative mb-6 rounded-2xl border border-white/[0.07] bg-[#041421]/38 px-4 py-5">
                  <div className="relative h-2 rounded-full bg-[#4c7273]/18">
                    <div className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[#4c7273] to-[#86b9b0]" style={{ width: "100%" }} />
                    {plannedStops.map((poi) => (
                      <button key={poi.id} onClick={() => setSelectedPoi(poi)} className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#041421] shadow-[0_0_0_2px_rgba(255,255,255,0.72)] transition hover:scale-125" style={{ left: `${Math.min(100, Math.max(0, (poi.distanceIntoRouteKm / metrics.distanceKm) * 100))}%`, background: poiColors[poi.category] }} aria-label={`Focus ${poi.name} at ${poi.distanceIntoRouteKm.toFixed(1)} km`} />
                    ))}
                  </div>
                  <div className="mt-3 flex justify-between text-[9px] font-semibold text-[#d0d6d6]/34"><span>0 KM</span><span>{metrics.distanceKm} KM</span></div>
                </div>

                {itineraryStatus && <div className="mb-4 rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] px-4 py-3 text-[10px] text-[#86b9b0]/78">{itineraryStatus}</div>}

                <div className="space-y-2">
                  <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#041421]/30 p-4">
                    <span className="grid size-8 place-items-center rounded-full bg-[#86b9b0] text-[10px] font-bold text-[#041421]">S</span>
                    <div><p className="text-xs font-semibold text-white">Route start</p><p className="mt-1 text-[10px] text-[#d0d6d6]/38">Depart at {itineraryStartTime}</p></div>
                    <span className="ml-auto text-[10px] font-semibold text-[#86b9b0]">0 km</span>
                  </div>

                  {itinerary?.entries.map((entry, index) => (
                    <article key={entry.poi.id} className="group flex items-center gap-4 rounded-2xl border border-white/[0.07] bg-[#041421]/42 p-4 transition hover:border-[#86b9b0]/22">
                      <button onClick={() => setSelectedPoi(entry.poi)} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-[#041421] text-[10px] font-bold text-[#041421] shadow-[0_0_0_2px_rgba(255,255,255,0.2)]" style={{ background: poiColors[entry.poi.category] }}>{index + 1}</button>
                      <button onClick={() => setSelectedPoi(entry.poi)} className="min-w-0 flex-1 text-left">
                        <p className="truncate text-xs font-semibold text-white">{entry.poi.name}</p>
                        <p className="mt-1 text-[10px] text-[#d0d6d6]/38">{poiLabels[entry.poi.category]} · {entry.legDistanceKm.toFixed(1)} km from previous · {entry.poi.distanceFromRouteKm.toFixed(1)} km off route</p>
                      </button>
                      <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-white">{formatClock(entry.arrivalMinutes)}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/34">ETA · {entry.poi.distanceIntoRouteKm.toFixed(1)} km</p></div>
                      <button onClick={() => togglePlannedPoi(entry.poi)} className="grid size-8 place-items-center rounded-lg text-[#d0d6d6]/28 transition hover:bg-white/[0.05] hover:text-white" aria-label={`Remove ${entry.poi.name} from itinerary`}><Trash2 className="size-3.5" /></button>
                    </article>
                  ))}

                  {plannedStops.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#86b9b0]/18 px-5 py-8 text-center">
                      <MapPin className="mx-auto size-5 text-[#86b9b0]/65" />
                      <p className="mt-3 text-xs font-semibold text-white">No stops planned yet</p>
                      <p className="mx-auto mt-1 max-w-md text-[10px] leading-5 text-[#d0d6d6]/38">Choose a map marker and add it to the itinerary, or let the Copilot create a balanced first draft.</p>
                    </div>
                  )}

                  <div className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#041421]/30 p-4">
                    <span className="grid size-8 place-items-center rounded-full bg-[#d0d6d6] text-[10px] font-bold text-[#041421]">F</span>
                    <div><p className="text-xs font-semibold text-white">Route finish</p><p className="mt-1 text-[10px] text-[#d0d6d6]/38">Includes {plannedStops.length * 10} minutes for planned stops</p></div>
                    <div className="ml-auto text-right"><p className="text-xs font-semibold text-white">{itinerary ? formatClock(itinerary.finishMinutes) : "–"}</p><p className="mt-1 text-[9px] text-[#86b9b0]">ESTIMATED</p></div>
                  </div>
                </div>
              </div>

              <aside className="rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4">
                <div className="flex items-center gap-2"><ShieldAlert className="size-4 text-[#86b9b0]" /><h4 className="text-xs font-semibold text-white">Resupply gap check</h4></div>
                <p className="mt-2 text-[10px] leading-4 text-[#d0d6d6]/38">Checks selected fuel, food, grocery and water stops. Mapped places still need local verification.</p>
                <div className="mt-4 space-y-3">
                  {itineraryWarnings.map((warning, index) => (
                    <div key={`${warning.title}-${index}`} className={`rounded-xl border p-3 ${warning.severity === "high" ? "border-amber-300/18 bg-amber-300/[0.05]" : "border-white/[0.07] bg-white/[0.025]"}`}>
                      <div className="flex items-start gap-2"><span className={`mt-1 size-2 shrink-0 rounded-full ${warning.severity === "high" ? "bg-amber-300" : "bg-[#86b9b0]"}`} /><p className="text-[10px] font-semibold text-white">{warning.title}</p></div>
                      <p className="mt-2 text-[9px] leading-4 text-[#d0d6d6]/42">{warning.detail}</p>
                    </div>
                  ))}
                  {itineraryWarnings.length === 0 && (
                    <div className="rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-4 text-center">
                      <CheckCircle2 className="mx-auto size-5 text-[#86b9b0]" />
                      <p className="mt-2 text-[10px] font-semibold text-white">No major planned resupply gaps</p>
                      <p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/38">Verify every stop before departure and still carry a contingency reserve.</p>
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </section>

          <footer className="mt-6 flex flex-col gap-2 border-t border-white/[0.05] py-5 text-[10px] text-[#d0d6d6]/25 sm:flex-row sm:items-center sm:justify-between">
            <span>Route source: {route.source}</span>
            <span className="flex items-center gap-1.5"><CloudSun className="size-3" /> Route weather is available in the Weather tab.</span>
          </footer>
          </>
          )}
        </div>
      </main>
      {analysisOpen && <AnalysisDrawer routeName={analysisRouteName ?? route.name} analysis={analysis} places={analysisPlaces} model={analysisModel} error={analysisError} loading={analysisLoading} onClose={() => setAnalysisOpen(false)} />}
    </div>
  );
}
