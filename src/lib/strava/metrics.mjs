export const READINESS_RULE_VERSION = "readiness-v1";

export function buildStravaReadinessSummary(activities, now = new Date()) {
  const thirtyDaysAgo = now.getTime() - 30 * dayMs;
  const ninetyDaysAgo = now.getTime() - 90 * dayMs;
  const recent30 = activities.filter((activity) => Date.parse(activity.start_date) >= thirtyDaysAgo);
  const recent90 = activities.filter((activity) => Date.parse(activity.start_date) >= ninetyDaysAgo);
  const sum = (items, key) => items.reduce((total, activity) => total + activity[key], 0);

  return {
    activityCount: activities.length,
    lastActivityAt: activities[0]?.start_date ?? null,
    last30DaysDistanceKm: round(sum(recent30, "distance_m") / 1000, 1),
    last30DaysAscentM: Math.round(sum(recent30, "total_elevation_gain_m")),
    last90DaysDistanceKm: round(sum(recent90, "distance_m") / 1000, 1),
    last90DaysAscentM: Math.round(sum(recent90, "total_elevation_gain_m")),
    longestRideKm: round(Math.max(0, ...activities.map((activity) => activity.distance_m)) / 1000, 1),
    biggestClimbM: Math.round(Math.max(0, ...activities.map((activity) => activity.total_elevation_gain_m))),
    longestMovingMinutes: Math.round(Math.max(0, ...activities.map((activity) => activity.moving_time_s)) / 60),
  };
}

export function buildRouteReadinessReport(activities, target, now = new Date()) {
  const ordered = [...activities].sort((a, b) => Date.parse(b.start_date) - Date.parse(a.start_date));
  const days = clamp(Math.round(target.days || 1), 1, 30);
  const dailyDistanceKm = target.distanceKm / days;
  const dailyAscentM = target.ascentM / days;
  const dailyMovingMinutes = target.estimatedMovingMinutes / days;
  const targetDensity = target.distanceKm > 0 ? target.ascentM / target.distanceKm : 0;
  const ninetyDaysAgo = now.getTime() - 90 * dayMs;
  const recent90 = ordered.filter((activity) => Date.parse(activity.start_date) >= ninetyDaysAgo);
  const recent30 = ordered.filter((activity) => Date.parse(activity.start_date) >= now.getTime() - 30 * dayMs);
  const distance = (activity) => activity.distance_m / 1000;
  const ascent = (activity) => activity.total_elevation_gain_m;
  const duration = (activity) => activity.moving_time_s / 60;
  const density = (activity) => activity.distance_m > 0 ? activity.total_elevation_gain_m / (activity.distance_m / 1000) : 0;
  const best = (items, value) => Math.max(0, ...items.map(value));
  const bestDistance90 = best(recent90, distance);
  const bestDistance365 = best(ordered, distance);
  const bestAscent90 = best(recent90, ascent);
  const bestAscent365 = best(ordered, ascent);
  const bestDuration90 = best(recent90, duration);
  const bestDuration365 = best(ordered, duration);
  const climbingRides90 = recent90.filter((activity) => distance(activity) >= Math.min(20, Math.max(8, dailyDistanceKm * 0.2)));
  const climbingRides365 = ordered.filter((activity) => distance(activity) >= Math.min(20, Math.max(8, dailyDistanceKm * 0.2)));
  const bestDensity90 = best(climbingRides90, density);
  const bestDensity365 = best(climbingRides365, density);
  const recent30Distance = recent30.reduce((sum, activity) => sum + distance(activity), 0);
  const distanceScore = capacityScore(dailyDistanceKm, bestDistance90, bestDistance365);
  const ascentScore = capacityScore(dailyAscentM, bestAscent90, bestAscent365);
  const densityScore = capacityScore(targetDensity, bestDensity90, bestDensity365);
  const climbingScore = Math.round(ascentScore * 0.7 + densityScore * 0.3);
  const durationScore = capacityScore(dailyMovingMinutes, bestDuration90, bestDuration365);
  const volumeScore = capacityScore(target.distanceKm, recent30Distance, recent30Distance);
  const qualifyingDistanceKm = Math.min(40, Math.max(15, dailyDistanceKm * 0.35));
  const longestBlock = longestConsecutiveBlock(ordered.filter((activity) => distance(activity) >= qualifyingDistanceKm));
  const consecutiveScore = days === 1 ? 100 : capacityScore(days, longestBlock, longestBlock);
  const daysSinceLastRide = ordered[0] ? Math.max(0, Math.floor((now.getTime() - Date.parse(ordered[0].start_date)) / dayMs)) : null;
  const recencyScore = scoreRecency(daysSinceLastRide);
  const confidence = buildConfidence(ordered, recent90, daysSinceLastRide);

  const factors = [
    factor("distance", "Daily distance", distanceScore, confidence.level,
      `${round(dailyDistanceKm, 1)} km planned per day`,
      [`Best ride in 90 days: ${round(bestDistance90, 1)} km`, `Best imported ride: ${round(bestDistance365, 1)} km`]),
    factor("climbing", "Daily climbing", climbingScore, confidence.level,
      `${Math.round(dailyAscentM).toLocaleString()} m ascent per day at ${round(targetDensity, 1)} m/km`,
      [`Best 90-day ascent: ${Math.round(bestAscent90).toLocaleString()} m`, `Best comparable climbing density: ${round(Math.max(bestDensity90, bestDensity365), 1)} m/km`]),
    factor("duration", "Time in the saddle", durationScore, confidence.level,
      `${formatMinutes(Math.round(dailyMovingMinutes))} estimated moving time per day`,
      [`Longest 90-day ride: ${formatMinutes(Math.round(bestDuration90))}`, `Longest imported ride: ${formatMinutes(Math.round(bestDuration365))}`]),
    factor("training_volume", "Recent training volume", volumeScore, confidence.level,
      `${round(recent30Distance, 1)} km completed in the last 30 days`,
      [`The full trip is ${round(target.distanceKm, 1)} km`, `${recent30.length} qualifying cycling activities are inside the 30-day window`]),
    factor("recency", "Training recency", recencyScore, ordered.length ? confidence.level : "low",
      daysSinceLastRide === null ? "No imported rides are available" : `Latest ride was ${daysSinceLastRide} day${daysSinceLastRide === 1 ? "" : "s"} ago`,
      [ordered[0] ? `Latest evidence: ${formatDate(ordered[0].start_date)}` : "Connect and sync Strava to add evidence"]),
  ];

  if (days > 1) {
    factors.push(factor("consecutive_days", "Consecutive-day load", consecutiveScore, confidence.level,
      `${days} riding days planned; longest demonstrated block is ${longestBlock} day${longestBlock === 1 ? "" : "s"}`,
      [`A qualifying day is at least ${round(qualifyingDistanceKm, 1)} km`, "Short recovery spins do not count as multi-day evidence"]));
  }

  const weights = {
    distance: 0.25,
    climbing: 0.22,
    duration: 0.18,
    training_volume: 0.15,
    recency: 0.1,
    consecutive_days: 0.1,
  };
  const totalWeight = factors.reduce((sum, item) => sum + weights[item.id], 0);
  const weightedScore = Math.round(factors.reduce((sum, item) => sum + item.score * weights[item.id], 0) / totalWeight);
  const criticalFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  const overallScore = Math.min(weightedScore, criticalFactor.score + 25);
  const verdict = verdictFor(overallScore, criticalFactor.score, ordered.length);
  const strengths = factors.filter((item) => item.score >= 75).map((item) => item.summary);
  const gaps = factors.filter((item) => item.score < 60).map((item) => item.summary);

  return {
    ruleVersion: READINESS_RULE_VERSION,
    generatedAt: now.toISOString(),
    route: {
      id: target.id,
      name: target.name,
      days,
      distanceKm: round(target.distanceKm, 1),
      ascentM: Math.round(target.ascentM),
      estimatedMovingMinutes: Math.round(target.estimatedMovingMinutes),
      dailyDistanceKm: round(dailyDistanceKm, 1),
      dailyAscentM: Math.round(dailyAscentM),
      dailyMovingMinutes: Math.round(dailyMovingMinutes),
    },
    overallScore,
    verdict,
    verdictLabel: verdictLabel(verdict),
    confidence,
    criticalFactorId: criticalFactor.id,
    factors,
    comparableActivities: comparableActivities(ordered, { dailyDistanceKm, dailyAscentM, dailyMovingMinutes }),
    strengths,
    gaps,
    unknowns: [
      "Surface, technical difficulty, weather, luggage weight and live access are not included in this score.",
      ...(days > 1 && longestBlock < days ? ["Imported history does not yet demonstrate the planned number of consecutive riding days."] : []),
      ...(ordered.length < 6 ? ["A small activity history limits the confidence of this comparison."] : []),
    ],
  };
}

const dayMs = 24 * 60 * 60 * 1000;

function factor(id, label, score, confidence, summary, evidence) {
  return {
    id,
    label,
    score,
    confidence,
    status: score >= 75 ? "strong" : score >= 55 ? "watch" : "gap",
    summary,
    evidence,
  };
}

function capacityScore(target, recentBest, historicalBest) {
  if (target <= 0) return 100;
  const demonstrated = Math.max(recentBest, historicalBest * 0.85);
  const ratio = demonstrated / target;
  if (ratio >= 1.25) return 100;
  if (ratio >= 1) return Math.round(85 + (ratio - 1) * 60);
  if (ratio >= 0.75) return Math.round(60 + (ratio - 0.75) * 100);
  if (ratio >= 0.5) return Math.round(35 + (ratio - 0.5) * 100);
  return Math.round(ratio * 70);
}

function scoreRecency(days) {
  if (days === null) return 0;
  if (days <= 7) return 100;
  if (days <= 14) return 90;
  if (days <= 30) return 75;
  if (days <= 60) return 55;
  if (days <= 90) return 35;
  return 15;
}

function buildConfidence(activities, recent90, daysSinceLastRide) {
  const countPoints = Math.min(45, activities.length * 3);
  const recentPoints = Math.min(20, recent90.length * 2);
  const recencyPoints = daysSinceLastRide === null ? 0 : daysSinceLastRide <= 30 ? 20 : daysSinceLastRide <= 90 ? 12 : 4;
  const complete = activities.filter((activity) => activity.distance_m > 0 && activity.moving_time_s > 0 && activity.total_elevation_gain_m >= 0).length;
  const completenessPoints = activities.length ? Math.round((complete / activities.length) * 15) : 0;
  const score = clamp(countPoints + recentPoints + recencyPoints + completenessPoints, 0, 100);
  const level = score >= 75 ? "high" : score >= 50 ? "moderate" : "low";
  return {
    score,
    level,
    summary: activities.length === 0
      ? "No cycling history is available for a personal comparison."
      : `${activities.length} rides imported, including ${recent90.length} from the last 90 days.`,
  };
}

function longestConsecutiveBlock(activities) {
  const days = [...new Set(activities.map((activity) => activity.start_date.slice(0, 10)))].sort();
  let longest = days.length ? 1 : 0;
  let current = longest;
  for (let index = 1; index < days.length; index += 1) {
    const difference = Math.round((Date.parse(`${days[index]}T00:00:00Z`) - Date.parse(`${days[index - 1]}T00:00:00Z`)) / dayMs);
    current = difference === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

function comparableActivities(activities, target) {
  return activities
    .map((activity) => {
      const distanceKm = activity.distance_m / 1000;
      const ascentM = activity.total_elevation_gain_m;
      const movingMinutes = activity.moving_time_s / 60;
      const differences = [
        ratioDifference(distanceKm, target.dailyDistanceKm),
        ratioDifference(ascentM + 100, target.dailyAscentM + 100),
        ratioDifference(movingMinutes, target.dailyMovingMinutes),
      ];
      const similarityScore = clamp(Math.round(100 - differences.reduce((sum, value) => sum + value, 0) / differences.length * 55), 0, 100);
      return {
        activityId: activity.activity_id,
        name: activity.name,
        sportType: activity.sport_type,
        startDate: activity.start_date,
        distanceKm: round(distanceKm, 1),
        ascentM: Math.round(ascentM),
        movingMinutes: Math.round(movingMinutes),
        similarityScore,
      };
    })
    .sort((a, b) => b.similarityScore - a.similarityScore || Date.parse(b.startDate) - Date.parse(a.startDate))
    .slice(0, 3);
}

function ratioDifference(actual, target) {
  if (actual <= 0 || target <= 0) return 2;
  return Math.abs(Math.log(actual / target));
}

function verdictFor(overall, minimum, activityCount) {
  if (activityCount < 3) return "insufficient_information";
  if (minimum < 30 || overall < 45) return "not_currently_viable";
  if (minimum < 60 || overall < 75) return "viable_with_changes";
  return "viable";
}

function verdictLabel(verdict) {
  if (verdict === "viable") return "Supported by your history";
  if (verdict === "viable_with_changes") return "Viable with preparation";
  if (verdict === "not_currently_viable") return "Large readiness gap";
  return "Not enough evidence yet";
}

function formatMinutes(minutes) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h ${remainder}m` : `${remainder}m`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
