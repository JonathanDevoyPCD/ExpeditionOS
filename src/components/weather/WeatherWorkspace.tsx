"use client";

import {
  AlertTriangle,
  CalendarDays,
  CloudLightning,
  CloudRain,
  CloudSun,
  Compass,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  Sun,
  ThermometerSun,
  Wind,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { projectPointOntoRoute } from "@/lib/geo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { localForecastDate, tripDaysBetween, tripEndDate } from "@/lib/weatherSchedule.mjs";
import type { AdventurePlan, RouteAnchor } from "@/types/adventure";
import type { RouteDataset, RoutePoint } from "@/types/route";
import type { RouteWeatherHour, RouteWeatherResponse, WeatherRisk, WeatherSampleRequest } from "@/types/weather";

type WeatherIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

function bearingDegrees(start: Pick<RoutePoint, "lat" | "lon">, finish: Pick<RoutePoint, "lat" | "lon">) {
  const radians = Math.PI / 180;
  const startLat = start.lat * radians;
  const finishLat = finish.lat * radians;
  const longitudeDelta = (finish.lon - start.lon) * radians;
  const y = Math.sin(longitudeDelta) * Math.cos(finishLat);
  const x = Math.cos(startLat) * Math.sin(finishLat) - Math.sin(startLat) * Math.cos(finishLat) * Math.cos(longitudeDelta);
  return (Math.atan2(y, x) / radians + 360) % 360;
}

function routeBearingAt(route: RouteDataset, distanceKm: number) {
  const index = route.points.findIndex((point) => point.distanceKm >= distanceKm);
  const finishIndex = index < 0 ? route.points.length - 1 : Math.max(1, index);
  const startIndex = Math.max(0, finishIndex - 1);
  return bearingDegrees(route.points[startIndex], route.points[finishIndex]);
}

function sampleFromAnchor(route: RouteDataset, anchor: RouteAnchor): WeatherSampleRequest {
  const projection = projectPointOntoRoute(anchor, route.points);
  return {
    id: anchor.id,
    label: anchor.name,
    kind: "overnight",
    lat: anchor.lat,
    lon: anchor.lon,
    distanceKm: projection.distanceIntoRouteKm,
    routeBearingDegrees: routeBearingAt(route, projection.distanceIntoRouteKm),
  };
}

function buildWeatherSamples(route: RouteDataset, adventure?: AdventurePlan): WeatherSampleRequest[] {
  const start: WeatherSampleRequest = {
    id: "route-start",
    label: "Route start",
    kind: "start",
    lat: route.start.lat,
    lon: route.start.lon,
    distanceKm: 0,
    routeBearingDegrees: routeBearingAt(route, 0),
  };
  const finish: WeatherSampleRequest = {
    id: "route-finish",
    label: "Route finish",
    kind: "finish",
    lat: route.finish.lat,
    lon: route.finish.lon,
    distanceKm: route.metrics.distanceKm,
    routeBearingDegrees: routeBearingAt(route, route.metrics.distanceKm),
  };
  const summit = route.points.reduce((highest, point) => point.elevationM > highest.elevationM ? point : highest, route.points[0]);
  const highPoint: WeatherSampleRequest = {
    id: "route-high-point",
    label: "Highest point",
    kind: "high_point",
    lat: summit.lat,
    lon: summit.lon,
    distanceKm: summit.distanceKm,
    routeBearingDegrees: routeBearingAt(route, summit.distanceKm),
  };
  const overnight = (adventure?.anchors ?? [])
    .filter((anchor) => anchor.kind === "overnight")
    .sort((left, right) => (left.day ?? 0) - (right.day ?? 0))
    .slice(0, 2)
    .map((anchor) => sampleFromAnchor(route, anchor));
  const candidates = overnight.length >= 2 ? [start, ...overnight, finish] : [start, ...overnight, highPoint, finish];
  return candidates.filter((sample, index) => candidates.findIndex((candidate) => Math.abs(candidate.lat - sample.lat) < 0.002 && Math.abs(candidate.lon - sample.lon) < 0.002) === index).slice(0, 4);
}

function ConditionIcon({ type, className }: { type: string; className: string }) {
  if (type.includes("THUNDER")) return <CloudLightning className={className} strokeWidth={1.6} />;
  if (type.includes("RAIN") || type.includes("DRIZZLE") || type.includes("SHOWER")) return <CloudRain className={className} strokeWidth={1.6} />;
  if (type === "CLEAR" || type.includes("SUNNY")) return <Sun className={className} strokeWidth={1.6} />;
  return <CloudSun className={className} strokeWidth={1.6} />;
}

function hourLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

function timeLabel(value: string | undefined, timeZone: string) {
  if (!value) return "–";
  return new Intl.DateTimeFormat("en-ZA", { hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(value));
}

function weatherRisks(hours: RouteWeatherHour[], label: string): WeatherRisk[] {
  const risks: WeatherRisk[] = [];
  const add = (risk: WeatherRisk) => {
    if (!risks.some((existing) => existing.id === risk.id)) risks.push(risk);
  };
  for (const hour of hours) {
    if (hour.wind.gustKph >= 50) add({ id: "gust", severity: "high", title: "Strong gust exposure", detail: `${Math.round(hour.wind.gustKph)} km/h gusts forecast near ${label}.`, startsAt: hour.startsAt });
    else if (hour.wind.gustKph >= 35) add({ id: "gust-watch", severity: "watch", title: "Gusty riding conditions", detail: `${Math.round(hour.wind.gustKph)} km/h gusts may affect bike handling near ${label}.`, startsAt: hour.startsAt });
    if (hour.wind.headwindKph >= 25) add({ id: "headwind", severity: "watch", title: "Material headwind", detail: `About ${Math.round(hour.wind.headwindKph)} km/h projected against the route direction near ${label}.`, startsAt: hour.startsAt });
    if (hour.wind.crosswindKph >= 30) add({ id: "crosswind", severity: "high", title: "Strong crosswind", detail: `About ${Math.round(hour.wind.crosswindKph)} km/h across the route near ${label}.`, startsAt: hour.startsAt });
    if (hour.thunderstormProbabilityPct >= 30) add({ id: "storm", severity: "high", title: "Thunderstorm risk", detail: `${Math.round(hour.thunderstormProbabilityPct)}% thunderstorm probability near ${label}.`, startsAt: hour.startsAt });
    if (hour.precipitationProbabilityPct >= 65 && hour.precipitationMm >= 0.5) add({ id: "rain", severity: "watch", title: "Likely rain window", detail: `${Math.round(hour.precipitationProbabilityPct)}% probability with ${hour.precipitationMm.toFixed(1)} mm forecast near ${label}.`, startsAt: hour.startsAt });
    if (hour.temperatureC >= 34) add({ id: "heat", severity: "high", title: "High heat load", detail: `${Math.round(hour.temperatureC)}°C forecast near ${label}.`, startsAt: hour.startsAt });
    if (hour.temperatureC <= 4) add({ id: "cold", severity: "watch", title: "Cold conditions", detail: `${Math.round(hour.temperatureC)}°C forecast near ${label}.`, startsAt: hour.startsAt });
    if (hour.visibilityKm > 0 && hour.visibilityKm < 5) add({ id: "visibility", severity: "high", title: "Reduced visibility", detail: `${hour.visibilityKm.toFixed(1)} km visibility forecast near ${label}.`, startsAt: hour.startsAt });
  }
  return risks.slice(0, 5);
}

export default function WeatherWorkspace({
  route,
  adventure,
  canEdit,
  onScheduleChange,
}: {
  route: RouteDataset;
  adventure?: AdventurePlan;
  canEdit: boolean;
  onScheduleChange: (startsOn: string | undefined, departureTime: string, days?: number) => Promise<void>;
}) {
  const samples = useMemo(() => buildWeatherSamples(route, adventure), [route, adventure]);
  const [selectedSampleId, setSelectedSampleId] = useState(samples[0]?.id ?? "");
  const [selectedForecastDate, setSelectedForecastDate] = useState(adventure?.startsOn ?? "");
  const [weather, setWeather] = useState<RouteWeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scheduleStatus, setScheduleStatus] = useState<string | null>(null);
  const endsOn = tripEndDate(adventure?.startsOn, adventure?.days ?? 1);
  const activeSampleId = samples.some((sample) => sample.id === selectedSampleId) ? selectedSampleId : samples[0]?.id ?? "";
  const selectedSample = samples.find((sample) => sample.id === activeSampleId) ?? samples[0];

  async function loadWeather(signal?: AbortSignal) {
    setLoading(true);
    setError(null);
    try {
      const { data } = await getSupabaseBrowserClient().auth.getSession();
      const token = data.session?.access_token;
      if (!token) throw new Error("Sign in again to load route weather.");
      const response = await fetch("/api/weather", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          samples: selectedSample ? [selectedSample] : [],
          window: {
            startDate: adventure?.startsOn,
            endDate: endsOn,
            departureTime: adventure?.departureTime ?? "07:00",
          },
        }),
        signal,
      });
      const result = await response.json() as RouteWeatherResponse & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Route weather could not be loaded.");
      setWeather(result);
    } catch (reason) {
      if (reason instanceof Error && reason.name !== "AbortError") setError(reason.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) void loadWeather(controller.signal);
    });
    return () => controller.abort();
    // samples are memoized from the active route and its anchors.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, activeSampleId, adventure?.startsOn, adventure?.departureTime, endsOn]);

  const selectedLocation = weather?.locations.find((location) => location.sample.id === activeSampleId) ?? weather?.locations[0];
  const selectedHours = selectedLocation
    ? selectedLocation.hourly.filter((hour) => localForecastDate(hour.startsAt, selectedLocation.timeZone) === selectedForecastDate)
    : [];
  const departureTime = adventure?.departureTime ?? "07:00";
  const ridingHours = selectedHours.filter((hour) => hourLabel(hour.startsAt, selectedLocation?.timeZone ?? "UTC") >= departureTime);
  const risks = selectedLocation ? weatherRisks(ridingHours.length ? ridingHours : selectedHours, selectedLocation.sample.label) : [];
  const visibleDays = weather?.daily.filter((day) => !adventure?.startsOn || !endsOn || (day.date >= adventure.startsOn && day.date <= endsOn)) ?? [];
  const forecastEndsOn = weather?.daily.at(-1)?.date;
  const earthUrl = selectedLocation
    ? `https://earth.nullschool.net/#current/wind/surface/level/orthographic=${selectedLocation.sample.lon.toFixed(2)},${selectedLocation.sample.lat.toFixed(2)},3000`
    : "https://earth.nullschool.net/";

  async function updateSchedule(startsOn: string | undefined, departureTime: string, days?: number) {
    setScheduleStatus("Saving trip schedule…");
    try {
      await onScheduleChange(startsOn, departureTime, days);
      setScheduleStatus("Trip schedule saved");
    } catch {
      setScheduleStatus("Trip schedule could not be saved");
    }
  }

  if (loading && !weather) {
    return <div className="glass-panel mt-5 grid min-h-[420px] place-items-center rounded-[22px]"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#86b9b0]" /><p className="mt-3 text-xs text-[#d0d6d6]/48">Sampling weather along the route…</p></div></div>;
  }

  if (error && !weather) {
    return <div className="glass-panel mt-5 rounded-[22px] p-8 text-center"><AlertTriangle className="mx-auto size-7 text-amber-300" /><h3 className="mt-3 text-sm font-semibold text-white">Weather is unavailable</h3><p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-[#d0d6d6]/48">{error}</p><button onClick={() => void loadWeather()} className="mt-5 rounded-xl bg-[#86b9b0] px-4 py-2.5 text-xs font-bold text-[#041421]">Try again</button></div>;
  }

  if (!weather || !selectedLocation) return null;
  return (
    <div className="mt-5 space-y-4">
      <section className="glass-panel rounded-[22px] p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="mr-auto">
            <div className="flex items-center gap-2"><CalendarDays className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">Trip forecast window</h3></div>
            <p className="mt-1 text-[10px] text-[#d0d6d6]/38">Forecasts are tied to your planned date and local departure time.</p>
          </div>
          <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">Start date<input type="date" disabled={!canEdit} value={adventure?.startsOn ?? ""} onChange={(event) => void updateSchedule(event.target.value || undefined, adventure?.departureTime ?? "07:00", adventure?.days)} className="mt-1 block h-10 rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs font-semibold text-white outline-none [color-scheme:dark] disabled:opacity-45" /></label>
          <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">End date<input type="date" disabled={!canEdit || !adventure?.startsOn} min={adventure?.startsOn} value={endsOn ?? ""} onChange={(event) => { const days = tripDaysBetween(adventure?.startsOn, event.target.value); if (days) void updateSchedule(adventure?.startsOn, adventure?.departureTime ?? "07:00", days); }} className="mt-1 block h-10 rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs font-semibold text-white outline-none [color-scheme:dark] disabled:opacity-45" /></label>
          <label className="text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">Departure<input type="time" disabled={!canEdit} value={adventure?.departureTime ?? "07:00"} onChange={(event) => void updateSchedule(adventure?.startsOn, event.target.value)} className="mt-1 block h-10 rounded-xl border border-white/[0.08] bg-[#041421]/55 px-3 text-xs font-semibold text-white outline-none [color-scheme:dark] disabled:opacity-45" /></label>
          <button onClick={() => void loadWeather()} disabled={loading} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-xs font-semibold text-[#d0d6d6]/65 transition hover:text-white disabled:opacity-45 xl:mt-0">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4 text-[#86b9b0]" />} Refresh</button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full bg-[#86b9b0]/10 px-3 py-1.5 text-[#86b9b0]">{weather.provider === "google_weather" ? "Google Weather" : "Open-Meteo"} · updated {new Date(weather.retrievedAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}</span>
          {weather.fallbackReason && <span className="text-amber-200/65">{weather.fallbackReason}</span>}
          {scheduleStatus && <span className="text-[#d0d6d6]/42">{scheduleStatus}</span>}
          {!adventure?.startsOn && <span className="text-amber-200/65">Set a date to identify the relevant forecast day.</span>}
          {adventure?.startsOn && !visibleDays.length && forecastEndsOn && <span className="text-amber-200/65">Trip is outside the current forecast window ending {shortDate(forecastEndsOn)}.</span>}
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {samples.map((sample) => (
          <button key={sample.id} onClick={() => setSelectedSampleId(sample.id)} className={`min-w-[150px] rounded-2xl border px-4 py-3 text-left transition ${sample.id === activeSampleId ? "border-[#86b9b0]/45 bg-[#86b9b0]/10" : "border-white/[0.07] bg-[#042630]/55 hover:border-[#86b9b0]/22"}`}>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/60">{sample.kind.replace("_", " ")}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-white">{sample.label}</span>
            <span className="mt-1 block text-[9px] text-[#d0d6d6]/36">{sample.distanceKm.toFixed(1)} km</span>
          </button>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <article className="glass-panel rounded-[22px] p-5">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-[#86b9b0]/10 text-[#86b9b0]"><ConditionIcon type={selectedLocation.current.condition.type} className="size-8" /></span>
            <div className="mr-auto"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#86b9b0]/55">Now · {selectedLocation.sample.label}</p><div className="mt-1 flex items-end gap-3"><span className="text-4xl font-semibold tracking-[-0.05em] text-white">{Math.round(selectedLocation.current.temperatureC)}°</span><span className="pb-1 text-sm text-[#d0d6d6]/55">{selectedLocation.current.condition.description}</span></div><p className="mt-1 text-[10px] text-[#d0d6d6]/35">Feels like {Math.round(selectedLocation.current.feelsLikeC)}°C · {selectedLocation.current.humidityPct}% humidity</p></div>
            <a href={earthUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 px-4 text-xs font-semibold text-[#86b9b0] transition hover:bg-[#86b9b0]/8">Open in Earth <ExternalLink className="size-3.5" /></a>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <WeatherMetric icon={Wind} label="Wind / gust" value={`${Math.round(selectedLocation.current.wind.speedKph)} / ${Math.round(selectedLocation.current.wind.gustKph)} km/h`} note={`${selectedLocation.current.wind.cardinal.replaceAll("_", " ")} · ${selectedLocation.current.wind.directionDegrees}°`} />
            <WeatherMetric icon={Compass} label="Route effect" value={selectedLocation.current.wind.headwindKph >= 0 ? `${Math.round(selectedLocation.current.wind.headwindKph)} km/h headwind` : `${Math.abs(Math.round(selectedLocation.current.wind.headwindKph))} km/h tailwind`} note={`${Math.round(selectedLocation.current.wind.crosswindKph)} km/h crosswind`} />
            <WeatherMetric icon={CloudRain} label="Precipitation" value={`${Math.round(selectedLocation.current.precipitationProbabilityPct)}%`} note={`${selectedLocation.current.precipitationMm.toFixed(1)} mm · storm ${Math.round(selectedLocation.current.thunderstormProbabilityPct)}%`} />
            <WeatherMetric icon={ThermometerSun} label="Visibility / UV" value={`${selectedLocation.current.visibilityKm.toFixed(0)} km`} note={`UV ${selectedLocation.current.uvIndex} · cloud ${selectedLocation.current.cloudCoverPct}%`} />
          </div>
        </article>

        <aside className="glass-panel rounded-[22px] p-5">
          <div className="flex items-center gap-2"><AlertTriangle className="size-4 text-[#86b9b0]" /><h3 className="text-sm font-semibold text-white">{selectedForecastDate ? `${shortDate(selectedForecastDate)} risks` : "Next 24-hour risks"}</h3></div>
          <div className="mt-4 space-y-2">
            {risks.map((risk) => <div key={risk.id} className={`rounded-xl border p-3 ${risk.severity === "high" ? "border-amber-300/18 bg-amber-300/[0.05]" : "border-white/[0.07] bg-white/[0.025]"}`}><div className="flex items-start gap-2"><span className={`mt-1 size-2 shrink-0 rounded-full ${risk.severity === "high" ? "bg-amber-300" : "bg-[#86b9b0]"}`} /><div><p className="text-[10px] font-semibold text-white">{risk.title}</p><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/42">{risk.detail}</p><p className="mt-1 text-[9px] text-[#86b9b0]/55">From {hourLabel(risk.startsAt, selectedLocation.timeZone)}</p></div></div></div>)}
            {!risks.length && <div className="rounded-xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.05] p-4 text-center"><CloudSun className="mx-auto size-5 text-[#86b9b0]" /><p className="mt-2 text-[10px] font-semibold text-white">No threshold warnings</p><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/38">Continue checking forecasts and local conditions before departure.</p></div>}
          </div>
        </aside>
      </section>

      <section className="glass-panel overflow-hidden rounded-[22px]">
        <div className="border-b border-white/[0.07] px-5 py-4"><h3 className="text-sm font-semibold text-white">Hourly forecast</h3><p className="mt-1 text-[10px] text-[#d0d6d6]/38">{selectedForecastDate ? `${shortDate(selectedForecastDate)} from ${departureTime}` : "Next available hours"} at {selectedLocation.sample.label}</p></div>
        <div className="flex gap-2 overflow-x-auto p-4">
          {(ridingHours.length ? ridingHours : selectedHours).map((hour) => {
            return <article key={hour.startsAt} className="min-w-[118px] rounded-2xl border border-white/[0.07] bg-[#041421]/38 p-3"><p className="text-[9px] font-bold text-[#86b9b0]">{hourLabel(hour.startsAt, selectedLocation.timeZone)}</p><ConditionIcon type={hour.condition.type} className="mt-3 size-5 text-[#86b9b0]" /><p className="mt-2 text-lg font-semibold text-white">{Math.round(hour.temperatureC)}°</p><p className="mt-1 truncate text-[9px] text-[#d0d6d6]/38">{hour.condition.description}</p><div className="mt-3 space-y-1 text-[9px] text-[#d0d6d6]/44"><p>Rain {Math.round(hour.precipitationProbabilityPct)}%</p><p>Wind {Math.round(hour.wind.speedKph)} km/h</p><p>Gust {Math.round(hour.wind.gustKph)} km/h</p></div></article>;
          })}
          {selectedForecastDate && !selectedHours.length && <div className="w-full rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-6 text-center"><AlertTriangle className="mx-auto size-5 text-amber-200" /><p className="mt-2 text-[10px] font-semibold text-white">Hourly forecast unavailable for this date</p><p className="mt-1 text-[9px] text-[#d0d6d6]/40">Hourly forecasts cover up to 240 hours. Check again when the trip enters the forecast window.</p></div>}
        </div>
      </section>

      <section className="glass-panel overflow-hidden rounded-[22px]">
        <div className="border-b border-white/[0.07] px-5 py-4"><h3 className="text-sm font-semibold text-white">Daily outlook</h3><p className="mt-1 text-[10px] text-[#d0d6d6]/38">Ten-day planning window at the route start</p></div>
        <div className="grid gap-2 p-4 sm:grid-cols-2 xl:grid-cols-5">
          {(visibleDays.length ? visibleDays : weather.daily).map((day) => {
            const selected = day.date === selectedForecastDate;
            return <button type="button" onClick={() => setSelectedForecastDate(day.date)} key={day.date} className={`rounded-2xl border p-4 text-left transition ${selected ? "border-[#86b9b0]/45 bg-[#86b9b0]/10" : "border-white/[0.07] bg-[#041421]/38 hover:border-[#86b9b0]/22"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold text-white">{shortDate(day.date)}</p>{day.date === adventure?.startsOn && <p className="mt-1 text-[8px] font-bold uppercase tracking-wider text-[#86b9b0]">Trip start</p>}</div><ConditionIcon type={day.condition.type} className="size-5 text-[#86b9b0]" /></div><p className="mt-3 text-xl font-semibold text-white">{Math.round(day.maximumTemperatureC)}° <span className="text-sm text-[#d0d6d6]/35">/ {Math.round(day.minimumTemperatureC)}°</span></p><p className="mt-1 truncate text-[9px] text-[#d0d6d6]/40">{day.condition.description}</p><div className="mt-3 space-y-1 text-[9px] text-[#d0d6d6]/42"><p>Rain {Math.round(day.precipitationProbabilityPct)}% · {day.precipitationMm.toFixed(1)} mm</p><p>Wind {Math.round(day.windSpeedKph)} · gust {Math.round(day.windGustKph)} km/h</p><p>Sun {timeLabel(day.sunriseAt, selectedLocation.timeZone)}–{timeLabel(day.sunsetAt, selectedLocation.timeZone)}</p></div></button>;
          })}
        </div>
      </section>

      <p className="px-2 text-[9px] leading-4 text-[#d0d6d6]/25">Weather is model-based planning guidance, not a safety guarantee or an official South African weather warning. Confirm conditions close to departure and be prepared to change the route.</p>
    </div>
  );
}

function WeatherMetric({ icon: Icon, label, value, note }: { icon: WeatherIcon; label: string; value: string; note: string }) {
  return <div className="rounded-2xl bg-[#041421]/48 p-4"><Icon className="size-4 text-[#86b9b0]" /><p className="mt-3 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55">{label}</p><p className="mt-1 text-xs font-semibold text-white">{value}</p><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/36">{note}</p></div>;
}
