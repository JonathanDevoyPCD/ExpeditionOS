import { NextResponse } from "next/server";
import { googleTileAvailability } from "@/lib/googleMapTiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await googleTileAvailability(), { headers: { "Cache-Control": "private, max-age=60" } });
}
