import { NextResponse, type NextRequest } from "next/server";
import { buildBicycleRoute } from "@/lib/routeProviders";
import type { RouteAnchor } from "@/types/adventure";

export const runtime = "nodejs";
export const maxDuration = 60;

function validAnchor(value: RouteAnchor) {
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lon) && Math.abs(value.lat) <= 90 && Math.abs(value.lon) <= 180;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { name?: string; anchors?: RouteAnchor[] };
    const anchors = body.anchors?.filter(validAnchor).slice(0, 12) ?? [];
    if (anchors.length < 2) return NextResponse.json({ error: "Add at least a start and finish." }, { status: 400 });
    const name = body.name?.trim().slice(0, 100) || `${anchors[0].name} to ${anchors.at(-1)!.name}`;
    const route = await buildBicycleRoute(anchors, name, "OpenStreetMap routing via Valhalla · elevation via Open-Meteo");
    return NextResponse.json({ route, anchors });
  } catch (error) {
    console.error("Bicycle route build failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "The route could not be built." }, { status: 502 });
  }
}
