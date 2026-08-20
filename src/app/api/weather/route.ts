import { NextResponse } from "next/server";
import { authenticateBearerRequest } from "@/lib/supabase/server";
import { getRouteWeather } from "@/lib/weather";
import type { WeatherForecastWindow, WeatherSampleKind, WeatherSampleRequest } from "@/types/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requests = new Map<string, { count: number; resetsAt: number }>();
const kinds = new Set<WeatherSampleKind>(["start", "high_point", "overnight", "finish"]);

function allowed(userId: string) {
  const now = Date.now();
  const current = requests.get(userId);
  if (!current || current.resetsAt <= now) {
    requests.set(userId, { count: 1, resetsAt: now + 60_000 });
    return true;
  }
  current.count += 1;
  return current.count <= 12;
}

function parseSamples(value: unknown): WeatherSampleRequest[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) return null;
  const samples = value.map((candidate) => {
    if (!candidate || typeof candidate !== "object") return null;
    const item = candidate as Record<string, unknown>;
    const kind = typeof item.kind === "string" && kinds.has(item.kind as WeatherSampleKind) ? item.kind as WeatherSampleKind : null;
    const sample = {
      id: typeof item.id === "string" ? item.id.trim().slice(0, 80) : "",
      label: typeof item.label === "string" ? item.label.trim().slice(0, 100) : "",
      kind,
      lat: Number(item.lat),
      lon: Number(item.lon),
      distanceKm: Number(item.distanceKm),
      routeBearingDegrees: Number(item.routeBearingDegrees),
    };
    if (!sample.id || !sample.label || !sample.kind) return null;
    if (!Number.isFinite(sample.lat) || Math.abs(sample.lat) > 90 || !Number.isFinite(sample.lon) || Math.abs(sample.lon) > 180) return null;
    if (!Number.isFinite(sample.distanceKm) || sample.distanceKm < 0 || sample.distanceKm > 20_000) return null;
    if (!Number.isFinite(sample.routeBearingDegrees) || sample.routeBearingDegrees < 0 || sample.routeBearingDegrees >= 360) return null;
    return sample as WeatherSampleRequest;
  });
  return samples.every((sample): sample is WeatherSampleRequest => sample !== null) ? samples : null;
}

function parseWindow(value: unknown): WeatherForecastWindow | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const date = (candidate: unknown) => typeof candidate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : undefined;
  const departureTime = typeof item.departureTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(item.departureTime) ? item.departureTime : undefined;
  const startDate = date(item.startDate);
  const endDate = date(item.endDate);
  if ((item.startDate !== undefined && !startDate) || (item.endDate !== undefined && !endDate) || (item.departureTime !== undefined && !departureTime)) return null;
  if (startDate && endDate && endDate < startDate) return null;
  return { startDate, endDate, departureTime };
}

export async function POST(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  if (!allowed(user.id)) return NextResponse.json({ error: "Weather refreshes are temporarily limited." }, { status: 429 });

  try {
    const body = await request.json().catch(() => null) as { samples?: unknown; window?: unknown } | null;
    const samples = parseSamples(body?.samples);
    const window = parseWindow(body?.window);
    if (!samples) return NextResponse.json({ error: "One to four valid route weather points are required." }, { status: 400 });
    if (!window) return NextResponse.json({ error: "The forecast date or departure time is invalid." }, { status: 400 });
    return NextResponse.json(await getRouteWeather(samples, window), {
      headers: { "Cache-Control": "private, max-age=600, stale-while-revalidate=600" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Route weather could not be loaded.";
    console.error("Route weather failed", { userId: user.id, message });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
