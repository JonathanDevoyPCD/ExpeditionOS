export type StravaMetricActivity = {
  start_date: string;
  distance_m: number;
  moving_time_s: number;
  total_elevation_gain_m: number;
};

export function buildStravaReadinessSummary(
  activities: StravaMetricActivity[],
  now?: Date,
): {
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
