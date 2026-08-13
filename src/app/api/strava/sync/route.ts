import { NextResponse } from "next/server";
import { authenticateBearerRequest, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStravaStatus, syncStravaActivities } from "@/lib/strava/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  try {
    const admin = createSupabaseAdminClient();
    const sync = await syncStravaActivities(admin, user.id);
    return NextResponse.json({ sync, status: await getStravaStatus(admin, user.id) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strava synchronization failed.";
    console.error("Strava synchronization failed", { userId: user.id, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
