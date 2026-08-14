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
  average_heartrate?: number | null;
  average_watts?: number | null;
  stream_sample_count?: number;
  heart_rate_drift_pct?: number | null;
  power_fade_pct?: number | null;
  aerobic_decoupling_pct?: number | null;
};

export type RouteReadinessStageTarget = {
  day: number;
  startKm: number;
  endKm: number;
  distanceKm: number;
  ascentM: number;
  descentM: number;
  estimatedMovingMinutes: number;
};

export type RouteReadinessStageSource = "overnight_anchors" | "copilot_targets" | "equal_split";
export type RouteBicycleType = "Road" | "Hybrid" | "Mountain";
export type RouteTerrainProfile = "road" | "mixed" | "off_road" | "unknown";

export type RouteReadinessTarget = {
  id: string;
  name: string;
  days: number;
  distanceKm: number;
  ascentM: number;
  estimatedMovingMinutes: number;
  maxGradePct?: number;
  bicycleType?: RouteBicycleType;
  terrainProfile?: RouteTerrainProfile;
  stages?: RouteReadinessStageTarget[];
  stageSource?: RouteReadinessStageSource;
};

export type ReadinessConfidence = "low" | "moderate" | "high";
export type ReadinessVerdict = "viable" | "viable_with_changes" | "not_currently_viable" | "insufficient_information";
export type ReadinessFactorId = "distance" | "climbing" | "duration" | "training_volume" | "recency" | "terrain" | "consecutive_days";

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

export type ReadinessPhysiologyEvidence = {
  status: "stable" | "watch" | "limited" | "unavailable";
  analyzedActivities: number;
  heartRateActivities: number;
  powerActivities: number;
  pairedActivities: number;
  medianHeartRateDriftPct: number | null;
  medianPowerFadePct: number | null;
  medianAerobicDecouplingPct: number | null;
  summary: string;
  evidence: string[];
};

export type CopilotReadinessEvidencePacket = {
  schemaVersion: "copilot-readiness-evidence-v1";
  readinessRuleVersion: "readiness-v3";
  generatedAt: string;
  route: {
    name: string;
    days: number;
    distanceKm: number;
    ascentM: number;
    hardestStage: RouteReadinessStageTarget;
    bicycleType: RouteBicycleType;
    terrainProfile: RouteTerrainProfile;
  };
  assessment: {
    overallScore: number;
    verdict: ReadinessVerdict;
    confidence: ReadinessConfidence;
    criticalFactorId: ReadinessFactorId;
  };
  factors: Array<Pick<RouteReadinessFactor, "id" | "score" | "status" | "summary" | "evidence">>;
  comparableEfforts: Array<{
    sportType: string;
    daysAgo: number;
    distanceKm: number;
    ascentM: number;
    movingMinutes: number;
    similarityScore: number;
  }>;
  physiology: ReadinessPhysiologyEvidence;
  unknowns: string[];
  dataBoundary: {
    rawActivityStreamsIncluded: false;
    routeTraceIncluded: false;
    athleteIdentityIncluded: false;
  };
};

export type RouteReadinessReport = {
  ruleVersion: "readiness-v3";
  generatedAt: string;
  route: RouteReadinessTarget & {
    dailyDistanceKm: number;
    dailyAscentM: number;
    dailyMovingMinutes: number;
    stageSource: RouteReadinessStageSource;
    stages: RouteReadinessStageTarget[];
    hardestStage: RouteReadinessStageTarget;
    bicycleType: RouteBicycleType;
    terrainProfile: RouteTerrainProfile;
    maxGradePct: number | null;
  };
  overallScore: number;
  verdict: ReadinessVerdict;
  verdictLabel: string;
  confidence: { score: number; level: ReadinessConfidence; summary: string };
  criticalFactorId: ReadinessFactorId;
  factors: RouteReadinessFactor[];
  comparableActivities: ComparableStravaActivity[];
  physiology: ReadinessPhysiologyEvidence;
  copilotEvidence: CopilotReadinessEvidencePacket;
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
