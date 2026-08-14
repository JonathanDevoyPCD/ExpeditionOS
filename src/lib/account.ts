import { clearAdventureCache } from "@/lib/adventures";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export async function exportAccountData(userId: string) {
  const supabase = getSupabaseBrowserClient();
  const results = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("profile_private_details").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_travel_documents").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("profile_emergency_details").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("adventures").select("*"),
    supabase.from("adventure_members").select("*"),
    supabase.from("adventure_invitations").select("*"),
    supabase.from("adventure_stays").select("*"),
    supabase.from("adventure_gear_items").select("*"),
    supabase.from("adventure_fund_items").select("*"),
    supabase.from("strava_activities").select("*").eq("user_id", userId),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  const membershipRouteIds = new Set(
    (results[5].data ?? [])
      .filter((membership) => membership.user_id === userId && membership.status === "accepted")
      .map((membership) => membership.adventure_id),
  );

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 4,
    account: {
      profile: results[0].data,
      privateDetails: results[1].data,
      travelDocuments: results[2].data,
      emergencyDetails: results[3].data,
    },
    routes: (results[4].data ?? []).filter((route) => route.owner_id === userId || membershipRouteIds.has(route.id)),
    tripMemberships: results[5].data ?? [],
    tripInvitations: results[6].data ?? [],
    tripStays: results[7].data ?? [],
    tripGear: results[8].data ?? [],
    tripFunds: results[9].data ?? [],
    stravaActivities: results[10].data ?? [],
  };
}

export function downloadAccountData(data: Awaited<ReturnType<typeof exportAccountData>>) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `expeditionos-account-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function deleteAccount() {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw error ?? new Error("Your session has expired. Please sign in again.");
  const userId = data.session.user.id;

  const response = await fetch("/api/account/delete", {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${data.session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ confirmation: "DELETE" }),
  });
  const result = await response.json() as { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Your account could not be deleted.");

  clearAdventureCache(userId);
  await supabase.auth.signOut({ scope: "local" });
}
