import { readFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import { NextResponse, type NextRequest } from "next/server";
import { parseGpx } from "@/lib/gpx";
import { getRoutePois, getRoutePoisForRoute } from "@/lib/pois";
import type { RouteAnalysis } from "@/types/analysis";
import type { PoiCategory, RoutePoi } from "@/types/poi";
import type { RouteDataset } from "@/types/route";
import type { RouteAnchor } from "@/types/adventure";

export const runtime = "nodejs";
export const maxDuration = 60;

const analysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["verdict", "confidence", "summary", "highlights", "risks", "recommendations", "trainingFocus", "assumptions", "recommendedPlaceIds"],
  properties: {
    verdict: {
      type: "string",
      enum: ["Possible", "Possible with preparation", "Not enough information", "High risk", "Places found", "No verified places"],
    },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    summary: { type: "string" },
    highlights: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "note"],
        properties: { label: { type: "string" }, value: { type: "string" }, note: { type: "string" } },
      },
    },
    risks: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["severity", "title", "detail", "mitigation"],
        properties: {
          severity: { type: "string", enum: ["low", "medium", "high"] },
          title: { type: "string" },
          detail: { type: "string" },
          mitigation: { type: "string" },
        },
      },
    },
    recommendations: { type: "array", maxItems: 6, items: { type: "string" } },
    trainingFocus: { type: "array", maxItems: 5, items: { type: "string" } },
    assumptions: { type: "array", maxItems: 6, items: { type: "string" } },
    recommendedPlaceIds: { type: "array", maxItems: 8, items: { type: "string" } },
  },
} as const;

function sampledProfile(profile: RouteDataset["elevationProfile"]) {
  const count = Math.min(14, profile.length);
  if (count === 0) return [];
  return Array.from({ length: count }, (_, index) => {
    const point = profile[Math.round((index / Math.max(count - 1, 1)) * (profile.length - 1))];
    return { distanceKm: Number(point.distanceKm.toFixed(1)), elevationM: Math.round(point.elevationM) };
  });
}

function relevantCategories(question: string): PoiCategory[] {
  const value = question.toLowerCase();
  const categories = new Set<PoiCategory>();
  if (/fuel|petrol|gas|refuel/.test(value)) categories.add("fuel");
  if (/drink|water|hydrate|tap/.test(value)) categories.add("water");
  if (/food|eat|meal|restaurant|cafe|coffee|snack/.test(value)) categories.add("food");
  if (/shop|grocery|groceries|supermarket|suppl|resupply/.test(value)) categories.add("groceries");
  if (/repair|bike shop|mechanic|puncture|spare/.test(value)) categories.add("repair");
  if (/pharmacy|medicine|medical/.test(value)) categories.add("pharmacy");
  if (/toilet|bathroom/.test(value)) categories.add("toilets");
  if (/stay|sleep|lodg|hotel|hostel|camp|b&b|backpacker/.test(value)) categories.add("lodging");
  if (/view|attraction|highlight|scenic/.test(value)) categories.add("attraction");
  return [...categories];
}

function chooseCandidates(question: string, items: RoutePoi[]) {
  const categories = relevantCategories(question);
  const relevant = categories.length ? items.filter((poi) => categories.includes(poi.category)) : items;
  const seen = new Set<string>();
  return relevant.filter((poi) => {
    const identity = `${poi.category}:${poi.name.toLowerCase()}:${Math.round(poi.distanceIntoRouteKm)}`;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 60);
}

function chooseModel(question: string) {
  if (process.env.OPENAI_MODEL) return process.env.OPENAI_MODEL;
  const complex = /possible|feasib|safe|risk|readiness|training|weather|emergency|multi.?day|bikepack|entire route|assess|difficulty|prepare/i.test(question);
  return complex ? "gpt-5.6-terra" : "gpt-5.6-luna";
}

function sanitizeReadinessEvidence(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const packet = value as Record<string, unknown>;
  if (packet.schemaVersion !== "copilot-readiness-evidence-v1" || packet.readinessRuleVersion !== "readiness-v3") return null;
  const route = record(packet.route);
  const assessment = record(packet.assessment);
  const physiology = record(packet.physiology);
  if (!route || !assessment || !physiology) return null;
  const hardestStage = record(route.hardestStage);
  if (!hardestStage) return null;
  const factors = Array.isArray(packet.factors) ? packet.factors.slice(0, 8).flatMap((value) => {
    const item = record(value);
    if (!item) return [];
    return [{
      id: safeText(item.id, 40),
      score: safeNumber(item.score, 0, 100),
      status: safeText(item.status, 20),
      summary: safeText(item.summary, 500),
      evidence: safeStrings(item.evidence, 4, 300),
    }];
  }) : [];
  const comparableEfforts = Array.isArray(packet.comparableEfforts) ? packet.comparableEfforts.slice(0, 3).flatMap((value) => {
    const item = record(value);
    if (!item) return [];
    return [{
      sportType: safeText(item.sportType, 40),
      daysAgo: safeNumber(item.daysAgo, 0, 400),
      distanceKm: safeNumber(item.distanceKm, 0, 20_000),
      ascentM: safeNumber(item.ascentM, 0, 100_000),
      movingMinutes: safeNumber(item.movingMinutes, 0, 20_000),
      similarityScore: safeNumber(item.similarityScore, 0, 100),
    }];
  }) : [];
  return {
    schemaVersion: "copilot-readiness-evidence-v1",
    readinessRuleVersion: "readiness-v3",
    route: {
      name: safeText(route.name, 200),
      days: safeNumber(route.days, 1, 30),
      distanceKm: safeNumber(route.distanceKm, 0.1, 20_000),
      ascentM: safeNumber(route.ascentM, 0, 500_000),
      bicycleType: safeText(route.bicycleType, 20),
      terrainProfile: safeText(route.terrainProfile, 20),
      hardestStage: {
        day: safeNumber(hardestStage.day, 1, 30),
        distanceKm: safeNumber(hardestStage.distanceKm, 0.1, 20_000),
        ascentM: safeNumber(hardestStage.ascentM, 0, 100_000),
        descentM: safeNumber(hardestStage.descentM, 0, 100_000),
        estimatedMovingMinutes: safeNumber(hardestStage.estimatedMovingMinutes, 1, 20_000),
      },
    },
    assessment: {
      overallScore: safeNumber(assessment.overallScore, 0, 100),
      verdict: safeText(assessment.verdict, 40),
      confidence: safeText(assessment.confidence, 20),
      criticalFactorId: safeText(assessment.criticalFactorId, 40),
    },
    factors,
    comparableEfforts,
    physiology: {
      status: safeText(physiology.status, 20),
      analyzedActivities: safeNumber(physiology.analyzedActivities, 0, 1_000),
      heartRateActivities: safeNumber(physiology.heartRateActivities, 0, 1_000),
      powerActivities: safeNumber(physiology.powerActivities, 0, 1_000),
      pairedActivities: safeNumber(physiology.pairedActivities, 0, 1_000),
      medianHeartRateDriftPct: nullableNumber(physiology.medianHeartRateDriftPct, -100, 300),
      medianPowerFadePct: nullableNumber(physiology.medianPowerFadePct, -100, 300),
      medianAerobicDecouplingPct: nullableNumber(physiology.medianAerobicDecouplingPct, -100, 300),
      summary: safeText(physiology.summary, 500),
      evidence: safeStrings(physiology.evidence, 4, 300),
    },
    unknowns: safeStrings(packet.unknowns, 10, 500),
    dataBoundary: { rawActivityStreamsIncluded: false, routeTraceIncluded: false, athleteIdentityIncluded: false },
  };
}

function record(value: unknown) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
function safeText(value: unknown, maximum: number) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
function safeNumber(value: unknown, minimum: number, maximum: number) { const parsed = Number(value); return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : minimum; }
function nullableNumber(value: unknown, minimum: number, maximum: number) { return value === null || value === undefined ? null : safeNumber(value, minimum, maximum); }
function safeStrings(value: unknown, maximumItems: number, maximumLength: number) { return Array.isArray(value) ? value.flatMap((item) => typeof item === "string" && item.trim() ? [item.trim().slice(0, maximumLength)] : []).slice(0, maximumItems) : []; }

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "OpenAI is not configured for this workspace." }, { status: 503 });
  }

  let question = "Assess whether this cycling route is practical and explain how a rider should prepare.";
  let suppliedRoute: RouteDataset | null = null;
  let suppliedAnchors: RouteAnchor[] = [];
  let readinessEvidence: ReturnType<typeof sanitizeReadinessEvidence> = null;
  try {
    const body = (await request.json()) as { question?: unknown; route?: RouteDataset; routeAnchors?: RouteAnchor[]; readinessEvidence?: unknown };
    if (typeof body.question === "string" && body.question.trim()) question = body.question.trim().slice(0, 1200);
    const candidateRoute = body.route;
    if (candidateRoute?.points && candidateRoute.points.length >= 2 && candidateRoute.points.length <= 2000) {
      suppliedRoute = candidateRoute;
    }
    if (Array.isArray(body.routeAnchors)) suppliedAnchors = body.routeAnchors.slice(0, 12);
    readinessEvidence = sanitizeReadinessEvidence(body.readinessEvidence);
  } catch {
    // The default route assessment does not require a request body.
  }

  try {
    const route = suppliedRoute ?? parseGpx(await readFile(path.join(process.cwd(), "The Summit Leg Breaker.gpx"), "utf8"));
    const poiDataset = await (suppliedRoute ? getRoutePoisForRoute(route, 1.5, suppliedAnchors) : getRoutePois(1.5)).catch(() => null);
    const candidates = chooseCandidates(question, poiDataset?.items ?? []);
    const model = chooseModel(question);
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 55_000, maxRetries: 1 });

    const response = await client.responses.create({
      model,
      store: false,
      reasoning: { effort: model.endsWith("terra") ? "medium" : "low" },
      max_output_tokens: 1800,
      instructions: [
        "You are Expedition OS, a cautious expert cycling and bikepacking route analyst.",
        "Use only the supplied route facts and mapped OpenStreetMap candidates.",
        "For place questions, name useful supplied candidates, state their route distance and off-route distance, and return their exact IDs in recommendedPlaceIds.",
        "A mapped place is not proof that it currently exists or is open. Never claim live opening status; tell the rider to verify hours, access and availability before departure.",
        "Do not invent surface conditions, weather, access permissions, rider fitness, prices, stock, or live road status.",
        "If relevant mapped candidates are absent, say so directly. Do not substitute invented businesses.",
        "When rider history is absent, state that readiness cannot yet be personalized and keep confidence appropriately limited.",
        "When a deterministic readiness evidence packet is supplied, treat its scores and factors as authoritative inputs. Do not recalculate them, expose excluded private data, or turn physiology summaries into medical claims.",
        "Separate route feasibility from personal readiness. Be practical, concise, and specific.",
        "Flag extreme grades as possible GPS or elevation sampling artifacts when appropriate.",
        "For a simple place question, omit irrelevant training sections and generic risks. This is planning guidance, not a safety guarantee or medical advice.",
      ].join(" "),
      input: JSON.stringify({
        riderQuestion: question,
        route: {
          name: route.name,
          distanceKm: route.metrics.distanceKm,
          ascentM: route.metrics.ascentM,
          descentM: route.metrics.descentM,
          minimumElevationM: route.metrics.minElevationM,
          maximumElevationM: route.metrics.maxElevationM,
          maximumSampledGradePct: route.metrics.maxGradePct,
          baselineMovingMinutesAt15Kmh: route.metrics.estimatedMovingMinutes,
          start: { lat: route.start.lat, lon: route.start.lon },
          finish: { lat: route.finish.lat, lon: route.finish.lon },
          sampledElevationProfile: sampledProfile(route.elevationProfile),
        },
        mappedPlaceContext: {
          source: "OpenStreetMap via Overpass",
          sourceTimestamp: poiDataset?.osmTimestamp ?? null,
          corridorKm: poiDataset?.corridorKm ?? 1.5,
          candidates: candidates.map((poi) => ({
            id: poi.id,
            name: poi.name,
            category: poi.category,
            type: poi.subcategory,
            routeKm: poi.distanceIntoRouteKm,
            offRouteKm: poi.distanceFromRouteKm,
            listedOpeningHours: poi.openingHours ?? null,
          })),
        },
        riderReadinessEvidence: readinessEvidence,
        unavailableContext: [...(readinessEvidence ? [] : ["rider training history"]), "live weather", "road or trail access", "current business status", "prices and stock"],
      }),
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "expedition_route_analysis",
          description: "A grounded cycling route assessment or route-place answer.",
          strict: true,
          schema: analysisSchema,
        },
      },
    });

    const analysis = JSON.parse(response.output_text) as RouteAnalysis;
    const candidateMap = new Map(candidates.map((poi) => [poi.id, poi]));
    const places = analysis.recommendedPlaceIds.flatMap((id) => candidateMap.get(id) ?? []);
    return NextResponse.json({ analysis, places, model });
  } catch (error) {
    if (error instanceof OpenAI.AuthenticationError) {
      return NextResponse.json({ error: "The private OpenAI key was rejected. Replace it in .env.local." }, { status: 503 });
    }
    if (error instanceof OpenAI.RateLimitError) {
      return NextResponse.json({ error: "OpenAI is temporarily rate-limited or the project usage limit was reached." }, { status: 429 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "The route analysis returned an unreadable result. Please try again." }, { status: 502 });
    }

    console.error("Route analysis failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "Route analysis is temporarily unavailable." }, { status: 502 });
  }
}
