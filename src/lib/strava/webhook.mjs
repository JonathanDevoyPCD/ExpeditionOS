const OBJECT_TYPES = new Set(["activity", "athlete"]);
const ASPECT_TYPES = new Set(["create", "update", "delete"]);

export function parseStravaWebhookEvent(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const objectType = value.object_type;
  const aspectType = value.aspect_type;
  const objectId = Number(value.object_id);
  const ownerId = Number(value.owner_id);
  const subscriptionId = Number(value.subscription_id);
  const eventTime = Number(value.event_time);
  if (!OBJECT_TYPES.has(objectType) || !ASPECT_TYPES.has(aspectType)) return null;
  if (![objectId, ownerId, subscriptionId, eventTime].every((item) => Number.isSafeInteger(item) && item > 0)) return null;
  const updates = value.updates && typeof value.updates === "object" && !Array.isArray(value.updates)
    ? Object.fromEntries(Object.entries(value.updates).filter(([key, item]) => key.length <= 80 && typeof item === "string" && item.length <= 500))
    : {};
  return { objectType, aspectType, objectId, ownerId, subscriptionId, eventTime, updates };
}

export function readStravaWebhookChallenge(searchParams, expectedToken) {
  const mode = searchParams.get("hub.mode");
  const challenge = searchParams.get("hub.challenge");
  const token = searchParams.get("hub.verify_token");
  if (!expectedToken || mode !== "subscribe" || !challenge || challenge.length > 500 || token !== expectedToken) return null;
  return challenge;
}

export function isExpectedStravaSubscription(event, expectedSubscriptionId) {
  const parsed = Number(expectedSubscriptionId);
  return Number.isSafeInteger(parsed) && parsed > 0 && event.subscriptionId === parsed;
}
