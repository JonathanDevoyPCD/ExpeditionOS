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
