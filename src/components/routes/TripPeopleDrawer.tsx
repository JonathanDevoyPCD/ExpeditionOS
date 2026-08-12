"use client";

import { HeartPulse, LoaderCircle, MailPlus, ShieldCheck, Trash2, UserRound, UsersRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import { inviteTripMember, loadTripPeople, removeTripMember, setEmergencySharing, type TripInvitation, type TripMember } from "@/lib/cloudAdventures";
import type { AdventurePlan } from "@/types/adventure";

export default function TripPeopleDrawer({ adventure, currentUserId, onClose }: { adventure: AdventurePlan; currentUserId: string; onClose: () => void }) {
  const [members, setMembers] = useState<TripMember[]>([]);
  const [invitations, setInvitations] = useState<TripInvitation[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const isOwner = adventure.access?.role === "owner";

  async function refresh() {
    setLoading(true);
    try {
      const result = await loadTripPeople(adventure.id);
      setMembers(result.members);
      setInvitations(result.invitations);
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Trip members could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    loadTripPeople(adventure.id)
      .then((result) => { if (active) { setMembers(result.members); setInvitations(result.invitations); } })
      .catch((reason: unknown) => { if (active) setStatus(reason instanceof Error ? reason.message : "Trip members could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [adventure.id]);

  async function invite() {
    if (!email.trim()) return;
    setWorking(true);
    setStatus(null);
    try {
      await inviteTripMember(adventure.id, email.trim(), role);
      setEmail("");
      setStatus("Invitation added. They will see it when they sign in with this email.");
      await refresh();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Invitation could not be created.");
    } finally { setWorking(false); }
  }

  async function remove(userId: string) {
    setWorking(true);
    try { await removeTripMember(adventure.id, userId); await refresh(); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Member could not be removed."); }
    finally { setWorking(false); }
  }

  async function toggleEmergency(enabled: boolean) {
    setWorking(true);
    try { await setEmergencySharing(adventure.id, currentUserId, enabled); await refresh(); setStatus(enabled ? "Emergency details are visible to accepted members of this trip." : "Emergency details are private for this trip."); }
    catch (reason) { setStatus(reason instanceof Error ? reason.message : "Sharing preference could not be updated."); }
    finally { setWorking(false); }
  }

  const me = members.find((member) => member.userId === currentUserId);
  return <><button className="fixed inset-0 z-[80] bg-[#041421]/78 backdrop-blur-sm" onClick={onClose} aria-label="Close trip people" /><aside className="fixed inset-y-0 right-0 z-[90] w-full max-w-[560px] overflow-y-auto border-l border-white/[0.08] bg-[#041421] p-5 shadow-[-30px_0_90px_rgba(0,0,0,.42)] sm:p-7" role="dialog" aria-modal="true"><header className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><UsersRound className="size-5" /></span><div className="min-w-0"><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#86b9b0]/55">Trip collaboration</p><h2 className="truncate text-sm font-semibold text-white">{adventure.name}</h2></div><button onClick={onClose} className="ml-auto grid size-10 place-items-center rounded-xl border border-white/[.08] text-[#d0d6d6]/50"><X className="size-4" /></button></header>
    {isOwner && <section className="mt-7 rounded-[22px] border border-white/[.08] bg-[#042630]/60 p-5"><div className="flex items-center gap-2"><MailPlus className="size-4 text-[#86b9b0]" /><h3 className="text-xs font-semibold text-white">Add someone to this trip</h3></div><p className="mt-2 text-[10px] leading-5 text-[#d0d6d6]/38">Editors can change the route. Viewers can open the complete plan.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_110px]"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@example.com" className="h-11 rounded-xl border border-white/[.08] bg-[#041421]/45 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/40" /><select value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")} className="h-11 rounded-xl border border-white/[.08] bg-[#041421]/45 px-3 text-xs text-white outline-none"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></div><button onClick={invite} disabled={working || !email.trim()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] disabled:opacity-45">{working ? <LoaderCircle className="size-4 animate-spin" /> : <MailPlus className="size-4" />} Add to trip</button></section>}
    <section className="mt-5 rounded-[22px] border border-[#86b9b0]/14 bg-[#86b9b0]/[.06] p-5"><div className="flex items-start gap-3"><HeartPulse className="mt-0.5 size-4 text-[#86b9b0]" /><div className="flex-1"><h3 className="text-xs font-semibold text-white">Emergency profile sharing</h3><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/40">Your medical and emergency contact information is private unless enabled for this trip. ID and passport numbers are never shared.</p></div></div><label className="mt-4 flex cursor-pointer items-center justify-between rounded-xl border border-white/[.07] bg-[#041421]/30 px-4 py-3"><span className="text-[10px] font-semibold text-[#d0d6d6]/68">Share with accepted trip members</span><input type="checkbox" checked={me?.shareEmergencyProfile ?? false} onChange={(e) => toggleEmergency(e.target.checked)} disabled={working} className="size-4 accent-[#86b9b0]" /></label></section>
    <section className="mt-5"><h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d0d6d6]/35">People on this trip</h3>{loading ? <LoaderCircle className="mx-auto mt-8 size-5 animate-spin text-[#86b9b0]" /> : <div className="mt-3 space-y-2">{members.map((member) => <div key={member.userId} className="flex items-center gap-3 rounded-xl border border-white/[.07] bg-[#042630]/48 p-3"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]"><UserRound className="size-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-white">{member.name}{member.userId === currentUserId ? " (you)" : ""}</p><p className="text-[9px] capitalize text-[#d0d6d6]/35">{member.role}{member.shareEmergencyProfile ? " · emergency info shared" : ""}</p></div>{isOwner && member.role !== "owner" && <button onClick={() => remove(member.userId)} disabled={working} className="grid size-8 place-items-center rounded-lg text-[#d0d6d6]/25 hover:text-rose-200" aria-label={`Remove ${member.name}`}><Trash2 className="size-3.5" /></button>}</div>)}{!members.length && <p className="py-5 text-center text-xs text-[#d0d6d6]/35">No members yet.</p>}</div>}</section>
    {isOwner && invitations.some((item) => item.status === "pending") && <section className="mt-5"><h3 className="text-[10px] font-bold uppercase tracking-[.16em] text-[#d0d6d6]/35">Pending invitations</h3><div className="mt-3 space-y-2">{invitations.filter((item) => item.status === "pending").map((invitation) => <div key={invitation.id} className="flex items-center gap-3 rounded-xl border border-white/[.07] px-4 py-3"><ShieldCheck className="size-4 text-[#4c7273]" /><div><p className="text-xs text-white">{invitation.email}</p><p className="text-[9px] capitalize text-[#d0d6d6]/35">{invitation.role} · awaiting response</p></div></div>)}</div></section>}
    {status && <p className="mt-5 rounded-xl border border-white/[.07] bg-[#042630]/55 p-3 text-[10px] leading-5 text-[#d0d6d6]/55">{status}</p>}
    </aside></>;
}
