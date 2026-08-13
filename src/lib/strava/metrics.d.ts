import type { RouteReadinessReport, RouteReadinessTarget, StravaMetricActivity, StravaReadinessSummary, StravaSummaryMetricActivity } from "@/types/strava";

export const READINESS_RULE_VERSION: "readiness-v2";

export function buildStravaReadinessSummary(
  activities: StravaSummaryMetricActivity[],
  now?: Date,
): StravaReadinessSummary;

export function buildRouteReadinessReport(
  activities: StravaMetricActivity[],
  target: RouteReadinessTarget,
  now?: Date,
): RouteReadinessReport;
