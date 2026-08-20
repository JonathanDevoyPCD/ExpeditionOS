function addDays(date, offset) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function isCriticalReady(item) {
  return item.packingStatus === "packed"
    && item.packedQuantity >= item.quantity
    && item.acquisitionStatus === "owned";
}

function dateStatus(date, today, horizonEnd) {
  if (!date) return "dates_needed";
  if (date < today) return "past";
  if (date > horizonEnd) return "not_yet_available";
  return "available";
}

function forecastWindow(adventure, now) {
  if (!adventure.startsOn) return { status: "dates_needed", label: "Dates needed" };
  const today = now.toISOString().slice(0, 10);
  const horizonEnd = addDays(today, 9);
  const tripEnd = addDays(adventure.startsOn, Math.max(1, adventure.days) - 1);
  if (tripEnd < today) return { status: "past", label: "Past dates", today, horizonEnd };
  if (adventure.startsOn > horizonEnd) return { status: "not_yet_available", label: "Not available yet", today, horizonEnd };
  if (tripEnd > horizonEnd) return { status: "partial", label: "Partial coverage", today, horizonEnd };
  return { status: "available", label: "Available now", today, horizonEnd };
}

export function buildTripCommandSnapshot(adventure, stays, gear, funds, itineraryWarnings, now = new Date()) {
  const dayCount = Math.max(1, adventure.days);
  const requiredNights = Math.max(0, dayCount - 1);
  const selected = stays.filter((stay) => stay.placement === "selected");
  const assignedNightDays = new Set(selected.flatMap((stay) => stay.stageDay && stay.stageDay <= requiredNights ? [stay.stageDay] : []));
  const unassignedStays = selected.filter((stay) => !stay.stageDay);
  const coveredNights = Math.min(requiredNights, assignedNightDays.size + unassignedStays.length);
  const critical = gear.filter((item) => item.isCritical);
  const packedCritical = critical.filter(isCriticalReady).length;
  const currency = funds[0]?.currency ?? selected[0]?.currency ?? "ZAR";
  const estimatedBudget = funds.reduce((total, item) => total + (item.actualAmount ?? item.estimatedAmount), 0);
  const forecast = forecastWindow(adventure, now);
  const findings = [];
  const addFinding = (id, severity, message, workspace, actionLabel) => findings.push({ id, severity, message, workspace, actionLabel });

  if (!adventure.startsOn) addFinding("schedule-missing", "blocker", "Set the trip start and end dates", "Weather", "Set dates");
  else if (forecast.status === "past") addFinding("schedule-past", "blocker", "Move the trip dates into the future", "Weather", "Update dates");
  else if (forecast.status === "not_yet_available") addFinding("forecast-pending", "warning", "Live weather is not available yet; review it closer to departure", "Weather", "Review weather");
  else if (forecast.status === "partial") addFinding("forecast-partial", "warning", "The current forecast covers only part of this trip", "Weather", "Review weather");
  if (coveredNights < requiredNights) addFinding("stays-missing", "blocker", `Choose ${requiredNights - coveredNights} more overnight stay${requiredNights - coveredNights === 1 ? "" : "s"}`, "Stays", "Choose stays");
  if (critical.length === 0) addFinding("gear-checklist-missing", "warning", "Create the critical gear checklist", "Gear", "Open gear");
  else if (packedCritical < critical.length) addFinding("critical-gear-open", "blocker", `Resolve ${critical.length - packedCritical} critical gear item${critical.length - packedCritical === 1 ? "" : "s"}`, "Gear", "Resolve gear");
  if (funds.length === 0) addFinding("budget-missing", "warning", "Add a trip budget and emergency buffer", "Funds", "Build budget");
  else if (!funds.some((item) => item.category === "emergency_buffer")) addFinding("emergency-buffer-missing", "warning", "Add an emergency buffer to the trip budget", "Funds", "Add buffer");
  const highResupply = itineraryWarnings.filter((warning) => warning.severity === "high");
  if (highResupply.length) addFinding("resupply-high-risk", "blocker", `Resolve ${highResupply.length} high-risk resupply gap${highResupply.length === 1 ? "" : "s"}`, "Route", "Review route");
  else if (itineraryWarnings.length) addFinding("resupply-review", "warning", "Review the remaining resupply warnings", "Route", "Review route");
  if (selected.some((stay) => !["reserved", "paid", "confirmed"].includes(stay.reservationStatus))) addFinding("stays-unconfirmed", "warning", "Confirm selected accommodation bookings", "Stays", "Review stays");

  const blockers = findings.filter((finding) => finding.severity === "blocker").map((finding) => finding.message);
  const warnings = findings.filter((finding) => finding.severity === "warning").map((finding) => finding.message);
  const status = blockers.length ? "blocked" : warnings.length ? "attention" : "ready";

  const blueprintDays = new Map(adventure.blueprint?.dailyPlan.map((day) => [day.day, day]) ?? []);
  const fallbackDistance = Number((adventure.route.metrics.distanceKm / dayCount).toFixed(1));
  const days = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const plan = blueprintDays.get(day);
    const stay = selected.find((candidate) => candidate.stageDay === day)
      ?? (day <= requiredNights ? unassignedStays.shift() : undefined);
    const estimatedCost = funds
      .filter((item) => item.stageDay === day)
      .reduce((total, item) => total + (item.actualAmount ?? item.estimatedAmount), 0);
    const date = adventure.startsOn ? addDays(adventure.startsOn, index) : undefined;
    return {
      day,
      date,
      forecastStatus: forecast.today && forecast.horizonEnd ? dateStatus(date, forecast.today, forecast.horizonEnd) : forecast.status,
      title: plan?.title ?? (day === dayCount ? "Final stage" : `Stage ${day}`),
      summary: plan?.summary ?? (day === dayCount ? "Complete the route and close out the expedition." : "Review the route, forecast, resupply, and overnight plan."),
      targetDistanceKm: plan?.targetDistanceKm ?? fallbackDistance,
      stay,
      estimatedCost,
    };
  });

  return {
    days,
    status,
    findings,
    blockers,
    warnings,
    forecastStatus: forecast.status,
    forecastLabel: forecast.label,
    selectedStays: selected.length,
    requiredNights,
    packedCritical,
    criticalTotal: critical.length,
    estimatedBudget,
    currency,
  };
}
