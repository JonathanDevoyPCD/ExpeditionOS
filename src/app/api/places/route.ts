import { NextResponse, type NextRequest } from "next/server";
import { getMapPlaces } from "@/lib/mapPlaces";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const west = Number(params.get("west"));
  const south = Number(params.get("south"));
  const east = Number(params.get("east"));
  const north = Number(params.get("north"));
  const zoom = Number(params.get("zoom"));
  if (![west, south, east, north, zoom].every(Number.isFinite) || west >= east || south >= north) {
    return NextResponse.json({ error: "Valid map bounds and zoom are required." }, { status: 400 });
  }
  if (Math.abs(west) > 180 || Math.abs(east) > 180 || Math.abs(south) > 90 || Math.abs(north) > 90) {
    return NextResponse.json({ error: "Map bounds are outside valid coordinates." }, { status: 400 });
  }
  try {
    return NextResponse.json(await getMapPlaces([[west, south], [east, north]], zoom));
  } catch (error) {
    console.error("Viewport place search failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Visible map places are temporarily unavailable." }, { status: 502 });
  }
}
