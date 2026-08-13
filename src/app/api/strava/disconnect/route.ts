import { NextResponse } from "next/server";
import { authenticateBearerRequest, createSupabaseAdminClient } from "@/lib/supabase/server";
import { disconnectStrava } from "@/lib/strava/server";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  try {
    await disconnectStrava(createSupabaseAdminClient(), user.id);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strava could not be disconnected.";
    console.error("Strava disconnection failed", { userId: user.id, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
