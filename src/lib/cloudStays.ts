import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";
import type { AdventureStay, AdventureStayDraft } from "@/types/stay";

type StayRow = Database["public"]["Tables"]["adventure_stays"]["Row"];

function optionalNumber(value: number | null) {
  return value === null ? undefined : value;
}

function optionalText(value: string | null) {
  return value ?? undefined;
}

function mapStay(row: StayRow): AdventureStay {
  return {
    id: row.id,
    adventureId: row.adventure_id,
    createdBy: row.created_by,
    name: row.name,
    accommodationType: row.accommodation_type as AdventureStay["accommodationType"],
    placement: row.placement as AdventureStay["placement"],
    reservationStatus: row.reservation_status as AdventureStay["reservationStatus"],
    stageDay: optionalNumber(row.stage_day),
    checkIn: optionalText(row.check_in),
    checkOut: optionalText(row.check_out),
    adults: row.adults,
    rooms: row.rooms,
    currency: row.currency,
    nightlyPrice: optionalNumber(row.nightly_price),
    totalPrice: optionalNumber(row.total_price),
    rating: optionalNumber(row.rating),
    distanceFromRouteKm: optionalNumber(row.distance_from_route_km),
    address: optionalText(row.address),
    lat: optionalNumber(row.latitude),
    lon: optionalNumber(row.longitude),
    contactPhone: optionalText(row.contact_phone),
    contactEmail: optionalText(row.contact_email),
    source: row.source as AdventureStay["source"],
    sourceReference: optionalText(row.source_reference),
    sourceUrl: optionalText(row.source_url),
    bookingReference: optionalText(row.booking_reference),
    notes: optionalText(row.notes),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function stayValues(draft: AdventureStayDraft) {
  return {
    name: draft.name.trim(),
    accommodation_type: draft.accommodationType,
    placement: draft.placement,
    reservation_status: draft.reservationStatus,
    stage_day: draft.stageDay ?? null,
    check_in: draft.checkIn ?? null,
    check_out: draft.checkOut ?? null,
    adults: draft.adults,
    rooms: draft.rooms,
    currency: draft.currency,
    nightly_price: draft.nightlyPrice ?? null,
    total_price: draft.totalPrice ?? null,
    rating: draft.rating ?? null,
    distance_from_route_km: draft.distanceFromRouteKm ?? null,
    address: draft.address?.trim() || null,
    latitude: draft.lat ?? null,
    longitude: draft.lon ?? null,
    contact_phone: draft.contactPhone?.trim() || null,
    contact_email: draft.contactEmail?.trim() || null,
    source: draft.source,
    source_reference: draft.sourceReference?.trim() || null,
    source_url: draft.sourceUrl?.trim() || null,
    booking_reference: draft.bookingReference?.trim() || null,
    notes: draft.notes?.trim() || null,
  };
}

export async function loadAdventureStays(adventureId: string) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_stays")
    .select("*")
    .eq("adventure_id", adventureId)
    .order("stage_day", { ascending: true, nullsFirst: false })
    .order("total_price", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data.map(mapStay);
}

export async function createAdventureStay(adventureId: string, userId: string, draft: AdventureStayDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_stays")
    .insert({ adventure_id: adventureId, created_by: userId, ...stayValues(draft) })
    .select("*")
    .single();
  if (error) throw error;
  return mapStay(data);
}

export async function updateAdventureStay(stayId: string, adventureId: string, draft: AdventureStayDraft) {
  const { data, error } = await getSupabaseBrowserClient()
    .from("adventure_stays")
    .update(stayValues(draft))
    .eq("id", stayId)
    .eq("adventure_id", adventureId)
    .select("*")
    .single();
  if (error) throw error;
  return mapStay(data);
}

export async function deleteAdventureStay(stayId: string, adventureId: string) {
  const { error } = await getSupabaseBrowserClient().from("adventure_stays").delete().eq("id", stayId).eq("adventure_id", adventureId);
  if (error) throw error;
}
