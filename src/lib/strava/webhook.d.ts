export type StravaWebhookEvent = {
  objectType: "activity" | "athlete";
  aspectType: "create" | "update" | "delete";
  objectId: number;
  ownerId: number;
  subscriptionId: number;
  eventTime: number;
  updates: Record<string, string>;
};

export function parseStravaWebhookEvent(value: unknown): StravaWebhookEvent | null;
export function readStravaWebhookChallenge(searchParams: URLSearchParams, expectedToken: string | undefined): string | null;
export function isExpectedStravaSubscription(event: StravaWebhookEvent, expectedSubscriptionId: string | undefined): boolean;
