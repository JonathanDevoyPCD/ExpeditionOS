export type AnalysisConfidence = "low" | "medium" | "high";
export type RiskSeverity = "low" | "medium" | "high";

export type RouteAnalysis = {
  verdict: "Possible" | "Possible with preparation" | "Not enough information" | "High risk" | "Places found" | "No verified places";
  confidence: AnalysisConfidence;
  summary: string;
  highlights: Array<{
    label: string;
    value: string;
    note: string;
  }>;
  risks: Array<{
    severity: RiskSeverity;
    title: string;
    detail: string;
    mitigation: string;
  }>;
  recommendations: string[];
  trainingFocus: string[];
  assumptions: string[];
  recommendedPlaceIds: string[];
};

export type AnalysisResponse = {
  analysis: RouteAnalysis;
  places: import("@/types/poi").RoutePoi[];
  model: "gpt-5.6-luna" | "gpt-5.6-terra" | string;
};
