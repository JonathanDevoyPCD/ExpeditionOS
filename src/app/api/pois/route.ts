import { NextResponse, type NextRequest } from "next/server";
import { getRoutePois, getRoutePoisForRoute } from "@/lib/pois";
import type { RouteDataset } from "@/types/route";
import type { RouteAnchor } from "@/types/adventure";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const requested = Number(request.nextUrl.searchParams.get("corridorKm") ?? 1.5);
  const corridorKm = Number.isFinite(requested) ? Math.max(0.3, Math.min(5, requested)) : 1.5;

  try {
    return NextResponse.json(await getRoutePois(corridorKm));
  } catch (error) {
    console.error("Route POI search failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Live OpenStreetMap places are temporarily unavailable. The GPX route remains usable." },
      { status: 502 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { route?: RouteDataset; corridorKm?: number; anchors?: RouteAnchor[] };
    if (!body.route?.points || body.route.points.length < 2 || body.route.points.length > 2000) {
      return NextResponse.json({ error: "A valid route is required for place search." }, { status: 400 });
    }
    const requested = Number(body.corridorKm ?? 1.5);
    const corridorKm = Number.isFinite(requested) ? Math.max(0.3, Math.min(5, requested)) : 1.5;
    const anchors = Array.isArray(body.anchors) ? body.anchors.filter((anchor) => Number.isFinite(anchor.lat) && Number.isFinite(anchor.lon)).slice(0, 12) : [];
    return NextResponse.json(await getRoutePoisForRoute(body.route, corridorKm, anchors));
  } catch (error) {
    console.error("Route POI search failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json(
      { error: "Live OpenStreetMap places are temporarily unavailable. The route remains usable." },
      { status: 502 },
    );
  }
}
