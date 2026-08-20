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

export function buildTripCommandSnapshot(adventure, stays, gear, funds, itineraryWarnings) {
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
  const blockers = [];
  const warnings = [];

  if (!adventure.startsOn) blockers.push("Set the trip start and end dates");
  if (coveredNights < requiredNights) blockers.push(`Choose ${requiredNights - coveredNights} more overnight stay${requiredNights - coveredNights === 1 ? "" : "s"}`);
  if (critical.length === 0) warnings.push("Create the critical gear checklist");
  else if (packedCritical < critical.length) blockers.push(`Resolve ${critical.length - packedCritical} critical gear item${critical.length - packedCritical === 1 ? "" : "s"}`);
  if (funds.length === 0) warnings.push("Add a trip budget and emergency buffer");
  const highResupply = itineraryWarnings.filter((warning) => warning.severity === "high");
  if (highResupply.length) blockers.push(`Resolve ${highResupply.length} high-risk resupply gap${highResupply.length === 1 ? "" : "s"}`);
  else if (itineraryWarnings.length) warnings.push("Review the remaining resupply warnings");
  if (selected.some((stay) => !["reserved", "paid", "confirmed"].includes(stay.reservationStatus))) warnings.push("Confirm selected accommodation bookings");

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
    return {
      day,
      date: adventure.startsOn ? addDays(adventure.startsOn, index) : undefined,
      title: plan?.title ?? (day === dayCount ? "Final stage" : `Stage ${day}`),
      summary: plan?.summary ?? (day === dayCount ? "Complete the route and close out the expedition." : "Review the route, forecast, resupply, and overnight plan."),
      targetDistanceKm: plan?.targetDistanceKm ?? fallbackDistance,
      stay,
      estimatedCost,
    };
  });

  return {
    days,
    blockers,
    warnings,
    selectedStays: selected.length,
    requiredNights,
    packedCritical,
    criticalTotal: critical.length,
    estimatedBudget,
    currency,
  };
}
