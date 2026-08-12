"use client";

import { ContactRound, Download, FileText, HeartPulse, IdCard, LoaderCircle, LockKeyhole, MapPin, Save, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { deleteAccount, downloadAccountData, exportAccountData } from "@/lib/account";
import { saveProfile } from "@/lib/profiles";
import type { ExpeditionProfile } from "@/types/profile";

export default function ProfileDrawer({ profile, onClose, onSaved }: { profile: ExpeditionProfile; onClose: () => void; onSaved: (profile: ExpeditionProfile) => void }) {
  const [draft, setDraft] = useState(profile);
  const [saving, setSaving] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const set = (key: keyof ExpeditionProfile, value: string) => setDraft((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      setStatus("First and last name are required.");
      return;
    }
    setSaving(true);
    setStatus(null);
    try {
      const next = await saveProfile(draft);
      setDraft(next);
      onSaved(next);
      setStatus("Profile saved securely.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Your profile could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function downloadExport() {
    setAccountBusy(true);
    setStatus(null);
    try {
      downloadAccountData(await exportAccountData(profile.id));
      setStatus("Account export downloaded.");
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Your account export could not be created.");
    } finally {
      setAccountBusy(false);
    }
  }

  async function removeAccount() {
    if (deleteConfirmation !== "DELETE") return;
    setAccountBusy(true);
    setStatus(null);
    try {
      await deleteAccount();
      onClose();
    } catch (reason) {
      setStatus(reason instanceof Error ? reason.message : "Your account could not be deleted.");
      setAccountBusy(false);
    }
  }

  return (
    <>
      <button className="fixed inset-0 z-[80] bg-[#041421]/80 backdrop-blur-sm" onClick={onClose} aria-label="Close profile" />
      <aside className="fixed inset-y-0 right-0 z-[90] w-full max-w-[720px] overflow-y-auto border-l border-white/[0.08] bg-[#041421] shadow-[-30px_0_90px_rgba(0,0,0,0.45)]" role="dialog" aria-modal="true" aria-labelledby="profile-heading">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.07] bg-[#041421]/92 px-5 py-4 backdrop-blur-xl sm:px-7"><span className="grid size-10 place-items-center rounded-xl bg-[#86b9b0]/12 text-[#86b9b0]"><UserRound className="size-5" /></span><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/60">Private account</p><h2 id="profile-heading" className="text-sm font-semibold text-white">Profile & emergency information</h2></div><button onClick={onClose} className="ml-auto grid size-10 place-items-center rounded-xl border border-white/[0.08] text-[#d0d6d6]/55 hover:text-white" aria-label="Close profile"><X className="size-4" /></button></header>
        <div className="space-y-5 p-5 sm:p-7">
          <div className="rounded-2xl border border-[#86b9b0]/15 bg-[#86b9b0]/[0.07] p-4"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-[#86b9b0]" /><div><p className="text-xs font-semibold text-white">Private by design</p><p className="mt-1 text-[10px] leading-5 text-[#d0d6d6]/45">ID and passport numbers are only visible to you. Medical and emergency details are hidden from trip members unless you explicitly share them on a specific trip.</p></div></div></div>

          <ProfileSection icon={<ContactRound className="size-4" />} title="Personal details" note="Basic details used for your ExpeditionOS profile.">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="First name" value={draft.firstName} onChange={(v) => set("firstName", v)} required /><Field label="Last name" value={draft.lastName} onChange={(v) => set("lastName", v)} required /><Field label="Email address" value={draft.email} readOnly /><Field label="Contact number" value={draft.phone} readOnly note={draft.phoneVerified ? "Verified" : "Captured — verification pending"} /><Field label="Date of birth" type="date" value={draft.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} /><SelectField label="Gender" value={draft.gender} onChange={(v) => set("gender", v)} options={[['', 'Select'], ['female', 'Female'], ['male', 'Male'], ['non_binary', 'Non-binary'], ['self_described', 'Self-described'], ['prefer_not_to_say', 'Prefer not to say']]} />{draft.gender === "self_described" && <Field label="Gender description" value={draft.genderDescription} onChange={(v) => set("genderDescription", v)} />}</div>
          </ProfileSection>

          <ProfileSection icon={<MapPin className="size-4" />} title="Home location" note="Used later for route origins and local recommendations.">
            <div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Field label="Address" value={draft.addressLine1} onChange={(v) => set("addressLine1", v)} /></div><div className="sm:col-span-2"><Field label="Address line 2" value={draft.addressLine2} onChange={(v) => set("addressLine2", v)} /></div><Field label="City" value={draft.city} onChange={(v) => set("city", v)} /><Field label="Province" value={draft.province} onChange={(v) => set("province", v)} /><div className="sm:col-span-2"><Field label="Country" value={draft.country} onChange={(v) => set("country", v)} /></div></div>
          </ProfileSection>

          <ProfileSection icon={<IdCard className="size-4" />} title="Travel identification" note="Owner-only information. Never shown to trip members.">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="South African ID number" value={draft.saIdNumber} onChange={(v) => set("saIdNumber", v)} /><Field label="Passport number" value={draft.passportNumber} onChange={(v) => set("passportNumber", v)} /></div>
          </ProfileSection>

          <ProfileSection icon={<HeartPulse className="size-4" />} title="Medical & emergency" note="Optional safety information. Sharing is off for every trip by default.">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Emergency contact full name" value={draft.emergencyContactName} onChange={(v) => set("emergencyContactName", v)} /><Field label="Emergency contact number" value={draft.emergencyContactPhone} onChange={(v) => set("emergencyContactPhone", v)} /><Field label="Medical aid name" value={draft.medicalAidName} onChange={(v) => set("medicalAidName", v)} /><Field label="Medical aid number" value={draft.medicalAidNumber} onChange={(v) => set("medicalAidNumber", v)} /><SelectField label="Blood type" value={draft.bloodType} onChange={(v) => set("bloodType", v)} options={[['', 'Select'], ['A+', 'A+'], ['A-', 'A-'], ['B+', 'B+'], ['B-', 'B-'], ['AB+', 'AB+'], ['AB-', 'AB-'], ['O+', 'O+'], ['O-', 'O-'], ['Unknown', 'Unknown']]} /><Field label="Allergies" value={draft.allergies} onChange={(v) => set("allergies", v)} /><Field label="Doctor's name" value={draft.doctorName} onChange={(v) => set("doctorName", v)} /><Field label="Doctor's contact number" value={draft.doctorPhone} onChange={(v) => set("doctorPhone", v)} /><div className="sm:col-span-2"><TextArea label="Additional information" value={draft.additionalInformation} onChange={(v) => set("additionalInformation", v)} /></div></div>
          </ProfileSection>

          <ProfileSection icon={<LockKeyhole className="size-4" />} title="One-time code preference" note="SMS becomes available after a phone provider is configured and your number is verified.">
            <SelectField label="Preferred OTP method" value={draft.preferredOtpChannel} onChange={(v) => setDraft((current) => ({ ...current, preferredOtpChannel: v === "sms" ? "sms" : "email" }))} options={[["email", "Email"], ["sms", "Contact number (setup pending)"]]} />
          </ProfileSection>

          <ProfileSection icon={<ShieldCheck className="size-4" />} title="Account & data" note="Review the alpha policies, download your information, or permanently close your account.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Link href="/privacy" target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#041421]/35 px-4 text-xs font-semibold text-[#d0d6d6]/62 transition hover:border-[#86b9b0]/30 hover:text-white"><FileText className="size-4 text-[#86b9b0]" /> Privacy notice</Link>
              <Link href="/terms" target="_blank" rel="noreferrer" className="flex h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-[#041421]/35 px-4 text-xs font-semibold text-[#d0d6d6]/62 transition hover:border-[#86b9b0]/30 hover:text-white"><FileText className="size-4 text-[#86b9b0]" /> Terms of use</Link>
            </div>
            <button type="button" onClick={downloadExport} disabled={accountBusy} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#86b9b0]/20 bg-[#86b9b0]/[0.07] text-xs font-semibold text-[#86b9b0] transition hover:bg-[#86b9b0]/12 disabled:opacity-50">{accountBusy && !deleteOpen ? <LoaderCircle className="size-4 animate-spin" /> : <Download className="size-4" />} Download my account data</button>
            {!deleteOpen ? <button type="button" onClick={() => { setDeleteOpen(true); setStatus(null); }} className="mt-3 flex h-10 w-full items-center justify-center gap-2 text-[10px] font-semibold text-rose-200/55 transition hover:text-rose-200"><Trash2 className="size-3.5" /> Delete account</button> : <div className="mt-4 rounded-2xl border border-rose-300/15 bg-rose-300/[0.05] p-4"><p className="text-xs font-semibold text-rose-100/85">Permanently delete this account?</p><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/42">Download an export first if needed. This removes your profile and owned data and cannot be undone. Type <strong className="text-rose-100/80">DELETE</strong> to continue.</p><input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} placeholder="Type DELETE" className="mt-3 h-10 w-full rounded-xl border border-rose-300/15 bg-[#041421]/45 px-3 text-xs text-white outline-none focus:border-rose-300/35" /><div className="mt-3 flex justify-end gap-2"><button type="button" onClick={() => { setDeleteOpen(false); setDeleteConfirmation(""); }} className="h-9 px-3 text-[10px] font-semibold text-[#d0d6d6]/45 hover:text-white">Cancel</button><button type="button" onClick={removeAccount} disabled={deleteConfirmation !== "DELETE" || accountBusy} className="flex h-9 items-center gap-2 rounded-xl bg-rose-300/85 px-4 text-[10px] font-bold text-[#041421] disabled:opacity-35">{accountBusy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />} Delete permanently</button></div></div>}
          </ProfileSection>

          <div className="sticky bottom-0 -mx-5 flex items-center gap-3 border-t border-white/[0.07] bg-[#041421]/92 px-5 py-4 backdrop-blur-xl sm:-mx-7 sm:px-7">{status && <p className={`mr-auto text-[10px] ${status.includes("saved") || status.includes("downloaded") ? "text-[#86b9b0]" : "text-rose-200/70"}`}>{status}</p>}<button onClick={onClose} className="h-11 rounded-xl px-4 text-xs font-semibold text-[#d0d6d6]/45 hover:text-white">Cancel</button><button onClick={submit} disabled={saving || accountBusy} className="flex h-11 items-center gap-2 rounded-xl bg-[#86b9b0] px-5 text-xs font-bold text-[#041421] disabled:opacity-50">{saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />} Save profile</button></div>
        </div>
      </aside>
    </>
  );
}

function ProfileSection({ icon, title, note, children }: { icon: ReactNode; title: string; note: string; children: ReactNode }) {
  return <section className="rounded-[22px] border border-white/[0.08] bg-[#042630]/58 p-5"><div className="mb-5 flex items-start gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#86b9b0]/10 text-[#86b9b0]">{icon}</span><div><h3 className="text-xs font-semibold text-white">{title}</h3><p className="mt-1 text-[9px] leading-4 text-[#d0d6d6]/35">{note}</p></div></div>{children}</section>;
}

function Field({ label, value, onChange, type = "text", readOnly, required, note }: { label: string; value: string; onChange?: (value: string) => void; type?: string; readOnly?: boolean; required?: boolean; note?: string }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#d0d6d6]/35">{label}{required && <span className="text-[#86b9b0]"> *</span>}</span><input type={type} value={value} onChange={(event) => onChange?.(event.target.value)} readOnly={readOnly} className={`h-11 w-full rounded-xl border border-white/[0.08] px-3 text-xs text-white outline-none transition focus:border-[#86b9b0]/45 ${readOnly ? "bg-[#041421]/22 text-[#d0d6d6]/45" : "bg-[#041421]/42"}`} />{note && <span className="mt-1 block text-[8px] text-[#86b9b0]/55">{note}</span>}</label>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#d0d6d6]/35">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-white/[0.08] bg-[#041421]/42 px-3 text-xs text-white outline-none focus:border-[#86b9b0]/45">{options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}</select></label>;
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block"><span className="mb-2 block text-[9px] font-bold uppercase tracking-[0.12em] text-[#d0d6d6]/35">{label}</span><textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#041421]/42 p-3 text-xs leading-5 text-white outline-none focus:border-[#86b9b0]/45" /></label>;
}
