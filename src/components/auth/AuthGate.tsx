"use client";

import { CheckCircle2, LoaderCircle, LockKeyhole, Mail, Mountain, Phone, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import ExpeditionDashboard from "@/components/dashboard/ExpeditionDashboard";
import ProfileDrawer from "@/components/profile/ProfileDrawer";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { loadProfile } from "@/lib/profiles";
import { getSiteUrl } from "@/lib/siteUrl";
import type { ExpeditionProfile, OtpChannel } from "@/types/profile";

type Mode = "signin" | "signup";

export default function AuthGate() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ExpeditionProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setChecking(false);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    loadProfile(user.id)
      .then((next) => {
        if (active) { setProfile(next); setProfileError(null); }
      })
      .catch((reason: unknown) => {
        if (active) setProfileError(reason instanceof Error ? reason.message : "Your profile could not be loaded.");
      });
    return () => { active = false; };
  }, [user]);

  if (checking) return <AuthLoading />;
  if (!user) return <OtpAccess />;
  if (profileError) return <ProfileLoadError message={profileError} onSignOut={() => getSupabaseBrowserClient().auth.signOut()} />;
  if (!profile) return <AuthLoading />;

  return (
    <>
      <ExpeditionDashboard
        userId={user.id}
        profile={profile}
        onOpenProfile={() => setProfileOpen(true)}
        onSignOut={() => getSupabaseBrowserClient().auth.signOut()}
      />
      {profileOpen && (
        <ProfileDrawer
          profile={profile}
          onClose={() => setProfileOpen(false)}
          onSaved={setProfile}
        />
      )}
    </>
  );
}

function ProfileLoadError({ message, onSignOut }: { message: string; onSignOut: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#041421] px-5"><div className="glass-panel max-w-md rounded-[28px] p-8 text-center"><ShieldCheck className="mx-auto size-8 text-[#86b9b0]" /><h1 className="mt-4 text-lg font-semibold text-white">Profile unavailable</h1><p className="mt-2 text-xs leading-6 text-[#d0d6d6]/50">{message}</p><button onClick={onSignOut} className="mt-5 rounded-xl bg-[#86b9b0] px-5 py-3 text-xs font-bold text-[#041421]">Return to sign in</button></div></main>;
}

function AuthLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#041421]">
      <div className="text-center"><LoaderCircle className="mx-auto size-7 animate-spin text-[#86b9b0]" /><p className="mt-4 text-xs text-[#d0d6d6]/55">Securing your workspace…</p></div>
    </main>
  );
}

function OtpAccess() {
  const [mode, setMode] = useState<Mode>("signin");
  const [step, setStep] = useState<"details" | "code">("details");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<OtpChannel>("email");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phoneOtpEnabled = process.env.NEXT_PUBLIC_SUPABASE_PHONE_OTP_ENABLED === "true";

  async function sendCode() {
    setError(null);
    if (!email.trim() || (mode === "signup" && (!firstName.trim() || !lastName.trim() || !phone.trim()))) {
      setError("Please complete all required fields.");
      return;
    }
    setLoading(true);
    const { error: authError } = await getSupabaseBrowserClient().auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: mode === "signup",
        emailRedirectTo: getSiteUrl(),
        data: mode === "signup" ? {
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          preferred_otp_channel: otpChannel,
        } : undefined,
      },
    });
    setLoading(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    setStep("code");
  }

  async function verifyCode() {
    setError(null);
    if (code.trim().length < 6) {
      setError("Enter the six-digit code from your email.");
      return;
    }
    setLoading(true);
    const { error: authError } = await getSupabaseBrowserClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setStep("details");
    setCode("");
    setError(null);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#041421] px-4 py-8 text-[#d0d6d6] sm:grid sm:place-items-center">
      <div className="pointer-events-none absolute -left-32 top-0 size-[34rem] rounded-full bg-[#4c7273]/12 blur-[110px]" />
      <div className="relative grid w-full max-w-[1100px] overflow-hidden rounded-[32px] border border-white/[0.09] bg-[#042630]/75 shadow-[0_35px_100px_rgba(0,0,0,0.42)] backdrop-blur-2xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden min-h-[670px] flex-col justify-between border-r border-white/[0.07] bg-[linear-gradient(155deg,rgba(134,185,176,0.13),rgba(4,20,33,0.48))] p-10 lg:flex">
          <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-[#86b9b0] text-[#041421]"><Mountain className="size-6" /></span><span className="text-lg font-bold text-white">Expedition<span className="font-medium text-[#86b9b0]">OS</span></span></div>
          <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#86b9b0]">Your expedition workspace</p><h1 className="mt-5 max-w-md text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-white">Plan ambitious trips with the right people beside you.</h1><p className="mt-5 max-w-md text-sm leading-7 text-[#d0d6d6]/52">Routes, collaborators and private readiness details stay connected across every device.</p></div>
          <div className="grid gap-3 text-xs text-[#d0d6d6]/65"><AuthBenefit icon={ShieldCheck} text="Private route library protected by your account" /><AuthBenefit icon={CheckCircle2} text="Invite editors or viewers to each trip" /><AuthBenefit icon={LockKeyhole} text="Medical and identity details stay private by default" /></div>
        </section>

        <section className="flex min-h-[670px] items-center p-6 sm:p-10 lg:p-14">
          <div className="mx-auto w-full max-w-md">
            <div className="mb-8 flex rounded-xl border border-white/[0.07] bg-[#041421]/45 p-1">
              {(["signin", "signup"] as Mode[]).map((item) => <button key={item} onClick={() => switchMode(item)} className={`h-10 flex-1 rounded-lg text-xs font-semibold transition ${mode === item ? "bg-[#86b9b0] text-[#041421]" : "text-[#d0d6d6]/45 hover:text-white"}`}>{item === "signin" ? "Sign in" : "Create account"}</button>)}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#86b9b0]/65">{step === "code" ? "Check your inbox" : mode === "signup" ? "New expedition profile" : "Welcome back"}</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{step === "code" ? "Enter your code" : mode === "signup" ? "Create your profile" : "Open your workspace"}</h2>
            <p className="mt-3 text-xs leading-6 text-[#d0d6d6]/45">{step === "code" ? `A secure sign-in code or link was sent to ${email}.` : "No passwords to remember. We will send you a secure one-time sign-in email."}</p>

            {step === "details" ? (
              <div className="mt-7 space-y-4">
                {mode === "signup" && <div className="grid gap-4 sm:grid-cols-2"><AuthField label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" /><AuthField label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" /></div>}
                <AuthField label="Email address" type="email" value={email} onChange={setEmail} icon={Mail} autoComplete="email" />
                {mode === "signup" && <AuthField label="Contact number" type="tel" value={phone} onChange={setPhone} icon={Phone} autoComplete="tel" placeholder="+27 …" />}
                {mode === "signup" && (
                  <fieldset><legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#d0d6d6]/38">Preferred OTP method</legend><div className="grid grid-cols-2 gap-3"><OtpChoice selected={otpChannel === "email"} onClick={() => setOtpChannel("email")} icon={Mail} label="Email" note="Available now" /><OtpChoice selected={otpChannel === "sms"} onClick={() => setOtpChannel("sms")} icon={Phone} label="SMS" note={phoneOtpEnabled ? "After email link" : "Setup pending"} /></div>{otpChannel === "sms" && !phoneOtpEnabled && <p className="mt-2 text-[10px] leading-4 text-amber-100/55">We will use email for your first secure sign-in until an SMS provider is enabled. Your preference is saved.</p>}</fieldset>
                )}
                {error && <p className="rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-4 py-3 text-xs text-rose-100/75">{error}</p>}
                <button onClick={sendCode} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] transition hover:bg-[#9bcac2] disabled:opacity-50">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Mail className="size-4" />} Send secure code</button>
              </div>
            ) : (
              <div className="mt-7 space-y-4"><AuthField label="Six-digit code" inputMode="numeric" value={code} onChange={(next) => setCode(next.replace(/\D/g, "").slice(0, 6))} placeholder="000000" />{error && <p className="rounded-xl border border-rose-300/15 bg-rose-300/[0.07] px-4 py-3 text-xs text-rose-100/75">{error}</p>}<button onClick={verifyCode} disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#86b9b0] text-xs font-bold text-[#041421] disabled:opacity-50">{loading ? <LoaderCircle className="size-4 animate-spin" /> : <LockKeyhole className="size-4" />} Verify and continue</button><button onClick={() => setStep("details")} className="h-10 w-full text-xs text-[#d0d6d6]/45 hover:text-white">Use a different email</button></div>
            )}
            <p className="mt-7 text-center text-[9px] leading-4 text-[#d0d6d6]/30">By continuing, you agree to the <Link href="/terms" className="text-[#86b9b0]/75 hover:text-[#86b9b0]">Terms</Link> and acknowledge the <Link href="/privacy" className="text-[#86b9b0]/75 hover:text-[#86b9b0]">Privacy notice</Link>. Travel and medical details are optional and private by default.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthBenefit({ icon: Icon, text }: { icon: typeof ShieldCheck; text: string }) {
  return <div className="flex items-center gap-3"><span className="grid size-8 place-items-center rounded-lg bg-[#86b9b0]/10 text-[#86b9b0]"><Icon className="size-4" /></span>{text}</div>;
}

function AuthField({ label, value, onChange, icon: Icon, type = "text", ...props }: { label: string; value: string; onChange: (value: string) => void; icon?: typeof Mail; type?: string; placeholder?: string; autoComplete?: string; inputMode?: "numeric" }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#d0d6d6]/38">{label}</span><span className="flex h-12 items-center rounded-xl border border-white/[0.08] bg-[#041421]/45 px-3 transition focus-within:border-[#86b9b0]/45">{Icon && <Icon className="mr-2 size-4 text-[#4c7273]" />}<input {...props} type={type} value={value} onChange={(event) => onChange(event.target.value)} className="h-full min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#d0d6d6]/20" /></span></label>;
}

function OtpChoice({ selected, onClick, icon: Icon, label, note }: { selected: boolean; onClick: () => void; icon: typeof Mail; label: string; note: string }) {
  return <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? "border-[#86b9b0]/45 bg-[#86b9b0]/10" : "border-white/[0.07] bg-[#041421]/35"}`}><Icon className={`size-4 ${selected ? "text-[#86b9b0]" : "text-[#4c7273]"}`} /><span><span className="block text-xs font-semibold text-white">{label}</span><span className="block text-[9px] text-[#d0d6d6]/35">{note}</span></span></button>;
}
