export type StravaSyncStatus = "idle" | "syncing" | "success" | "error";

export type StravaReadinessSummary = {
  activityCount: number;
  lastActivityAt: string | null;
  last30DaysDistanceKm: number;
  last30DaysAscentM: number;
  last90DaysDistanceKm: number;
  last90DaysAscentM: number;
  longestRideKm: number;
  biggestClimbM: number;
  longestMovingMinutes: number;
};

export type StravaSummaryMetricActivity = {
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  total_elevation_gain_m: number;
};

export type StravaMetricActivity = StravaSummaryMetricActivity & {
  activity_id: number;
  name: string;
  sport_type: string;
};

export type RouteReadinessTarget = {
  id: string;
  name: string;
  days: number;
  distanceKm: number;
  ascentM: number;
  estimatedMovingMinutes: number;
};

export type ReadinessConfidence = "low" | "moderate" | "high";
export type ReadinessVerdict = "viable" | "viable_with_changes" | "not_currently_viable" | "insufficient_information";
export type ReadinessFactorId = "distance" | "climbing" | "duration" | "training_volume" | "recency" | "consecutive_days";

export type RouteReadinessFactor = {
  id: ReadinessFactorId;
  label: string;
  score: number;
  confidence: ReadinessConfidence;
  status: "strong" | "watch" | "gap";
  summary: string;
  evidence: string[];
};

export type ComparableStravaActivity = {
  activityId: number;
  name: string;
  sportType: string;
  startDate: string;
  distanceKm: number;
  ascentM: number;
  movingMinutes: number;
  similarityScore: number;
};

export type RouteReadinessReport = {
  ruleVersion: "readiness-v1";
  generatedAt: string;
  route: RouteReadinessTarget & {
    dailyDistanceKm: number;
    dailyAscentM: number;
    dailyMovingMinutes: number;
  };
  overallScore: number;
  verdict: ReadinessVerdict;
  verdictLabel: string;
  confidence: { score: number; level: ReadinessConfidence; summary: string };
  criticalFactorId: ReadinessFactorId;
  factors: RouteReadinessFactor[];
  comparableActivities: ComparableStravaActivity[];
  strengths: string[];
  gaps: string[];
  unknowns: string[];
};

export type StravaConnectionStatus = {
  configured: boolean;
  connected: boolean;
  athleteName: string | null;
  athleteAvatarUrl: string | null;
  scopes: string[];
  lastSyncedAt: string | null;
  syncStatus: StravaSyncStatus | null;
  syncError: string | null;
  rateLimit: {
    used15Minutes: number | null;
    limit15Minutes: number | null;
    usedDaily: number | null;
    limitDaily: number | null;
  } | null;
  readiness: StravaReadinessSummary | null;
};
