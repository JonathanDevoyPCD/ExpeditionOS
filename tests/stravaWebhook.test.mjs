import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedStravaSubscription, parseStravaWebhookEvent, readStravaWebhookChallenge } from "../src/lib/strava/webhook.mjs";

test("parses a valid Strava activity webhook event", () => {
  assert.deepEqual(parseStravaWebhookEvent({
    object_type: "activity",
    aspect_type: "update",
    object_id: 1_360_128_428,
    owner_id: 134_815,
    subscription_id: 120_475,
    event_time: 1_516_126_040,
    updates: { title: "Messy", ignored: 123 },
  }), {
    objectType: "activity",
    aspectType: "update",
    objectId: 1_360_128_428,
    ownerId: 134_815,
    subscriptionId: 120_475,
    eventTime: 1_516_126_040,
    updates: { title: "Messy" },
  });
});

test("rejects malformed or unsupported webhook events", () => {
  assert.equal(parseStravaWebhookEvent(null), null);
  assert.equal(parseStravaWebhookEvent({ object_type: "route", aspect_type: "create" }), null);
  assert.equal(parseStravaWebhookEvent({ object_type: "activity", aspect_type: "create", object_id: -1, owner_id: 2, subscription_id: 3, event_time: 4 }), null);
});

test("echoes a webhook challenge only for the configured token", () => {
  const valid = new URLSearchParams({ "hub.mode": "subscribe", "hub.challenge": "challenge-123", "hub.verify_token": "secret" });
  assert.equal(readStravaWebhookChallenge(valid, "secret"), "challenge-123");
  assert.equal(readStravaWebhookChallenge(valid, "wrong"), null);
  assert.equal(readStravaWebhookChallenge(valid, undefined), null);
});

test("accepts events only from the configured subscription", () => {
  const event = parseStravaWebhookEvent({ object_type: "activity", aspect_type: "delete", object_id: 1, owner_id: 2, subscription_id: 3, event_time: 4 });
  assert.ok(event);
  assert.equal(isExpectedStravaSubscription(event, "3"), true);
  assert.equal(isExpectedStravaSubscription(event, "4"), false);
  assert.equal(isExpectedStravaSubscription(event, undefined), false);
});
