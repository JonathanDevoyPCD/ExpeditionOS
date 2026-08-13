"use client";

import {
  Activity,
  AlertTriangle,
  Bike,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Link2,
  LoaderCircle,
  Mountain,
  RefreshCw,
  Route as RouteIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Unlink,
} from "lucide-react";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { buildRouteStages } from "@/lib/routeStages";
import { disconnectStravaAccount, loadRouteReadiness, loadStravaStatus, startStravaConnection, syncStravaNow } from "@/lib/strava/client";
import type { AdventurePlan, CopilotBlueprint, RouteAnchor } from "@/types/adventure";
import type { ExpeditionProfile } from "@/types/profile";
import type { RouteDataset } from "@/types/route";
import type { RouteReadinessFactor, RouteReadinessReport, RouteReadinessTarget, StravaConnectionStatus } from "@/types/strava";

type Icon = ComponentType<{ className?: string }>;
type RouteOption = { key: string; route: RouteDataset; days: number; source: string; anchors: RouteAnchor[]; blueprint: CopilotBlueprint | null };

export default function ReadinessWorkspace({ profile, adventures, activeRoute }: { profile: ExpeditionProfile; adventures: AdventurePlan[]; activeRoute: RouteDataset }) {
  const [status, setStatus] = useState<StravaConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RouteReadinessReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const routeOptions = useMemo<RouteOption[]>(() => {
    const saved: RouteOption[] = adventures.map((adventure) => ({ key: adventure.id, route: adventure.route, days: adventure.days, source: adventure.source, anchors: adventure.anchors, blueprint: adventure.blueprint ?? null }));
    if (!saved.some((option) => option.route.id === activeRoute.id)) saved.unshift({ key: `active:${activeRoute.id}`, route: activeRoute, days: 1, source: "active route", anchors: [], blueprint: null });
    return saved;
  }, [activeRoute, adventures]);
  const initialOption = routeOptions.find((option) => option.route.id === activeRoute.id) ?? routeOptions[0];
  const [selectedKey, setSelectedKey] = useState(initialOption?.key ?? "");
  const selectedOption = routeOptions.find((option) => option.key === selectedKey) ?? initialOption;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("strava");
    queueMicrotask(() => {
      if (result === "connected") setMessage("Strava connected. Your latest cycling history is ready.");
      if (result === "cancelled") setMessage("Strava connection was cancelled. Nothing changed.");
      if (result === "scope_required") setError("ExpeditionOS needs permission to read your activity history. Please reconnect and approve the requested activity scope.");
      if (result === "invalid_state" || result === "session_expired") setError("That Strava connection request expired. Please start again.");
      if (result === "failed") setError("Strava could not be connected. Please try again.");
    });
    if (result) {
      params.delete("strava");
      params.delete("view");
      window.history.replaceState({}, "", `${window.location.pathname}${params.size ? `?${params.toString()}` : ""}`);
    }

    loadStravaStatus()
      .then(setStatus)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Strava status could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!status?.connected || !selectedOption) return;
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setReportLoading(true);
      setReportError(null);
    });
    const stagePlan = buildRouteStages(selectedOption.route, selectedOption.days, selectedOption.anchors, selectedOption.blueprint);
    const target: RouteReadinessTarget = {
      id: selectedOption.route.id,
      name: selectedOption.route.name,
      days: selectedOption.days,
      distanceKm: selectedOption.route.metrics.distanceKm,
      ascentM: selectedOption.route.metrics.ascentM,
      estimatedMovingMinutes: selectedOption.route.metrics.estimatedMovingMinutes,
      stages: stagePlan.stages,
      stageSource: stagePlan.source,
    };
    loadRouteReadiness(target)
      .then((result) => { if (active) setReport(result); })
      .catch((reason: unknown) => { if (active) { setReport(null); setReportError(reason instanceof Error ? reason.message : "Route readiness could not be calculated."); } })
      .finally(() => { if (active) setReportLoading(false); });
    return () => { active = false; };
  }, [selectedOption, status?.connected, status?.lastSyncedAt]);

  async function connect() {
    setAction("connect");
    setError(null);
    try { await startStravaConnection(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "The Strava connection could not be started."); setAction(null); }
  }

  async function sync() {
    setAction("sync");
    setError(null);
    setMessage(null);
    try {
      const result = await syncStravaNow();
      setStatus(result.status);
      setMessage("Cycling history updated from Strava. Route readiness has been recalculated.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Strava synchronization failed.");
      setStatus(await loadStravaStatus().catch(() => status));
    } finally { setAction(null); }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Strava and remove all imported activities from ExpeditionOS?")) return;
    setAction("disconnect");
    setError(null);
    try {
      await disconnectStravaAccount();
      setStatus(await loadStravaStatus());
      setReport(null);
      setMessage("Strava was disconnected and imported activities were removed.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Strava could not be disconnected."); }
    finally { setAction(null); }
  }

  if (loading) return <ReadinessLoading />;

  return (
    <div className="mx-auto w-full max-w-[1380px] p-4 sm:p-6 xl:p-8">
      <section className="rise-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86b9b0]/65">Personal capability</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Readiness for {profile.firstName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0d6d6]/48">Select a route to compare its daily distance, climbing and duration with cycling efforts you have actually completed.</p>
        </div>
        {status?.connected && <button onClick={sync} disabled={action !== null} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-5 text-xs font-bold text-white transition hover:bg-[#ff6422] disabled:opacity-55">{action === "sync" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}{action === "sync" ? "Syncing…" : "Sync Strava"}</button>}
      </section>

      {(message || error) && <div className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs leading-5 ${error ? "border-rose-300/15 bg-rose-300/[0.07] text-rose-100/78" : "border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] text-[#b8ddd6]"}`}>{error ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}{error ?? message}</div>}

      {!status?.configured ? <ConfigurationCard /> : !status.connected ? <ConnectCard loading={action === "connect"} onConnect={connect} /> : (
        <ConnectedReadiness status={status} action={action} onDisconnect={disconnect} routeOptions={routeOptions} selectedKey={selectedOption?.key ?? ""} onSelect={setSelectedKey} report={report} reportLoading={reportLoading} reportError={reportError} />
      )}
    </div>
  );
}

function ConnectedReadiness({ status, action, onDisconnect, routeOptions, selectedKey, onSelect, report, reportLoading, reportError }: { status: StravaConnectionStatus; action: string | null; onDisconnect: () => void; routeOptions: RouteOption[]; selectedKey: string; onSelect: (key: string) => void; report: RouteReadinessReport | null; reportLoading: boolean; reportError: string | null }) {
  const readiness = status.readiness;
  return <>
    <section className="glass-panel mt-7 flex flex-col gap-5 rounded-[24px] p-5 sm:flex-row sm:items-center sm:p-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fc4c02] text-sm font-black text-white">S</span>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-white">{status.athleteName}</h3><span className="rounded-full bg-[#86b9b0]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#86b9b0]">Connected</span></div><p className="mt-1 text-[11px] text-[#d0d6d6]/40">{status.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}` : "Waiting for the first activity sync"}</p>{status.syncError && <p className="mt-2 text-[11px] text-amber-100/65">{status.syncError}</p>}</div>
      <button onClick={onDisconnect} disabled={action !== null} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-[11px] font-semibold text-[#d0d6d6]/52 transition hover:border-rose-200/20 hover:text-rose-100 disabled:opacity-45"><Unlink className="size-3.5" /> Disconnect</button>
    </section>

    <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ReadinessMetric icon={Activity} label="Imported rides" value={`${readiness?.activityCount ?? 0}`} note="Latest 365 days" />
      <ReadinessMetric icon={TrendingUp} label="90-day distance" value={`${readiness?.last90DaysDistanceKm ?? 0} km`} note={`${(readiness?.last90DaysAscentM ?? 0).toLocaleString()} m climbed`} />
      <ReadinessMetric icon={Bike} label="Longest ride" value={`${readiness?.longestRideKm ?? 0} km`} note="Personal comparison baseline" />
      <ReadinessMetric icon={Mountain} label="Biggest climb" value={`${(readiness?.biggestClimbM ?? 0).toLocaleString()} m`} note={`${formatMinutes(readiness?.longestMovingMinutes ?? 0)} longest moving`} />
    </section>

    <section className="glass-panel mt-4 rounded-[26px] p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="flex items-center gap-2 text-sm font-semibold text-white"><RouteIcon className="size-4 text-[#86b9b0]" /> Route comparison</div><p className="mt-2 text-[11px] leading-5 text-[#d0d6d6]/42">Scores use versioned rules and your private activity summaries—no AI-generated claims.</p></div>
        <label className="block min-w-0 lg:w-[430px]"><span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#86b9b0]/55">Route to assess</span><select value={selectedKey} onChange={(event) => onSelect(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421] px-3 text-xs font-semibold text-white outline-none transition focus:border-[#86b9b0]/45">{routeOptions.map((option) => <option key={option.key} value={option.key}>{option.route.name} · {option.days} day{option.days === 1 ? "" : "s"}</option>)}</select></label>
      </div>

      {reportLoading ? <div className="grid min-h-64 place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin text-[#86b9b0]" /><p className="mt-3 text-xs text-[#d0d6d6]/42">Comparing this route with your riding history…</p></div></div> : reportError ? <div className="mt-5 flex gap-3 rounded-2xl border border-rose-200/15 bg-rose-200/[0.06] p-4 text-xs text-rose-100/75"><AlertTriangle className="size-4 shrink-0" />{reportError}</div> : report ? <ReadinessReportView report={report} /> : null}
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
      <article className="soft-panel rounded-[22px] p-6"><div className="flex items-center gap-3"><CalendarClock className="size-5 text-[#86b9b0]" /><div><h3 className="text-sm font-semibold text-white">Recent training window</h3><p className="mt-1 text-[10px] text-[#d0d6d6]/35">The evidence behind route readiness</p></div></div><div className="mt-6 grid gap-3 sm:grid-cols-2"><WindowMetric label="Last 30 days" distance={readiness?.last30DaysDistanceKm ?? 0} ascent={readiness?.last30DaysAscentM ?? 0} /><WindowMetric label="Last 90 days" distance={readiness?.last90DaysDistanceKm ?? 0} ascent={readiness?.last90DaysAscentM ?? 0} /></div></article>
      <article className="soft-panel rounded-[22px] p-6"><div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-[#86b9b0]" /> Data boundary</div><p className="mt-4 text-[11px] leading-5 text-[#d0d6d6]/45">Readiness is private to your account. Trip members can see the route, but they cannot see your imported activities or personal score.</p>{status.rateLimit?.limitDaily && <p className="mt-4 text-[10px] text-[#d0d6d6]/32">Strava reads today: {status.rateLimit.usedDaily ?? 0} / {status.rateLimit.limitDaily}</p>}</article>
    </section>
  </>;
}

function ReadinessReportView({ report }: { report: RouteReadinessReport }) {
  const verdictTone = report.verdict === "viable" ? "text-[#b8ddd6]" : report.verdict === "viable_with_changes" ? "text-amber-100" : "text-rose-100";
  return <div className="mt-6">
    <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
      <article className="rounded-[22px] border border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] p-6"><p className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#86b9b0]/58">Overall readiness</p><div className="mt-5 flex items-end gap-2"><span className={`text-6xl font-semibold tracking-[-0.07em] ${verdictTone}`}>{report.overallScore}</span><span className="pb-2 text-sm text-[#d0d6d6]/38">/ 100</span></div><p className={`mt-4 text-sm font-semibold ${verdictTone}`}>{report.verdictLabel}</p><p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/40">{report.confidence.level} confidence · {report.confidence.summary}</p></article>
      <div className="grid gap-3 sm:grid-cols-3"><TargetMetric icon={RouteIcon} label="Hardest day" value={`Day ${report.route.hardestStage.day} · ${report.route.hardestStage.distanceKm} km`} note={`${report.route.days} riding day${report.route.days === 1 ? "" : "s"}`} /><TargetMetric icon={Mountain} label="Hardest-day climbing" value={`${report.route.hardestStage.ascentM.toLocaleString()} m`} note={`${report.route.hardestStage.descentM.toLocaleString()} m descent`} /><TargetMetric icon={Clock3} label="Hardest-day time" value={formatMinutes(report.route.hardestStage.estimatedMovingMinutes)} note="Estimated moving time" /></div>
    </div>

    {report.route.days > 1 && <article className="mt-4 rounded-[22px] border border-white/[0.07] bg-[#041421]/35 p-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-semibold text-white">Stage load</h4><p className="mt-1 text-[10px] text-[#d0d6d6]/38">The readiness score tests the demanding days rather than hiding them inside a trip average.</p></div><span className="w-fit rounded-full border border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] px-3 py-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-[#86b9b0]/70">{stageSourceLabel(report.route.stageSource)}</span></div><div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{report.route.stages.map((stage) => { const hardest = stage.day === report.route.hardestStage.day; return <div key={stage.day} className={`rounded-xl border p-3 ${hardest ? "border-[#86b9b0]/30 bg-[#86b9b0]/[0.08]" : "border-white/[0.06] bg-[#042630]/38"}`}><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#86b9b0]">Day {stage.day}</p>{hardest && <span className="text-[8px] font-bold uppercase tracking-[0.1em] text-[#b8ddd6]">Hardest</span>}</div><p className="mt-2 text-sm font-semibold text-white">{stage.distanceKm} km</p><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/38">{stage.ascentM.toLocaleString()} m up · {formatMinutes(stage.estimatedMovingMinutes)}</p></div>; })}</div></article>}

    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{report.factors.map((factor) => <FactorCard key={factor.id} factor={factor} critical={factor.id === report.criticalFactorId} />)}</div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_0.8fr]">
      <article className="rounded-[22px] border border-white/[0.07] bg-[#041421]/35 p-5"><div className="flex items-center gap-2"><Sparkles className="size-4 text-[#86b9b0]" /><h4 className="text-sm font-semibold text-white">Closest completed rides</h4></div>{report.comparableActivities.length ? <div className="mt-4 space-y-2">{report.comparableActivities.map((activity) => <div key={activity.activityId} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#042630]/48 p-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[10px] font-bold text-[#86b9b0]">{activity.similarityScore}</span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{activity.name}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/38">{formatDate(activity.startDate)} · {activity.distanceKm} km · {activity.ascentM.toLocaleString()} m · {formatMinutes(activity.movingMinutes)}</p></div><ChevronRight className="size-4 text-[#d0d6d6]/20" /></div>)}</div> : <p className="mt-4 text-[11px] text-[#d0d6d6]/38">Sync at least one cycling activity to find comparable rides.</p>}</article>
      <article className="rounded-[22px] border border-white/[0.07] bg-[#041421]/35 p-5"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-100" /><h4 className="text-sm font-semibold text-white">Limits and unknowns</h4></div><ul className="mt-4 space-y-3">{report.unknowns.map((item) => <li key={item} className="flex gap-2 text-[10px] leading-5 text-[#d0d6d6]/44"><span className="mt-2 size-1 shrink-0 rounded-full bg-amber-100/65" />{item}</li>)}</ul><p className="mt-5 border-t border-white/[0.06] pt-4 text-[9px] text-[#d0d6d6]/26">Rules: {report.ruleVersion}. Guidance is not a safety or medical guarantee.</p></article>
    </div>
  </div>;
}

function FactorCard({ factor, critical }: { factor: RouteReadinessFactor; critical: boolean }) {
  const tone = factor.status === "strong" ? "bg-[#86b9b0]" : factor.status === "watch" ? "bg-amber-200" : "bg-rose-300";
  return <article className={`rounded-2xl border p-4 ${critical ? "border-rose-200/20 bg-rose-200/[0.04]" : "border-white/[0.07] bg-[#041421]/35"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#d0d6d6]/45">{factor.label}</p>{critical && <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-rose-100/65">Largest gap</p>}</div><span className="text-xl font-semibold text-white">{factor.score}</span></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={`h-full rounded-full ${tone}`} style={{ width: `${factor.score}%` }} /></div><p className="mt-4 text-[10px] leading-5 text-[#d0d6d6]/48">{factor.summary}</p><p className="mt-2 text-[9px] leading-4 text-[#d0d6d6]/30">{factor.evidence.join(" · ")}</p></article>;
}

function ConnectCard({ loading, onConnect }: { loading: boolean; onConnect: () => void }) { return <section className="glass-panel rise-in mt-7 overflow-hidden rounded-[28px]"><div className="grid lg:grid-cols-[1.1fr_0.9fr]"><div className="p-7 sm:p-10"><span className="grid size-12 place-items-center rounded-2xl bg-[#fc4c02] text-white"><Activity className="size-6" /></span><h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-white">Bring your riding history into the plan</h3><p className="mt-3 max-w-xl text-sm leading-7 text-[#d0d6d6]/50">ExpeditionOS imports the latest year of cycling activities, then compares those facts privately with any saved route.</p><button onClick={onConnect} disabled={loading} className="mt-7 flex h-12 items-center gap-3 rounded-xl bg-[#fc4c02] px-6 text-xs font-bold text-white transition hover:bg-[#ff6422] disabled:opacity-55">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}{loading ? "Opening Strava…" : "Connect with Strava"}</button></div><div className="border-t border-white/[0.07] bg-[#041421]/38 p-7 sm:p-10 lg:border-l lg:border-t-0"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/62">What we import</p><div className="mt-5 space-y-4"><PrivacyItem icon={Bike} title="Cycling activities only" text="Ride, gravel, mountain-bike, e-bike and virtual cycling summaries." /><PrivacyItem icon={TrendingUp} title="Readiness facts" text="Distance, ascent, moving time and optional heart-rate or power summaries." /><PrivacyItem icon={ShieldCheck} title="Private by default" text="Tokens are encrypted server-side. Imported history belongs only to your account." /></div></div></div></section>; }

function ConfigurationCard() { return <section className="glass-panel mt-7 rounded-[28px] p-7 sm:p-10"><div className="flex items-start gap-4"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-200/10 text-amber-100"><AlertTriangle className="size-5" /></span><div><h3 className="text-lg font-semibold text-white">Strava credentials are ready to be added</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0d6d6]/48">This deployment needs its Strava client ID, client secret and token-encryption key. Once those Vercel variables are present, this screen activates automatically.</p><p className="mt-4 rounded-xl border border-white/[0.07] bg-[#041421]/45 px-4 py-3 font-mono text-[11px] text-[#86b9b0]">Callback: /api/strava/callback</p></div></div></section>; }

function ReadinessMetric({ icon: MetricIcon, label, value, note }: { icon: Icon; label: string; value: string; note: string }) { return <article className="soft-panel rounded-2xl p-5"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><MetricIcon className="size-[18px]" /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d0d6d6]/34">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">{note}</p></article>; }
function TargetMetric({ icon: MetricIcon, label, value, note }: { icon: Icon; label: string; value: string; note: string }) { return <article className="rounded-[22px] border border-white/[0.07] bg-[#041421]/35 p-5"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><MetricIcon className="size-4" /></span><p className="mt-5 text-[9px] font-bold uppercase tracking-[0.14em] text-[#d0d6d6]/34">{label}</p><p className="mt-1 text-xl font-semibold text-white">{value}</p><p className="mt-1 text-[9px] text-[#d0d6d6]/32">{note}</p></article>; }
function WindowMetric({ label, distance, ascent }: { label: string; distance: number; ascent: number }) { return <div className="rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86b9b0]/55">{label}</p><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xl font-semibold text-white">{distance} km</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">Distance</p></div><div className="text-right"><p className="text-sm font-semibold text-[#d0d6d6]/75">{ascent.toLocaleString()} m</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">Ascent</p></div></div></div>; }
function PrivacyItem({ icon: ItemIcon, title, text }: { icon: Icon; title: string; text: string }) { return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><ItemIcon className="size-4" /></span><div><p className="text-xs font-semibold text-white">{title}</p><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/40">{text}</p></div></div>; }
function ReadinessLoading() { return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#86b9b0]" /><p className="mt-3 text-xs text-[#d0d6d6]/40">Loading your readiness baseline…</p></div></div>; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatDate(value: string) { return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value)); }
function formatMinutes(minutes: number) { const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return hours ? `${hours}h ${remainder}m` : `${remainder}m`; }
function stageSourceLabel(source: RouteReadinessReport["route"]["stageSource"]) { return source === "overnight_anchors" ? "Confirmed overnight stages" : source === "copilot_targets" ? "Copilot target stages" : "Equal route split"; }
