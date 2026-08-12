import type { RouteDataset } from "@/types/route";

export type RouteAnchorKind = "start" | "via" | "overnight" | "finish";

export type RoutePreferences = {
  bicycleType: "Road" | "Hybrid" | "Mountain";
  hillPreference: "balanced" | "avoid" | "embrace";
  roadPreference: "balanced" | "avoid_major" | "prefer_roads";
};

export type RouteAnchor = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  day?: number;
  kind?: RouteAnchorKind;
  reason?: string;
};

export type GeocodeResult = {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lon: number;
  region?: string;
};

export type CopilotBlueprint = {
  name: string;
  summary: string;
  days: number;
  isRoundTrip: boolean;
  anchors: Array<{
    name: string;
    searchQuery: string;
    day: number;
    kind: RouteAnchorKind;
    reason: string;
  }>;
  dailyPlan: Array<{
    day: number;
    title: string;
    summary: string;
    targetDistanceKm: number;
  }>;
  lodgingGuidance: string[];
};

export type AdventurePlan = {
  id: string;
  name: string;
  description: string;
  source: "gpx" | "manual" | "copilot";
  createdAt: string;
  updatedAt: string;
  days: number;
  route: RouteDataset;
  anchors: RouteAnchor[];
  blueprint?: CopilotBlueprint;
  preferences?: RoutePreferences;
  access?: {
    ownerId: string;
    role: "owner" | "editor" | "viewer";
  };
};
