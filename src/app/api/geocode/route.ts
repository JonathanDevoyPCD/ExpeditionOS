import { NextResponse, type NextRequest } from "next/server";
import { geocodeLocation } from "@/lib/routeProviders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 160);
  if (query.length < 2) return NextResponse.json({ error: "Enter a place to search for." }, { status: 400 });
  try {
    return NextResponse.json({ items: await geocodeLocation(query) });
  } catch (error) {
    console.error("Geocoding failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Place search is temporarily unavailable." }, { status: 502 });
  }
}
