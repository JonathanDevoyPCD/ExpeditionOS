import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { buildBicycleRoute, geocodeLocation } from "@/lib/routeProviders";
import type { CopilotBlueprint, RouteAnchor } from "@/types/adventure";

export const runtime = "nodejs";
export const maxDuration = 60;

const blueprintSchema = {
  type: "object",
  additionalProperties: false,
  required: ["name", "summary", "days", "isRoundTrip", "anchors", "dailyPlan", "lodgingGuidance"],
  properties: {
    name: { type: "string" },
    summary: { type: "string" },
    days: { type: "integer", minimum: 1, maximum: 10 },
    isRoundTrip: { type: "boolean" },
    anchors: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "searchQuery", "day", "kind", "reason"],
        properties: {
          name: { type: "string" },
          searchQuery: { type: "string" },
          day: { type: "integer", minimum: 1, maximum: 10 },
          kind: { type: "string", enum: ["start", "via", "overnight", "finish"] },
          reason: { type: "string" },
        },
      },
    },
    dailyPlan: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["day", "title", "summary", "targetDistanceKm"],
        properties: {
          day: { type: "integer", minimum: 1, maximum: 10 },
          title: { type: "string" },
          summary: { type: "string" },
          targetDistanceKm: { type: "number", minimum: 10, maximum: 250 },
        },
      },
    },
    lodgingGuidance: { type: "array", maxItems: 8, items: { type: "string" } },
  },
} as const;

async function resolvePlannedLocation(name: string, searchQuery: string) {
  const simplify = (value: string) => value
    .replace(/\b(national park|nature reserve|village|town|area|region)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const simplified = simplify(name);
  const parts = name.split(/[,–—|]/).map(simplify).filter((value) => value.length > 3);
  const queries = [...new Set([
    searchQuery,
    `${name}, South Africa`,
    `${simplified}, South Africa`,
    `${simplified}, Eastern Cape, South Africa`,
    ...parts.flatMap((part) => [`${part}, South Africa`, `${part}, Eastern Cape, South Africa`]),
  ].map((query) => query.trim()).filter(Boolean))];

  for (const query of queries) {
    const match = (await geocodeLocation(query))[0];
    if (match) return match;
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured for this workspace." }, { status: 503 });
  }

  try {
    const body = (await request.json()) as { prompt?: string; startLocation?: string; days?: number };
    const prompt = body.prompt?.trim().slice(0, 1400) ?? "";
    const startLocation = body.startLocation?.trim().slice(0, 180) ?? "";
    if (!prompt) return NextResponse.json({ error: "Describe the adventure you want to create." }, { status: 400 });
    if (!startLocation) return NextResponse.json({ error: "Enter the ride's starting place." }, { status: 400 });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 35_000, maxRetries: 1 });
    const response = await client.responses.create({
      model: "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 1800,
      instructions: [
        "You are Expedition OS, a careful South African bicycle touring route planner.",
        "Turn the request into a compact sequence of real towns, parks, or areas that a geocoder can locate.",
        "Use the supplied starting place as the exact first anchor. If the request says 'and back' or round trip, make the final anchor the same starting place.",
        "Use two to eight anchors total. Prefer overnight towns or areas that keep each day realistic, and preserve the requested destination.",
        "Do not invent lodging businesses, availability, prices, road conditions, or access permission. Named stays will be added later from mapped place data.",
        "Set searchQuery to a precise South African place query. Keep the sequence in travel order.",
      ].join(" "),
      input: JSON.stringify({ request: prompt, startLocation, requestedDays: body.days ?? null }),
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "expedition_blueprint",
          description: "A geocodable multi-day bicycle route blueprint.",
          strict: true,
          schema: blueprintSchema,
        },
      },
    });

    const blueprint = JSON.parse(response.output_text) as CopilotBlueprint;
    const anchors: RouteAnchor[] = [];
    for (let index = 0; index < blueprint.anchors.length; index += 1) {
      const planned = blueprint.anchors[index];
      const query = index === 0 || (planned.kind === "finish" && blueprint.isRoundTrip)
        ? startLocation
        : planned.searchQuery;
      const match = await resolvePlannedLocation(planned.name, query);
      if (!match) throw new Error(`I could not locate ${planned.name}. Try a more specific starting place or destination.`);
      anchors.push({
        id: `anchor-${index}-${Date.now().toString(36)}`,
        name: planned.name || match.name,
        lat: match.lat,
        lon: match.lon,
        day: planned.day,
        kind: planned.kind,
        reason: planned.reason,
      });
    }

    const route = await buildBicycleRoute(
      anchors,
      blueprint.name,
      "Copilot plan · OpenStreetMap routing via Valhalla · elevation via Open-Meteo",
    );
    return NextResponse.json({ blueprint, route, anchors, model: "gpt-5.6-luna" });
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "The private OpenAI key was rejected. Replace it in .env.local." }, { status: 503 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "The Copilot is temporarily rate-limited." }, { status: 429 });
    }
    console.error("Copilot route planning failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: error instanceof Error ? error.message : "The Copilot route could not be created." }, { status: 502 });
  }
}
