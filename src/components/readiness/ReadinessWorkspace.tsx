"use client";

import {
  Activity,
  AlertTriangle,
  Bike,
  CalendarClock,
  CheckCircle2,
  Link2,
  LoaderCircle,
  Mountain,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Unlink,
} from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { disconnectStravaAccount, loadStravaStatus, startStravaConnection, syncStravaNow } from "@/lib/strava/client";
import type { ExpeditionProfile } from "@/types/profile";
import type { StravaConnectionStatus } from "@/types/strava";

type Icon = ComponentType<{ className?: string }>;

export default function ReadinessWorkspace({ profile }: { profile: ExpeditionProfile }) {
  const [status, setStatus] = useState<StravaConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function connect() {
    setAction("connect");
    setError(null);
    try {
      await startStravaConnection();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The Strava connection could not be started.");
      setAction(null);
    }
  }

  async function sync() {
    setAction("sync");
    setError(null);
    setMessage(null);
    try {
      const result = await syncStravaNow();
      setStatus(result.status);
      setMessage("Cycling history updated from Strava.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Strava synchronization failed.");
      setStatus(await loadStravaStatus().catch(() => status));
    } finally {
      setAction(null);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Strava and remove all imported activities from ExpeditionOS?")) return;
    setAction("disconnect");
    setError(null);
    try {
      await disconnectStravaAccount();
      setStatus(await loadStravaStatus());
      setMessage("Strava was disconnected and imported activities were removed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Strava could not be disconnected.");
    } finally {
      setAction(null);
    }
  }

  if (loading) return <ReadinessLoading />;

  return (
    <div className="mx-auto w-full max-w-[1380px] p-4 sm:p-6 xl:p-8">
      <section className="rise-in flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#86b9b0]/65">Personal capability</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Readiness for {profile.firstName}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0d6d6]/48">Connect your real cycling history so every route can be compared with distances, climbing and riding time you have actually completed.</p>
        </div>
        {status?.connected && (
          <button onClick={sync} disabled={action !== null} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#fc4c02] px-5 text-xs font-bold text-white transition hover:bg-[#ff6422] disabled:opacity-55">
            {action === "sync" ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {action === "sync" ? "Syncing…" : "Sync Strava"}
          </button>
        )}
      </section>

      {(message || error) && (
        <div className={`mt-6 flex items-start gap-3 rounded-2xl border px-4 py-3 text-xs leading-5 ${error ? "border-rose-300/15 bg-rose-300/[0.07] text-rose-100/78" : "border-[#86b9b0]/15 bg-[#86b9b0]/[0.06] text-[#b8ddd6]"}`}>
          {error ? <AlertTriangle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          {error ?? message}
        </div>
      )}

      {!status?.configured ? (
        <ConfigurationCard />
      ) : !status.connected ? (
        <ConnectCard loading={action === "connect"} onConnect={connect} />
      ) : (
        <ConnectedReadiness status={status} action={action} onDisconnect={disconnect} />
      )}
    </div>
  );
}

function ConnectCard({ loading, onConnect }: { loading: boolean; onConnect: () => void }) {
  return (
    <section className="glass-panel rise-in mt-7 overflow-hidden rounded-[28px]">
      <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
        <div className="p-7 sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#fc4c02] text-white"><Activity className="size-6" /></span>
          <h3 className="mt-6 text-2xl font-semibold tracking-[-0.035em] text-white">Bring your riding history into the plan</h3>
          <p className="mt-3 max-w-xl text-sm leading-7 text-[#d0d6d6]/50">ExpeditionOS imports the latest year of cycling activities, then turns those facts into a private capability baseline. It never publishes or edits anything on Strava.</p>
          <button onClick={onConnect} disabled={loading} className="mt-7 flex h-12 items-center gap-3 rounded-xl bg-[#fc4c02] px-6 text-xs font-bold text-white transition hover:bg-[#ff6422] disabled:opacity-55">
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Link2 className="size-4" />}
            {loading ? "Opening Strava…" : "Connect with Strava"}
          </button>
        </div>
        <div className="border-t border-white/[0.07] bg-[#041421]/38 p-7 sm:p-10 lg:border-l lg:border-t-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/62">What we import</p>
          <div className="mt-5 space-y-4">
            <PrivacyItem icon={Bike} title="Cycling activities only" text="Ride, gravel, mountain-bike, e-bike and virtual cycling summaries." />
            <PrivacyItem icon={TrendingUp} title="Readiness facts" text="Distance, ascent, moving time and optional heart-rate or power summaries." />
            <PrivacyItem icon={ShieldCheck} title="Private by default" text="Tokens are encrypted server-side. Imported history belongs only to your account." />
          </div>
        </div>
      </div>
    </section>
  );
}

function ConfigurationCard() {
  return (
    <section className="glass-panel mt-7 rounded-[28px] p-7 sm:p-10">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-amber-200/10 text-amber-100"><AlertTriangle className="size-5" /></span>
        <div>
          <h3 className="text-lg font-semibold text-white">Strava credentials are ready to be added</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d0d6d6]/48">The secure connection flow is installed, but this deployment still needs its Strava client ID, client secret and token-encryption key. Once those Vercel variables are present, this screen activates automatically.</p>
          <p className="mt-4 rounded-xl border border-white/[0.07] bg-[#041421]/45 px-4 py-3 font-mono text-[11px] text-[#86b9b0]">Callback: /api/strava/callback</p>
        </div>
      </div>
    </section>
  );
}

function ConnectedReadiness({ status, action, onDisconnect }: { status: StravaConnectionStatus; action: string | null; onDisconnect: () => void }) {
  const readiness = status.readiness;
  return (
    <>
      <section className="glass-panel mt-7 flex flex-col gap-5 rounded-[24px] p-5 sm:flex-row sm:items-center sm:p-6">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#fc4c02] text-sm font-black text-white">S</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-semibold text-white">{status.athleteName}</h3><span className="rounded-full bg-[#86b9b0]/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.14em] text-[#86b9b0]">Connected</span></div>
          <p className="mt-1 text-[11px] text-[#d0d6d6]/40">{status.lastSyncedAt ? `Last synced ${formatDateTime(status.lastSyncedAt)}` : "Waiting for the first activity sync"}</p>
          {status.syncError && <p className="mt-2 text-[11px] text-amber-100/65">{status.syncError}</p>}
        </div>
        <button onClick={onDisconnect} disabled={action !== null} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.08] px-4 text-[11px] font-semibold text-[#d0d6d6]/52 transition hover:border-rose-200/20 hover:text-rose-100 disabled:opacity-45"><Unlink className="size-3.5" /> Disconnect</button>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ReadinessMetric icon={Activity} label="Imported rides" value={`${readiness?.activityCount ?? 0}`} note="Latest 365 days" />
        <ReadinessMetric icon={TrendingUp} label="90-day distance" value={`${readiness?.last90DaysDistanceKm ?? 0} km`} note={`${(readiness?.last90DaysAscentM ?? 0).toLocaleString()} m climbed`} />
        <ReadinessMetric icon={Bike} label="Longest ride" value={`${readiness?.longestRideKm ?? 0} km`} note="Personal comparison baseline" />
        <ReadinessMetric icon={Mountain} label="Biggest climb" value={`${(readiness?.biggestClimbM ?? 0).toLocaleString()} m`} note={`${formatMinutes(readiness?.longestMovingMinutes ?? 0)} longest moving`} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_360px]">
        <article className="soft-panel rounded-[22px] p-6">
          <div className="flex items-center gap-3"><CalendarClock className="size-5 text-[#86b9b0]" /><div><h3 className="text-sm font-semibold text-white">Recent training window</h3><p className="mt-1 text-[10px] text-[#d0d6d6]/35">The first inputs for deterministic route readiness</p></div></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <WindowMetric label="Last 30 days" distance={readiness?.last30DaysDistanceKm ?? 0} ascent={readiness?.last30DaysAscentM ?? 0} />
            <WindowMetric label="Last 90 days" distance={readiness?.last90DaysDistanceKm ?? 0} ascent={readiness?.last90DaysAscentM ?? 0} />
          </div>
        </article>
        <article className="soft-panel rounded-[22px] p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="size-4 text-[#86b9b0]" /> Data boundary</div>
          <p className="mt-4 text-[11px] leading-5 text-[#d0d6d6]/45">ExpeditionOS stores compact activity summaries for readiness calculations. Access and refresh tokens are encrypted and never sent to the browser.</p>
          {status.rateLimit?.limitDaily && <p className="mt-4 text-[10px] text-[#d0d6d6]/32">Strava reads today: {status.rateLimit.usedDaily ?? 0} / {status.rateLimit.limitDaily}</p>}
        </article>
      </section>
    </>
  );
}

function ReadinessMetric({ icon: MetricIcon, label, value, note }: { icon: Icon; label: string; value: string; note: string }) {
  return <article className="soft-panel rounded-2xl p-5"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><MetricIcon className="size-[18px]" /></span><p className="mt-5 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d0d6d6]/34">{label}</p><p className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-white">{value}</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">{note}</p></article>;
}

function WindowMetric({ label, distance, ascent }: { label: string; distance: number; ascent: number }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-[#041421]/35 p-4"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#86b9b0]/55">{label}</p><div className="mt-4 flex items-end justify-between gap-3"><div><p className="text-xl font-semibold text-white">{distance} km</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">Distance</p></div><div className="text-right"><p className="text-sm font-semibold text-[#d0d6d6]/75">{ascent.toLocaleString()} m</p><p className="mt-1 text-[10px] text-[#d0d6d6]/35">Ascent</p></div></div></div>;
}

function PrivacyItem({ icon: ItemIcon, title, text }: { icon: Icon; title: string; text: string }) {
  return <div className="flex gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><ItemIcon className="size-4" /></span><div><p className="text-xs font-semibold text-white">{title}</p><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/40">{text}</p></div></div>;
}

function ReadinessLoading() {
  return <div className="grid min-h-[60vh] place-items-center"><div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#86b9b0]" /><p className="mt-3 text-xs text-[#d0d6d6]/40">Loading your readiness baseline…</p></div></div>;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}
