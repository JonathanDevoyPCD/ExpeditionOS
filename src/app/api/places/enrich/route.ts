import { NextResponse, type NextRequest } from "next/server";
import { enrichGooglePlace, googleApiKey } from "@/lib/googlePlaces";
import type { GooglePlaceLookupInput } from "@/types/googlePlace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requests = new Map<string, { count: number; resetsAt: number }>();

function allowed(request: NextRequest) {
  const client = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const current = requests.get(client);
  if (!current || current.resetsAt <= now) {
    requests.set(client, { count: 1, resetsAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 30;
}

function validInput(value: GooglePlaceLookupInput) {
  return typeof value.name === "string"
    && value.name.trim().length > 1
    && value.name.length <= 180
    && Number.isFinite(value.lat)
    && Number.isFinite(value.lon)
    && Math.abs(value.lat) <= 90
    && Math.abs(value.lon) <= 180
    && (!value.address || value.address.length <= 300);
}

export async function POST(request: NextRequest) {
  if (!googleApiKey()) return NextResponse.json({ error: "Google Places is not configured." }, { status: 503 });
  if (!allowed(request)) return NextResponse.json({ error: "Google place lookups are temporarily limited." }, { status: 429 });
  try {
    const body = await request.json() as GooglePlaceLookupInput;
    if (!validInput(body)) return NextResponse.json({ error: "A valid mapped place is required." }, { status: 400 });
    const place = await enrichGooglePlace({
      name: body.name.trim(),
      address: body.address?.trim() || undefined,
      lat: body.lat,
      lon: body.lon,
      hasMappedName: body.hasMappedName,
      googlePlaceId: body.googlePlaceId,
    });
    if (!place) return NextResponse.json({ error: "No confident Google Places match was found." }, { status: 404 });
    return NextResponse.json({ place });
  } catch (error) {
    console.error("Google place enrichment failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Google place details are temporarily unavailable." }, { status: 502 });
  }
}
