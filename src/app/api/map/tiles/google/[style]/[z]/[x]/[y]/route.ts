import { NextResponse, type NextRequest } from "next/server";
import { getGoogleMapTile, type GoogleTileStyle } from "@/lib/googleMapTiles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ style: string; z: string; x: string; y: string }> },
) {
  const values = await params;
  const style = values.style as GoogleTileStyle;
  const z = Number(values.z);
  const x = Number(values.x);
  const y = Number(values.y);
  if (!["roadmap", "terrain", "satellite"].includes(style) || ![z, x, y].every(Number.isInteger) || z < 0 || z > 22 || x < 0 || y < 0) {
    return NextResponse.json({ error: "Invalid map tile request." }, { status: 400 });
  }
  try {
    const tile = await getGoogleMapTile(style, z, x, y);
    return new NextResponse(tile.bytes, { headers: { "Content-Type": tile.contentType, "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Google map tile unavailable." }, { status: 503 });
  }
}
