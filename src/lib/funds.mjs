export function fundAmount(item) {
  return item.actualAmount ?? item.estimatedAmount;
}

export function fundAllocations(item) {
  const participants = item.participantIds;
  if (!participants.length) return new Map();
  const amountCents = Math.round(fundAmount(item) * 100);
  const requestedWeights = participants.map((participantId) => item.splitMethod === "custom" ? Math.max(0, item.splitWeights[participantId] ?? 0) : 1);
  const weights = requestedWeights.every((value) => value > 0) ? requestedWeights : participants.map(() => 1);
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let allocatedCents = 0;
  return new Map(participants.map((participantId, index) => {
    const cents = index === participants.length - 1
      ? amountCents - allocatedCents
      : Math.round(amountCents * (weights[index] / weightTotal));
    allocatedCents += cents;
    return [participantId, cents / 100];
  }));
}

export function memberFundBalances(items, members) {
  const balances = new Map(members.map((member) => [member.userId, 0]));
  for (const item of items) {
    if (item.costStatus !== "paid" || item.actualAmount === undefined || !item.payerId) continue;
    balances.set(item.payerId, (balances.get(item.payerId) ?? 0) + item.actualAmount);
    for (const [participantId, share] of fundAllocations(item)) {
      balances.set(participantId, (balances.get(participantId) ?? 0) - share);
    }
  }
  return members.map((member) => ({
    userId: member.userId,
    name: member.name,
    amount: Math.round((balances.get(member.userId) ?? 0) * 100) / 100,
  }));
}
