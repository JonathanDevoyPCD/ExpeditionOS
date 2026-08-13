import { after, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { processStravaWebhookEvent } from "@/lib/strava/server";
import { isExpectedStravaSubscription, parseStravaWebhookEvent, readStravaWebhookChallenge } from "@/lib/strava/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request) {
  const challenge = readStravaWebhookChallenge(new URL(request.url).searchParams, process.env.STRAVA_WEBHOOK_VERIFY_TOKEN);
  if (!challenge) return NextResponse.json({ error: "Webhook verification failed." }, { status: 403 });
  return NextResponse.json({ "hub.challenge": challenge });
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });

  const event = parseStravaWebhookEvent(await request.json().catch(() => null));
  if (!event) return NextResponse.json({ error: "Invalid webhook event." }, { status: 400 });
  if (!isExpectedStravaSubscription(event, process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID)) {
    return NextResponse.json({ error: "Webhook subscription is not recognized." }, { status: 403 });
  }

  after(async () => {
    try {
      await processStravaWebhookEvent(createSupabaseAdminClient(), event);
    } catch (error) {
      console.error("Strava webhook processing failed", {
        objectType: event.objectType,
        aspectType: event.aspectType,
        objectId: event.objectId,
        ownerId: event.ownerId,
        message: error instanceof Error ? error.message : "Unknown webhook error",
      });
    }
  });

  return NextResponse.json({ received: true });
}
