import { readFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest } from "next/server";
import { parseGpx } from "@/lib/gpx";
import { buildItineraryGpx } from "@/lib/itinerary";
import { getRoutePois } from "@/lib/pois";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const ids = new Set(
    (request.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 20),
  );
  if (ids.size === 0) return new Response("At least one itinerary stop is required.", { status: 400 });

  try {
    const [xml, poiDataset] = await Promise.all([
      readFile(path.join(process.cwd(), "The Summit Leg Breaker.gpx"), "utf8"),
      getRoutePois(1.5),
    ]);
    const route = parseGpx(xml);
    const stops = poiDataset.items.filter((poi) => ids.has(poi.id));
    if (stops.length === 0) return new Response("The requested itinerary stops were not found.", { status: 404 });

    return new Response(buildItineraryGpx(route, stops), {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": 'attachment; filename="the-summit-leg-breaker-itinerary.gpx"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Itinerary GPX export failed", error instanceof Error ? error.message : "Unknown error");
    return new Response("The itinerary GPX could not be generated.", { status: 502 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      route?: ReturnType<typeof parseGpx>;
      stops?: Awaited<ReturnType<typeof getRoutePois>>["items"];
    };
    if (!body.route?.points || body.route.points.length < 2 || body.route.points.length > 2000) {
      return new Response("A valid route is required.", { status: 400 });
    }
    const stops = Array.isArray(body.stops) ? body.stops.slice(0, 20) : [];
    const filename = `${body.route.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "expedition"}-itinerary.gpx`;
    return new Response(buildItineraryGpx(body.route, stops), {
      headers: {
        "Content-Type": "application/gpx+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Itinerary GPX export failed", error instanceof Error ? error.message : "Unknown error");
    return new Response("The itinerary GPX could not be generated.", { status: 502 });
  }
}
