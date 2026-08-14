import { NextResponse } from "next/server";
import { getRouteReadiness } from "@/lib/strava/server";
import { authenticateBearerRequest, createSupabaseAdminClient } from "@/lib/supabase/server";
import type { RouteReadinessStageSource, RouteReadinessStageTarget, RouteReadinessTarget } from "@/types/strava";

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
  const stages = parseStages(body.stages, days);
  if (body.stages !== undefined && !stages) return null;
  const stageSource = parseStageSource(body.stageSource);
  if (body.stageSource !== undefined && !stageSource) return null;
  const bicycleType = body.bicycleType === "Road" || body.bicycleType === "Hybrid" || body.bicycleType === "Mountain" ? body.bicycleType : null;
  if (body.bicycleType !== undefined && !bicycleType) return null;
  const terrainProfile = body.terrainProfile === "road" || body.terrainProfile === "mixed" || body.terrainProfile === "off_road" || body.terrainProfile === "unknown" ? body.terrainProfile : null;
  if (body.terrainProfile !== undefined && !terrainProfile) return null;
  const maxGradePct = body.maxGradePct === undefined ? null : Number(body.maxGradePct);
  if (maxGradePct !== null && !finiteWithin(maxGradePct, 0, 100)) return null;
  return {
    id,
    name,
    days,
    distanceKm,
    ascentM,
    estimatedMovingMinutes,
    ...(maxGradePct !== null ? { maxGradePct } : {}),
    ...(bicycleType ? { bicycleType } : {}),
    ...(terrainProfile ? { terrainProfile } : {}),
    ...(stages ? { stages } : {}),
    ...(stageSource ? { stageSource } : {}),
  };
}

function parseStages(value: unknown, days: number): RouteReadinessStageTarget[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length !== days || value.length > 30) return null;
  const stages = value.map((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return null;
    const stage = candidate as Record<string, unknown>;
    const parsed = {
      day: Number(stage.day),
      startKm: Number(stage.startKm),
      endKm: Number(stage.endKm),
      distanceKm: Number(stage.distanceKm),
      ascentM: Number(stage.ascentM),
      descentM: Number(stage.descentM),
      estimatedMovingMinutes: Number(stage.estimatedMovingMinutes),
    };
    if (parsed.day !== index + 1 || !finiteWithin(parsed.startKm, 0, 20_000) || !finiteWithin(parsed.endKm, 0.1, 20_000) || parsed.endKm <= parsed.startKm) return null;
    if (!finiteWithin(parsed.distanceKm, 0.1, 20_000) || !finiteWithin(parsed.ascentM, 0, 100_000) || !finiteWithin(parsed.descentM, 0, 100_000) || !finiteWithin(parsed.estimatedMovingMinutes, 1, 20_000)) return null;
    return parsed;
  });
  return stages.every((stage): stage is RouteReadinessStageTarget => stage !== null) ? stages : null;
}

function parseStageSource(value: unknown): RouteReadinessStageSource | null {
  return value === "overnight_anchors" || value === "copilot_targets" || value === "equal_split" ? value : null;
}

function finiteWithin(value: number, minimum: number, maximum: number) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}
