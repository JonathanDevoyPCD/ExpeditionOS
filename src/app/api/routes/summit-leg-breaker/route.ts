import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseGpx } from "@/lib/gpx";

export const dynamic = "force-static";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "The Summit Leg Breaker.gpx");
    const xml = await readFile(filePath, "utf8");
    return NextResponse.json(parseGpx(xml));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to parse the GPX route.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
