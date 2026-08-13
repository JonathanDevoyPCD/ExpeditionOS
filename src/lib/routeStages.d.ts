import type { CopilotBlueprint, RouteAnchor } from "@/types/adventure";
import type { RouteDataset } from "@/types/route";

export type RouteStageSource = "overnight_anchors" | "copilot_targets" | "equal_split";

export type RouteStage = {
  day: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  ascentM: number;
  descentM: number;
  estimatedMovingMinutes: number;
};

export function buildRouteStages(
  route: RouteDataset | null,
  days: number,
  anchors?: RouteAnchor[],
  blueprint?: CopilotBlueprint | null,
): { source: RouteStageSource; stages: RouteStage[] };
