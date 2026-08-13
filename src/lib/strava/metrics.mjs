export function buildStravaReadinessSummary(activities, now = new Date()) {
  const dayMs = 24 * 60 * 60 * 1000;
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

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
