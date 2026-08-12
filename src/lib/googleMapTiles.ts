import "server-only";
import { googleApiKey } from "@/lib/googlePlaces";

export type GoogleTileStyle = "roadmap" | "terrain" | "satellite";
type GoogleTileSession = { session: string; expiry: string; tileWidth: number; tileHeight: number; imageFormat: string };

const sessions = new Map<GoogleTileStyle, GoogleTileSession>();
let lastUnavailable: { until: number; reason: string } | null = null;

function sessionBody(style: GoogleTileStyle) {
  return {
    mapType: style,
    language: "en-ZA",
    region: "ZA",
    ...(style === "terrain" ? { layerTypes: ["layerRoadmap"] } : {}),
  };
}

async function createSession(style: GoogleTileStyle) {
  const key = googleApiKey();
  if (!key) throw new Error("Google Maps is not configured.");
  if (lastUnavailable && lastUnavailable.until > Date.now()) throw new Error(lastUnavailable.reason);
  const cached = sessions.get(style);
  if (cached && Number(cached.expiry) * 1000 > Date.now() + 300_000) return cached;

  const response = await fetch(`https://tile.googleapis.com/v1/createSession?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionBody(style)),
    signal: AbortSignal.timeout(12_000),
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    const reason = body?.error?.message ?? `Google Map Tiles returned ${response.status}.`;
    lastUnavailable = { until: Date.now() + 60_000, reason };
    throw new Error(reason);
  }
  const session = await response.json() as GoogleTileSession;
  sessions.set(style, session);
  lastUnavailable = null;
  return session;
}

export async function googleTileAvailability() {
  try {
    await createSession("roadmap");
    return { googleTiles: true as const };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "";
    const reason = /disabled|has not been used|permission/i.test(detail)
      ? "Enable Map Tiles API for this Google Cloud project, then allow a few minutes for propagation."
      : "Google Map Tiles are temporarily unavailable.";
    return { googleTiles: false as const, reason };
  }
}

export async function getGoogleMapTile(style: GoogleTileStyle, z: number, x: number, y: number) {
  const key = googleApiKey();
  if (!key) throw new Error("Google Maps is not configured.");
  const session = await createSession(style);
  const response = await fetch(`https://tile.googleapis.com/v1/2dtiles/${z}/${x}/${y}?session=${encodeURIComponent(session.session)}&key=${encodeURIComponent(key)}`, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google map tile returned ${response.status}.`);
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? "image/png" };
}
