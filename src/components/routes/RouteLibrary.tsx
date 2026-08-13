"use client";

import { ArrowRight, CalendarDays, Check, Cloud, Globe2, Lock, Map, Plus, Route, Sparkles, Trash2, UsersRound, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import TripPeopleDrawer from "@/components/routes/TripPeopleDrawer";
import { loadPendingTripInvitations, respondToTripInvitation, type PendingTripInvitation } from "@/lib/cloudAdventures";
import { adventureRoleLabel, type AdventurePlan } from "@/types/adventure";

export default function RouteLibrary({ adventures, syncStatus, currentUserId, onOpen, onCreate, onDelete, onRefresh }: { adventures: AdventurePlan[]; syncStatus: string; currentUserId: string; onOpen: (adventure: AdventurePlan) => void; onCreate: () => void; onDelete: (id: string) => void; onRefresh: () => Promise<void> }) {
  const [sharing, setSharing] = useState<AdventurePlan | null>(null);
  const [invitations, setInvitations] = useState<PendingTripInvitation[]>([]);
  const [responding, setResponding] = useState<string | null>(null);

  async function refreshInvitations() {
    try { setInvitations(await loadPendingTripInvitations()); } catch { setInvitations([]); }
  }
  useEffect(() => {
    let active = true;
    loadPendingTripInvitations().then((next) => { if (active) setInvitations(next); }).catch(() => { if (active) setInvitations([]); });
    return () => { active = false; };
  }, []);

  async function respond(id: string, accept: boolean) {
    setResponding(id);
    try { await respondToTripInvitation(id, accept); await Promise.all([refreshInvitations(), onRefresh()]); }
    finally { setResponding(null); }
  }

  return <div className="mx-auto max-w-[1740px] p-4 sm:p-6 xl:p-8">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/55">Route library</p><h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">Routes</h2><p className="mt-2 text-sm text-[#d0d6d6]/44">Your private trips, invited routes, and public expeditions in one place.</p><p className="mt-2 flex items-center gap-1.5 text-[9px] text-[#86b9b0]/48"><Cloud className="size-3" /> {syncStatus}</p></div><button onClick={onCreate} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421]"><Plus className="size-4" /> Create adventure</button></div>

    {!!invitations.length && <section className="mt-7 rounded-[24px] border border-[#86b9b0]/18 bg-[#86b9b0]/[.07] p-5"><div className="flex items-center gap-2"><UsersRound className="size-4 text-[#86b9b0]" /><h3 className="text-xs font-semibold text-white">Trip invitations</h3><span className="rounded-full bg-[#86b9b0]/12 px-2 py-0.5 text-[9px] font-bold text-[#86b9b0]">{invitations.length}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{invitations.map((invitation) => <article key={invitation.id} className="rounded-xl border border-white/[.07] bg-[#041421]/32 p-4"><p className="text-xs font-semibold text-white">You have been invited to a trip</p><p className="mt-1 text-[9px] text-[#d0d6d6]/38">{adventureRoleLabel(invitation.role)} access · route {invitation.adventureId.slice(-8)}</p><div className="mt-3 flex gap-2"><button disabled={responding === invitation.id} onClick={() => respond(invitation.id, true)} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg bg-[#86b9b0] text-[10px] font-bold text-[#041421]"><Check className="size-3" /> Accept</button><button disabled={responding === invitation.id} onClick={() => respond(invitation.id, false)} className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-white/[.08] text-[10px] font-semibold text-[#d0d6d6]/55"><X className="size-3" /> Decline</button></div></article>)}</div></section>}

    {adventures.length ? <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{adventures.map((adventure) => {
      const canManage = adventure.access?.role === "owner";
      const role = adventure.access?.role ?? "owner";
      return <article key={adventure.id} className="glass-panel group rounded-[24px] p-5 transition hover:-translate-y-1 hover:border-[#86b9b0]/25"><div className="flex items-start gap-3"><span className="grid size-11 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]">{adventure.source === "copilot" ? <Sparkles className="size-5" /> : <Route className="size-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-white">{adventure.name}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-[#86b9b0]/55"><span>{adventureRoleLabel(role)} · {adventure.source}</span><span className="flex items-center gap-1 rounded-full border border-white/[.07] px-2 py-0.5 text-[#d0d6d6]/40">{adventure.visibility === "public" ? <Globe2 className="size-2.5" /> : <Lock className="size-2.5" />}{adventure.visibility}</span></div></div>{canManage && <button onClick={() => onDelete(adventure.id)} className="grid size-8 place-items-center rounded-lg text-[#d0d6d6]/24 transition hover:bg-white/[0.05] hover:text-rose-200" aria-label={`Delete ${adventure.name}`}><Trash2 className="size-3.5" /></button>}</div><p className="mt-4 line-clamp-2 min-h-10 text-[10px] leading-5 text-[#d0d6d6]/40">{adventure.description}</p><div className="mt-5 grid grid-cols-3 gap-2"><Metric icon={<Map className="size-3.5" />} value={String(adventure.route.metrics.distanceKm)} label="kilometres" /><Metric icon={<Route className="size-3.5" />} value={adventure.route.metrics.ascentM.toLocaleString()} label="metres up" /><Metric icon={<CalendarDays className="size-3.5" />} value={String(adventure.days)} label="days" /></div><div className={`mt-5 grid gap-2 ${adventure.access?.isMember ? "grid-cols-[1fr_auto]" : "grid-cols-1"}`}><button onClick={() => onOpen(adventure)} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/18 text-[10px] font-bold text-[#86b9b0] transition group-hover:bg-[#86b9b0]/8">Open route <ArrowRight className="size-3.5" /></button>{adventure.access?.isMember && <button onClick={() => setSharing(adventure)} className="grid size-10 place-items-center rounded-xl border border-white/[.08] text-[#d0d6d6]/45 transition hover:border-[#86b9b0]/25 hover:text-[#86b9b0]" aria-label={`People on ${adventure.name}`}><UsersRound className="size-4" /></button>}</div></article>;
    })}</div> : <div className="glass-panel mt-7 rounded-[28px] px-6 py-16 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#86b9b0]/10 text-[#86b9b0]"><Route className="size-7" /></span><h3 className="mt-5 text-lg font-semibold text-white">Your route library is ready</h3><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-[#d0d6d6]/42">Create a route by clicking map anchors or describe a complete bike-packing trip to the Copilot.</p><button onClick={onCreate} className="mt-5 rounded-xl bg-[#86b9b0] px-5 py-3 text-xs font-bold text-[#041421]">Create your first adventure</button></div>}
    {sharing && <TripPeopleDrawer adventure={sharing} currentUserId={currentUserId} onClose={() => setSharing(null)} onChanged={onRefresh} />}
  </div>;
}

function Metric({ icon, value, label }: { icon: ReactNode; value: string; label: string }) { return <div className="rounded-xl bg-[#041421]/40 p-3"><span className="text-[#86b9b0]">{icon}</span><p className="mt-2 text-sm font-semibold text-white">{value}</p><p className="text-[8px] uppercase text-[#d0d6d6]/30">{label}</p></div>; }
