export const READINESS_RULE_VERSION = "readiness-v3";

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
  const hasBicycleContext = ["Road", "Hybrid", "Mountain"].includes(target.bicycleType);
  const bicycleType = hasBicycleContext ? target.bicycleType : "Hybrid";
  const terrainProfile = ["road", "mixed", "off_road", "unknown"].includes(target.terrainProfile) ? target.terrainProfile : "unknown";
  const maxGradePct = Number.isFinite(target.maxGradePct) ? round(Math.max(0, target.maxGradePct), 1) : null;
  const stages = readinessStages(target, days);
  const stageSource = target.stages?.length === days ? (target.stageSource ?? "equal_split") : "equal_split";
  const dailyDistanceKm = target.distanceKm / days;
  const dailyAscentM = target.ascentM / days;
  const dailyMovingMinutes = target.estimatedMovingMinutes / days;
  const hardestStage = [...stages].sort((a, b) => stageLoad(b, { dailyDistanceKm, dailyAscentM, dailyMovingMinutes }) - stageLoad(a, { dailyDistanceKm, dailyAscentM, dailyMovingMinutes }))[0];
  const distanceStage = [...stages].sort((a, b) => b.distanceKm - a.distanceKm)[0];
  const durationStage = [...stages].sort((a, b) => b.estimatedMovingMinutes - a.estimatedMovingMinutes)[0];
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
  const climbingRides90 = recent90.filter((activity) => distance(activity) >= Math.min(20, Math.max(8, distanceStage.distanceKm * 0.2)));
  const climbingRides365 = ordered.filter((activity) => distance(activity) >= Math.min(20, Math.max(8, distanceStage.distanceKm * 0.2)));
  const bestDensity90 = best(climbingRides90, density);
  const bestDensity365 = best(climbingRides365, density);
  const recent30Distance = recent30.reduce((sum, activity) => sum + distance(activity), 0);
  const distanceScore = capacityScore(distanceStage.distanceKm, bestDistance90, bestDistance365);
  const climbingEvaluations = stages.map((stage) => {
    const targetDensity = stage.distanceKm > 0 ? stage.ascentM / stage.distanceKm : 0;
    const ascentScore = capacityScore(stage.ascentM, bestAscent90, bestAscent365);
    const densityScore = capacityScore(targetDensity, bestDensity90, bestDensity365);
    return { stage, targetDensity, score: Math.round(ascentScore * 0.7 + densityScore * 0.3) };
  });
  const climbingEvaluation = [...climbingEvaluations].sort((a, b) => a.score - b.score)[0];
  const climbingScore = climbingEvaluation.score;
  const durationScore = capacityScore(durationStage.estimatedMovingMinutes, bestDuration90, bestDuration365);
  const volumeScore = capacityScore(target.distanceKm, recent30Distance, recent30Distance);
  const qualifyingDistanceKm = Math.min(40, Math.max(15, dailyDistanceKm * 0.35));
  const longestBlock = longestConsecutiveBlock(ordered.filter((activity) => distance(activity) >= qualifyingDistanceKm));
  const consecutiveScore = days === 1 ? 100 : capacityScore(days, longestBlock, longestBlock);
  const daysSinceLastRide = ordered[0] ? Math.max(0, Math.floor((now.getTime() - Date.parse(ordered[0].start_date)) / dayMs)) : null;
  const recencyScore = scoreRecency(daysSinceLastRide);
  const confidence = buildConfidence(ordered, recent90, daysSinceLastRide);
  const terrain = terrainRelevance(ordered, recent90, hardestStage, bicycleType, terrainProfile, hasBicycleContext, confidence.level);

  const factors = [
    factor("distance", "Hardest-stage distance", distanceScore, confidence.level,
      `Day ${distanceStage.day} is the longest stage at ${round(distanceStage.distanceKm, 1)} km`,
      [`Best ride in 90 days: ${round(bestDistance90, 1)} km`, `Best imported ride: ${round(bestDistance365, 1)} km`]),
    factor("climbing", "Hardest-stage climbing", climbingScore, confidence.level,
      `Day ${climbingEvaluation.stage.day} has ${Math.round(climbingEvaluation.stage.ascentM).toLocaleString()} m ascent at ${round(climbingEvaluation.targetDensity, 1)} m/km`,
      [`Best 90-day ascent: ${Math.round(bestAscent90).toLocaleString()} m`, `Best comparable climbing density: ${round(Math.max(bestDensity90, bestDensity365), 1)} m/km`]),
    factor("duration", "Time in the saddle", durationScore, confidence.level,
      `Day ${durationStage.day} is estimated at ${formatMinutes(Math.round(durationStage.estimatedMovingMinutes))} moving time`,
      [`Longest 90-day ride: ${formatMinutes(Math.round(bestDuration90))}`, `Longest imported ride: ${formatMinutes(Math.round(bestDuration365))}`]),
    factor("training_volume", "Recent training volume", volumeScore, confidence.level,
      `${round(recent30Distance, 1)} km completed in the last 30 days`,
      [`The full trip is ${round(target.distanceKm, 1)} km`, `${recent30.length} qualifying cycling activities are inside the 30-day window`]),
    factor("recency", "Training recency", recencyScore, ordered.length ? confidence.level : "low",
      daysSinceLastRide === null ? "No imported rides are available" : `Latest ride was ${daysSinceLastRide} day${daysSinceLastRide === 1 ? "" : "s"} ago`,
      [ordered[0] ? `Latest evidence: ${formatDate(ordered[0].start_date)}` : "Connect and sync Strava to add evidence"]),
    factor("terrain", "Terrain and bicycle fit", terrain.score, terrain.confidence, terrain.summary, terrain.evidence),
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
    terrain: 0.12,
    consecutive_days: 0.1,
  };
  const totalWeight = factors.reduce((sum, item) => sum + weights[item.id], 0);
  const weightedScore = Math.round(factors.reduce((sum, item) => sum + item.score * weights[item.id], 0) / totalWeight);
  const criticalFactor = [...factors].sort((a, b) => a.score - b.score)[0];
  const overallScore = Math.min(weightedScore, criticalFactor.score + 25);
  const verdict = verdictFor(overallScore, criticalFactor.score, ordered.length);
  const strengths = factors.filter((item) => item.score >= 75).map((item) => item.summary);
  const gaps = factors.filter((item) => item.score < 60).map((item) => item.summary);
  const comparable = comparableActivities(ordered, {
    dailyDistanceKm: hardestStage.distanceKm,
    dailyAscentM: hardestStage.ascentM,
    dailyMovingMinutes: hardestStage.estimatedMovingMinutes,
  });
  const physiology = buildPhysiologyEvidence(ordered);
  const unknowns = [
    ...(terrainProfile === "unknown" ? ["The route surface is not verified, so terrain relevance uses the saved bicycle setup and sport-type history only."] : []),
    "Weather, luggage weight and live access are not included in this score.",
    ...(days > 1 && stageSource === "equal_split" ? ["No complete set of overnight boundaries is saved, so daily load uses an equal route split."] : []),
    ...(days > 1 && stageSource === "copilot_targets" ? ["Stage boundaries use Copilot distance targets until overnight locations are confirmed."] : []),
    ...(days > 1 && longestBlock < days ? ["Imported history does not yet demonstrate the planned number of consecutive riding days."] : []),
    ...(ordered.length < 6 ? ["A small activity history limits the confidence of this comparison."] : []),
    ...(physiology.status === "unavailable" ? ["No usable heart-rate or power stream insight is available; physiology does not affect the readiness score."] : []),
  ];
  const generatedAt = now.toISOString();
  const route = {
    id: target.id,
    name: target.name,
    days,
    distanceKm: round(target.distanceKm, 1),
    ascentM: Math.round(target.ascentM),
    estimatedMovingMinutes: Math.round(target.estimatedMovingMinutes),
    dailyDistanceKm: round(dailyDistanceKm, 1),
    dailyAscentM: Math.round(dailyAscentM),
    dailyMovingMinutes: Math.round(dailyMovingMinutes),
    stageSource,
    stages,
    hardestStage,
    bicycleType,
    terrainProfile,
    maxGradePct,
  };
  const copilotEvidence = buildCopilotEvidence({ generatedAt, now, route, overallScore, verdict, confidence, criticalFactor, factors, comparable, physiology, unknowns });

  return {
    ruleVersion: READINESS_RULE_VERSION,
    generatedAt,
    route,
    overallScore,
    verdict,
    verdictLabel: verdictLabel(verdict),
    confidence,
    criticalFactorId: criticalFactor.id,
    factors,
    comparableActivities: comparable,
    physiology,
    copilotEvidence,
    strengths,
    gaps,
    unknowns,
  };
}

function readinessStages(target, days) {
  if (Array.isArray(target.stages) && target.stages.length === days) {
    return target.stages.map((stage, index) => ({
      day: index + 1,
      startKm: round(stage.startKm, 2),
      endKm: round(stage.endKm, 2),
      distanceKm: round(stage.distanceKm, 1),
      ascentM: Math.round(stage.ascentM),
      descentM: Math.round(stage.descentM ?? 0),
      estimatedMovingMinutes: Math.max(1, Math.round(stage.estimatedMovingMinutes)),
    }));
  }
  return Array.from({ length: days }, (_, index) => ({
    day: index + 1,
    startKm: round(target.distanceKm * (index / days), 2),
    endKm: round(target.distanceKm * ((index + 1) / days), 2),
    distanceKm: round(target.distanceKm / days, 1),
    ascentM: Math.round(target.ascentM / days),
    descentM: 0,
    estimatedMovingMinutes: Math.max(1, Math.round(target.estimatedMovingMinutes / days)),
  }));
}

function stageLoad(stage, averages) {
  const ratio = (value, average) => average > 0 ? value / average : 0;
  return ratio(stage.distanceKm, averages.dailyDistanceKm) * 0.4
    + ratio(stage.ascentM, averages.dailyAscentM) * 0.4
    + ratio(stage.estimatedMovingMinutes, averages.dailyMovingMinutes) * 0.2;
}

function terrainRelevance(activities, recent90, hardestStage, bicycleType, terrainProfile, hasBicycleContext, confidence) {
  if (!hasBicycleContext) {
    return {
      score: 65,
      confidence: "low",
      summary: "No bicycle setup is saved; Hybrid is used as a neutral comparison",
      evidence: ["Save Road, Hybrid or Mountain preferences on the route for a specific terrain comparison"],
    };
  }
  const weightedBest = (items) => Math.max(0, ...items.map((activity) => activity.distance_m / 1000 * terrainCompatibility(activity.sport_type, bicycleType, terrainProfile)));
  const weightedCount = (items) => items.reduce((sum, activity) => sum + terrainCompatibility(activity.sport_type, bicycleType, terrainProfile), 0);
  const recentBest = weightedBest(recent90);
  const historicalBest = weightedBest(activities);
  const capability = capacityScore(hardestStage.distanceKm, recentBest, historicalBest);
  const coverage = clamp(Math.round(weightedCount(recent90) * 12 + weightedCount(activities) * 3), 0, 100);
  const score = Math.round(capability * 0.72 + coverage * 0.28);
  const context = terrainProfile === "unknown" ? "surface unverified" : `${terrainProfile.replace("_", "-")} surface`;
  return {
    score,
    confidence: terrainProfile === "unknown" ? "low" : confidence,
    summary: `${bicycleType} setup with ${context}; best relevant ride equivalent is ${round(Math.max(recentBest, historicalBest), 1)} km`,
    evidence: [
      `${round(weightedCount(recent90), 1)} weighted relevant rides in 90 days`,
      `Hardest planned stage: ${round(hardestStage.distanceKm, 1)} km`,
    ],
  };
}

function terrainCompatibility(sportType, bicycleType, terrainProfile) {
  const sport = String(sportType ?? "");
  const road = new Set(["Ride", "VirtualRide", "EBikeRide", "Velomobile", "Handcycle"]);
  const gravel = sport === "GravelRide";
  const mountain = sport === "MountainBikeRide" || sport === "EMountainBikeRide";
  const profile = terrainProfile === "unknown" ? (bicycleType === "Road" ? "road" : bicycleType === "Mountain" ? "off_road" : "mixed") : terrainProfile;
  if (profile === "road") return road.has(sport) ? 1 : gravel ? 0.55 : mountain ? 0.3 : 0.2;
  if (profile === "off_road") return mountain ? 1 : gravel ? 0.82 : road.has(sport) ? (sport === "VirtualRide" ? 0.2 : 0.42) : 0.2;
  return gravel ? 1 : mountain ? 0.82 : road.has(sport) ? (sport === "VirtualRide" ? 0.45 : 0.85) : 0.25;
}

function buildPhysiologyEvidence(activities) {
  const analyzed = activities.filter((activity) => Number(activity.stream_sample_count) >= 20);
  const heartRate = finiteValues(analyzed.map((activity) => activity.heart_rate_drift_pct));
  const power = finiteValues(analyzed.map((activity) => activity.power_fade_pct));
  const paired = finiteValues(analyzed.map((activity) => activity.aerobic_decoupling_pct));
  const medianHeartRateDriftPct = median(heartRate);
  const medianPowerFadePct = median(power);
  const medianAerobicDecouplingPct = median(paired);
  const evidence = [
    ...(medianHeartRateDriftPct === null ? [] : [`Median heart-rate drift: ${formatSigned(medianHeartRateDriftPct)}%`]),
    ...(medianPowerFadePct === null ? [] : [`Median power fade: ${formatSigned(medianPowerFadePct)}%`]),
    ...(medianAerobicDecouplingPct === null ? [] : [`Median aerobic decoupling: ${formatSigned(medianAerobicDecouplingPct)}%`]),
  ];
  if (!analyzed.length) {
    return {
      status: "unavailable",
      analyzedActivities: 0,
      heartRateActivities: 0,
      powerActivities: 0,
      pairedActivities: 0,
      medianHeartRateDriftPct: null,
      medianPowerFadePct: null,
      medianAerobicDecouplingPct: null,
      summary: "No suitable heart-rate or power streams have been analyzed yet.",
      evidence: ["Sync recent rides recorded with a heart-rate monitor or power meter to add this optional evidence."],
    };
  }
  const watch = (medianAerobicDecouplingPct ?? 0) > 8 || (medianHeartRateDriftPct ?? 0) > 10 || (medianPowerFadePct ?? 0) > 10;
  const status = analyzed.length < 3 ? "limited" : watch ? "watch" : "stable";
  return {
    status,
    analyzedActivities: analyzed.length,
    heartRateActivities: heartRate.length,
    powerActivities: power.length,
    pairedActivities: paired.length,
    medianHeartRateDriftPct,
    medianPowerFadePct,
    medianAerobicDecouplingPct,
    summary: status === "limited"
      ? `Only ${analyzed.length} stream-analyzed ride${analyzed.length === 1 ? " is" : "s are"} available, so the signal remains limited.`
      : status === "watch"
        ? "Recent stream summaries show material second-half cardiac drift or power fade."
        : "Recent stream summaries show stable second-half heart-rate and power behavior.",
    evidence,
  };
}

function buildCopilotEvidence({ generatedAt, now, route, overallScore, verdict, confidence, criticalFactor, factors, comparable, physiology, unknowns }) {
  return {
    schemaVersion: "copilot-readiness-evidence-v1",
    readinessRuleVersion: READINESS_RULE_VERSION,
    generatedAt,
    route: {
      name: route.name,
      days: route.days,
      distanceKm: route.distanceKm,
      ascentM: route.ascentM,
      hardestStage: route.hardestStage,
      bicycleType: route.bicycleType,
      terrainProfile: route.terrainProfile,
    },
    assessment: { overallScore, verdict, confidence: confidence.level, criticalFactorId: criticalFactor.id },
    factors: factors.map(({ id, score, status, summary, evidence }) => ({ id, score, status, summary, evidence })),
    comparableEfforts: comparable.map((activity) => ({
      sportType: activity.sportType,
      daysAgo: Math.max(0, Math.floor((now.getTime() - Date.parse(activity.startDate)) / dayMs)),
      distanceKm: activity.distanceKm,
      ascentM: activity.ascentM,
      movingMinutes: activity.movingMinutes,
      similarityScore: activity.similarityScore,
    })),
    physiology,
    unknowns,
    dataBoundary: { rawActivityStreamsIncluded: false, routeTraceIncluded: false, athleteIdentityIncluded: false },
  };
}

function finiteValues(values) {
  return values.filter((value) => Number.isFinite(value)).map(Number);
}

function median(values) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(ordered.length / 2);
  return round(ordered.length % 2 ? ordered[midpoint] : (ordered[midpoint - 1] + ordered[midpoint]) / 2, 1);
}

function formatSigned(value) {
  return `${value > 0 ? "+" : ""}${round(value, 1)}`;
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
