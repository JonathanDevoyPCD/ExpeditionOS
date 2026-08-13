import { NextResponse } from "next/server";
import { getRouteReadiness } from "@/lib/strava/server";
import { authenticateBearerRequest, createSupabaseAdminClient } from "@/lib/supabase/server";
import type { RouteReadinessTarget } from "@/types/strava";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  try {
    const body = await request.json().catch(() => null);
    const target = parseTarget(body);
    if (!target) return NextResponse.json({ error: "A valid route and day count are required." }, { status: 400 });
    return NextResponse.json(await getRouteReadiness(createSupabaseAdminClient(), user.id, target));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route readiness could not be calculated.";
    console.error("Route readiness failed", { userId: user.id, message });
    return NextResponse.json({ error: message }, { status: message.startsWith("Connect Strava") ? 409 : 500 });
  }
}

function parseTarget(value: unknown): RouteReadinessTarget | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim().slice(0, 160) : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 200) : "";
  const days = Number(body.days);
  const distanceKm = Number(body.distanceKm);
  const ascentM = Number(body.ascentM);
  const estimatedMovingMinutes = Number(body.estimatedMovingMinutes);
  if (!id || !name || !Number.isInteger(days) || days < 1 || days > 30) return null;
  if (!finiteWithin(distanceKm, 0.1, 20_000) || !finiteWithin(ascentM, 0, 500_000) || !finiteWithin(estimatedMovingMinutes, 1, 200_000)) return null;
  return { id, name, days, distanceKm, ascentM, estimatedMovingMinutes };
}

function finiteWithin(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}
