import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  exchangeStravaAuthorizationCode,
  readStravaOAuthState,
  saveStravaConnection,
  syncStravaActivities,
} from "@/lib/strava/server";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const scope = request.nextUrl.searchParams.get("scope") ?? "";
  const oauthError = request.nextUrl.searchParams.get("error");
  const cookieValue = request.cookies.get("expedition_strava_oauth")?.value;

  if (oauthError) return clearStateCookie(redirectToReadiness("cancelled"));
  if (!code || !state || !cookieValue) return clearStateCookie(redirectToReadiness("invalid_state"));

  try {
    const oauth = readStravaOAuthState(cookieValue, state);
    const acceptedScopes = scope.split(",").map((item) => item.trim()).filter(Boolean);
    if (!acceptedScopes.includes("activity:read_all")) {
      return clearStateCookie(redirectToReadiness("scope_required"));
    }

    const admin = createSupabaseAdminClient();
    const { data: userResult, error: userError } = await admin.auth.admin.getUserById(oauth.userId);
    if (userError || !userResult.user) return clearStateCookie(redirectToReadiness("session_expired"));

    const token = await exchangeStravaAuthorizationCode(code);
    await saveStravaConnection(admin, oauth.userId, token, acceptedScopes);
    try {
      await syncStravaActivities(admin, oauth.userId);
    } catch (syncError) {
      console.error("Initial Strava sync failed", syncError instanceof Error ? syncError.message : "Unknown error");
    }
    return clearStateCookie(redirectToReadiness("connected"));
  } catch (error) {
    console.error("Strava OAuth callback failed", error instanceof Error ? error.message : "Unknown error");
    return clearStateCookie(redirectToReadiness("failed"));
  }
}

function redirectToReadiness(status: string) {
  const url = new URL("/", getSiteUrl());
  url.searchParams.set("view", "readiness");
  url.searchParams.set("strava", status);
  return NextResponse.redirect(url);
}

function clearStateCookie(response: NextResponse) {
  response.cookies.set("expedition_strava_oauth", "", {
    httpOnly: true,
    secure: getSiteUrl().startsWith("https://"),
    sameSite: "lax",
    path: "/api/strava/callback",
    maxAge: 0,
  });
  return response;
}
