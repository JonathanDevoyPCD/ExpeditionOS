import type { Json } from "@/types/database";
import type { AdventureAccessRole, AdventurePlan, AdventureVisibility } from "@/types/adventure";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { TRIP_PEOPLE_SELECT } from "@/lib/tripPeopleQuery";

export type TripMember = {
  userId: string;
  name: string;
  role: AdventureAccessRole;
  shareEmergencyProfile: boolean;
};

export type TripInvitation = {
  id: string;
  email: string;
  role: "editor" | "viewer";
  status: "pending" | "accepted" | "declined" | "revoked";
};

export type PendingTripInvitation = TripInvitation & { adventureId: string };

export function cloudAdventureId(id: string, userId: string) {
  return id.startsWith(`${userId}:`) ? id : `${userId}:${id}`;
}

export async function loadCloudAdventures(userId: string): Promise<AdventurePlan[]> {
  const supabase = getSupabaseBrowserClient();
  const [adventuresResult, membershipResult] = await Promise.all([
    supabase.from("adventures").select("*").order("updated_at", { ascending: false }),
    supabase.from("adventure_members").select("adventure_id, role").eq("user_id", userId).eq("status", "accepted"),
  ]);
  if (adventuresResult.error) throw adventuresResult.error;
  if (membershipResult.error) throw membershipResult.error;

  const roles = new Map(membershipResult.data.map((membership) => [membership.adventure_id, membership.role]));
  return adventuresResult.data.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    source: row.source as AdventurePlan["source"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    days: row.days,
    route: row.route as unknown as AdventurePlan["route"],
    anchors: row.anchors as unknown as AdventurePlan["anchors"],
    blueprint: (row.blueprint ?? undefined) as unknown as AdventurePlan["blueprint"],
    preferences: (row.preferences ?? undefined) as unknown as AdventurePlan["preferences"],
    visibility: row.visibility as AdventureVisibility,
    access: {
      ownerId: row.owner_id,
      role: (roles.get(row.id) ?? (row.owner_id === userId ? "owner" : "viewer")) as AdventureAccessRole,
      isMember: roles.has(row.id) || row.owner_id === userId,
    },
  }));
}

export async function saveCloudAdventure(adventure: AdventurePlan, userId: string) {
  const supabase = getSupabaseBrowserClient();
  const id = adventure.access ? adventure.id : cloudAdventureId(adventure.id, userId);
  const values = {
    name: adventure.name,
    description: adventure.description,
    source: adventure.source,
    days: adventure.days,
    route: adventure.route as unknown as Json,
    anchors: adventure.anchors as unknown as Json,
    blueprint: (adventure.blueprint ?? null) as unknown as Json,
    preferences: (adventure.preferences ?? null) as unknown as Json,
  };
  const { data: existing, error: lookupError } = await supabase.from("adventures").select("id").eq("id", id).maybeSingle();
  if (lookupError) throw lookupError;
  const result = existing
    ? await supabase.from("adventures").update(values).eq("id", id)
    : await supabase.from("adventures").insert({ id, owner_id: userId, visibility: adventure.visibility, ...values });
  if (result.error) throw result.error;
  if (existing && adventure.access?.role === "owner") await setAdventureVisibility(id, adventure.visibility);
}

export async function deleteCloudAdventure(id: string) {
  const { error } = await getSupabaseBrowserClient().from("adventures").delete().eq("id", id);
  if (error) throw error;
}

export async function loadTripPeople(adventureId: string) {
  const supabase = getSupabaseBrowserClient();
  const [membersResult, invitationsResult] = await Promise.all([
    supabase.from("adventure_members").select(TRIP_PEOPLE_SELECT).eq("adventure_id", adventureId).eq("status", "accepted"),
    supabase.from("adventure_invitations").select("id, invitee_email, role, status").eq("adventure_id", adventureId).order("created_at", { ascending: false }),
  ]);
  if (membersResult.error) throw membersResult.error;
  if (invitationsResult.error) throw invitationsResult.error;

  const members: TripMember[] = membersResult.data.map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id,
      name: profile?.display_name || `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Expedition member",
      role: row.role as TripMember["role"],
      shareEmergencyProfile: row.share_emergency_profile,
    };
  });
  const invitations: TripInvitation[] = invitationsResult.data.map((row) => ({
    id: row.id,
    email: row.invitee_email,
    role: row.role as TripInvitation["role"],
    status: row.status as TripInvitation["status"],
  }));
  return { members, invitations };
}

export async function inviteTripMember(adventureId: string, email: string, role: "editor" | "viewer") {
  const { error } = await getSupabaseBrowserClient().rpc("invite_adventure_member", {
    target_adventure_id: adventureId,
    target_email: email,
    target_role: role,
  });
  if (error) throw error;
}

export async function removeTripMember(adventureId: string, userId: string) {
  const { error } = await getSupabaseBrowserClient().rpc("remove_adventure_member", {
    target_adventure_id: adventureId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function setAdventureVisibility(adventureId: string, visibility: AdventureVisibility) {
  const { error } = await getSupabaseBrowserClient().rpc("set_adventure_visibility", {
    target_adventure_id: adventureId,
    target_visibility: visibility,
  });
  if (error) throw error;
}

export async function setTripMemberRole(adventureId: string, userId: string, role: "editor" | "viewer") {
  const { error } = await getSupabaseBrowserClient().rpc("set_adventure_member_role", {
    target_adventure_id: adventureId,
    target_user_id: userId,
    target_role: role,
  });
  if (error) throw error;
}

export async function setEmergencySharing(adventureId: string, userId: string, enabled: boolean) {
  const { error } = await getSupabaseBrowserClient().from("adventure_members").update({ share_emergency_profile: enabled }).eq("adventure_id", adventureId).eq("user_id", userId);
  if (error) throw error;
}

export async function loadPendingTripInvitations(): Promise<PendingTripInvitation[]> {
  const { data, error } = await getSupabaseBrowserClient().from("adventure_invitations").select("id, adventure_id, invitee_email, role, status").eq("status", "pending").order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((row) => ({
    id: row.id,
    adventureId: row.adventure_id,
    email: row.invitee_email,
    role: row.role as PendingTripInvitation["role"],
    status: row.status as PendingTripInvitation["status"],
  }));
}

export async function respondToTripInvitation(invitationId: string, accept: boolean) {
  const { error } = await getSupabaseBrowserClient().rpc("respond_to_adventure_invitation", {
    target_invitation_id: invitationId,
    accept_invitation: accept,
  });
  if (error) throw error;
}
