import { NextResponse } from "next/server";
import { authenticateBearerRequest, createSupabaseAdminClient } from "@/lib/supabase/server";
import { getStravaStatus } from "@/lib/strava/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  try {
    return NextResponse.json(await getStravaStatus(createSupabaseAdminClient(), user.id));
  } catch (error) {
    console.error("Strava status failed", { userId: user.id, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Strava status could not be loaded." }, { status: 500 });
  }
}
