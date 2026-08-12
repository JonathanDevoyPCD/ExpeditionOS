import { NextResponse, type NextRequest } from "next/server";
import { getGoogleNearbyPlaces } from "@/lib/googlePlaces";
import type { MapPlaceDataset } from "@/types/mapPlace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { lat?: number; lon?: number; radiusM?: number; bounds?: [[number, number], [number, number]]; zoom?: number };
    if (![body.lat, body.lon, body.radiusM, body.zoom].every(Number.isFinite) || !body.bounds || body.zoom! < 10) {
      return NextResponse.json({ error: "A valid Google map viewport is required." }, { status: 400 });
    }
    const items = await getGoogleNearbyPlaces({ lat: body.lat!, lon: body.lon! }, body.radiusM!);
    const dataset: MapPlaceDataset = {
      items,
      generatedAt: new Date().toISOString(),
      osmTimestamp: null,
      bounds: body.bounds,
      zoom: body.zoom!,
      zoomRequired: false,
      providers: { openstreetmap: "active", geoapify: "not_configured", google: "configured", booking: "not_configured" },
    };
    return NextResponse.json(dataset, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Fast nearby places are temporarily unavailable." }, { status: 502 });
  }
}
