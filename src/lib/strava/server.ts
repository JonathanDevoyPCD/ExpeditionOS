import "server-only";

import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptStravaSecret, encryptStravaSecret } from "@/lib/strava/crypto";
import { buildRouteReadinessReport, buildStravaReadinessSummary } from "@/lib/strava/metrics";
import type { StravaWebhookEvent } from "@/lib/strava/webhook";
import { getSiteUrl } from "@/lib/siteUrl";
import type { Database } from "@/types/database";
import type { RouteReadinessTarget, StravaConnectionStatus } from "@/types/strava";

const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
const STRAVA_API_URL = "https://www.strava.com/api/v3";
const STRAVA_SCOPES = ["read", "activity:read_all"];
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
const ACTIVITY_HISTORY_DAYS = 365;
const MAX_ACTIVITY_PAGES = 5;
const CYCLING_SPORT_TYPES = new Set([
  "Ride",
  "MountainBikeRide",
  "GravelRide",
  "VirtualRide",
  "EBikeRide",
  "EMountainBikeRide",
  "Velomobile",
  "Handcycle",
]);

type AdminClient = SupabaseClient<Database>;
type StravaConnectionRow = Database["public"]["Tables"]["strava_connections"]["Row"];

type StravaAthlete = {
  id: number;
  firstname?: string;
  lastname?: string;
  profile?: string;
};

type StravaTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: StravaAthlete;
};

type StravaSummaryActivity = {
  id: number;
  athlete?: { id?: number };
  name?: string;
  sport_type?: string;
  type?: string;
  start_date: string;
  start_date_local?: string;
  timezone?: string;
  distance?: number;
  moving_time?: number;
  elapsed_time?: number;
  total_elevation_gain?: number;
  average_speed?: number;
  max_speed?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  kilojoules?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  suffer_score?: number;
  trainer?: boolean;
  commute?: boolean;
  manual?: boolean;
  private?: boolean;
  achievement_count?: number;
  kudos_count?: number;
};

type RateLimitSnapshot = {
  used15Minutes: number | null;
  limit15Minutes: number | null;
  usedDaily: number | null;
  limitDaily: number | null;
};

type OAuthStatePayload = {
  nonce: string;
  userId: string;
  expiresAt: number;
};

export function isStravaConfigured() {
  return Boolean(
    process.env.STRAVA_CLIENT_ID
      && process.env.STRAVA_CLIENT_SECRET
      && process.env.STRAVA_TOKEN_ENCRYPTION_KEY,
  );
}

function getStravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  if (!clientId || !clientSecret || !process.env.STRAVA_TOKEN_ENCRYPTION_KEY) {
    throw new Error("Strava is not configured on this deployment.");
  }
  return { clientId, clientSecret };
}

export function createStravaOAuthState(userId: string) {
  getStravaConfig();
  const payload: OAuthStatePayload = {
    nonce: randomBytes(24).toString("base64url"),
    userId,
    expiresAt: Date.now() + OAUTH_STATE_MAX_AGE_SECONDS * 1000,
  };
  return {
    state: payload.nonce,
    cookieValue: encryptStravaSecret(JSON.stringify(payload)),
    maxAge: OAUTH_STATE_MAX_AGE_SECONDS,
  };
}

export function readStravaOAuthState(cookieValue: string, state: string) {
  const payload = JSON.parse(decryptStravaSecret(cookieValue)) as OAuthStatePayload;
  if (!payload.nonce || payload.nonce !== state || payload.expiresAt < Date.now() || !payload.userId) {
    throw new Error("The Strava connection request has expired. Please start again.");
  }
  return payload;
}

export function createStravaAuthorizationUrl(state: string) {
  const { clientId } = getStravaConfig();
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", `${getSiteUrl()}/api/strava/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "force");
  url.searchParams.set("scope", STRAVA_SCOPES.join(","));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeStravaAuthorizationCode(code: string) {
  const { clientId, clientSecret } = getStravaConfig();
  return requestStravaToken({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  });
}

async function refreshStravaToken(refreshToken: string) {
  const { clientId, clientSecret } = getStravaConfig();
  return requestStravaToken({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
}

async function requestStravaToken(values: Record<string, string>) {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(values),
    cache: "no-store",
  });
  const result = await response.json().catch(() => null) as StravaTokenResponse | { message?: string } | null;
  if (!response.ok || !result || !("access_token" in result) || !("refresh_token" in result)) {
    throw new Error(result && "message" in result && result.message ? result.message : "Strava rejected the token request.");
  }
  return result;
}

export async function saveStravaConnection(
  admin: AdminClient,
  userId: string,
  token: StravaTokenResponse,
  scopes: string[],
) {
  if (!token.athlete?.id) throw new Error("Strava did not return an athlete profile.");
  const athleteName = [token.athlete.firstname, token.athlete.lastname].filter(Boolean).join(" ").trim() || "Strava athlete";
  const { error } = await admin.from("strava_connections").upsert({
    user_id: userId,
    athlete_id: token.athlete.id,
    athlete_name: athleteName,
    athlete_avatar_url: token.athlete.profile ?? null,
    scopes,
    access_token_ciphertext: encryptStravaSecret(token.access_token),
    refresh_token_ciphertext: encryptStravaSecret(token.refresh_token),
    access_token_expires_at: new Date(token.expires_at * 1000).toISOString(),
    last_sync_status: "idle",
    last_sync_error: null,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

async function getValidAccessToken(admin: AdminClient, connection: StravaConnectionRow) {
  const expiresAt = Date.parse(connection.access_token_expires_at);
  if (expiresAt > Date.now() + 60 * 60 * 1000) return decryptStravaSecret(connection.access_token_ciphertext);

  const refreshed = await refreshStravaToken(decryptStravaSecret(connection.refresh_token_ciphertext));
  const { error } = await admin.from("strava_connections").update({
    access_token_ciphertext: encryptStravaSecret(refreshed.access_token),
    refresh_token_ciphertext: encryptStravaSecret(refreshed.refresh_token),
    access_token_expires_at: new Date(refreshed.expires_at * 1000).toISOString(),
  }).eq("user_id", connection.user_id);
  if (error) throw new Error(error.message);
  return refreshed.access_token;
}

export async function syncStravaActivities(admin: AdminClient, userId: string) {
  const { data: connection, error: connectionError } = await admin
    .from("strava_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Connect Strava before syncing activities.");

  await admin.from("strava_connections").update({ last_sync_status: "syncing", last_sync_error: null }).eq("user_id", userId);

  try {
    const accessToken = await getValidAccessToken(admin, connection);
    const after = Math.floor((Date.now() - ACTIVITY_HISTORY_DAYS * 24 * 60 * 60 * 1000) / 1000);
    const activities: StravaSummaryActivity[] = [];
    let rateLimit: RateLimitSnapshot = { used15Minutes: null, limit15Minutes: null, usedDaily: null, limitDaily: null };

    for (let page = 1; page <= MAX_ACTIVITY_PAGES; page += 1) {
      const response = await fetch(`${STRAVA_API_URL}/athlete/activities?after=${after}&page=${page}&per_page=200`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      });
      rateLimit = readRateLimit(response.headers);
      const pageActivities = await response.json().catch(() => null) as StravaSummaryActivity[] | { message?: string } | null;
      if (!response.ok || !Array.isArray(pageActivities)) {
        const message = pageActivities && !Array.isArray(pageActivities) ? pageActivities.message : null;
        throw new Error(response.status === 429 ? "Strava's activity limit is temporarily exhausted. Try syncing after the next reset." : message || "Strava activities could not be loaded.");
      }
      activities.push(...pageActivities);
      if (pageActivities.length < 200) break;
    }

    const rows = activities
      .filter((activity) => CYCLING_SPORT_TYPES.has(activity.sport_type ?? activity.type ?? ""))
      .map((activity) => normalizeActivity(userId, connection.athlete_id, activity));
    for (let index = 0; index < rows.length; index += 500) {
      const { error } = await admin.from("strava_activities").upsert(rows.slice(index, index + 500), { onConflict: "user_id,activity_id" });
      if (error) throw new Error(error.message);
    }

    const syncedAt = new Date().toISOString();
    const { error: statusError } = await admin.from("strava_connections").update({
      last_synced_at: syncedAt,
      last_sync_status: "success",
      last_sync_error: null,
      rate_limit_15m_used: rateLimit.used15Minutes,
      rate_limit_15m_limit: rateLimit.limit15Minutes,
      rate_limit_daily_used: rateLimit.usedDaily,
      rate_limit_daily_limit: rateLimit.limitDaily,
    }).eq("user_id", userId);
    if (statusError) throw new Error(statusError.message);
    return { imported: rows.length, syncedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strava synchronization failed.";
    await admin.from("strava_connections").update({ last_sync_status: "error", last_sync_error: message }).eq("user_id", userId);
    throw error;
  }
}

export async function getStravaStatus(admin: AdminClient, userId: string): Promise<StravaConnectionStatus> {
  if (!isStravaConfigured()) return disconnectedStatus(false);
  const { data: connection, error: connectionError } = await admin
    .from("strava_connections")
    .select("athlete_name, athlete_avatar_url, scopes, last_synced_at, last_sync_status, last_sync_error, rate_limit_15m_used, rate_limit_15m_limit, rate_limit_daily_used, rate_limit_daily_limit")
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) return disconnectedStatus(true);

  const { data: activities, error: activitiesError } = await admin
    .from("strava_activities")
    .select("start_date, distance_m, moving_time_s, total_elevation_gain_m")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  if (activitiesError) throw new Error(activitiesError.message);

  return {
    configured: true,
    connected: true,
    athleteName: connection.athlete_name,
    athleteAvatarUrl: connection.athlete_avatar_url,
    scopes: connection.scopes,
    lastSyncedAt: connection.last_synced_at,
    syncStatus: connection.last_sync_status as StravaConnectionStatus["syncStatus"],
    syncError: connection.last_sync_error,
    rateLimit: {
      used15Minutes: connection.rate_limit_15m_used,
      limit15Minutes: connection.rate_limit_15m_limit,
      usedDaily: connection.rate_limit_daily_used,
      limitDaily: connection.rate_limit_daily_limit,
    },
    readiness: buildStravaReadinessSummary(activities),
  };
}

export async function getRouteReadiness(admin: AdminClient, userId: string, target: RouteReadinessTarget) {
  const { data: connection, error: connectionError } = await admin
    .from("strava_connections")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) throw new Error("Connect Strava before comparing a route with your riding history.");

  const { data: activities, error: activitiesError } = await admin
    .from("strava_activities")
    .select("activity_id, name, sport_type, start_date, distance_m, moving_time_s, total_elevation_gain_m")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  if (activitiesError) throw new Error(activitiesError.message);
  return buildRouteReadinessReport(activities, target);
}

export async function disconnectStrava(admin: AdminClient, userId: string) {
  const { data: connection, error } = await admin
    .from("strava_connections")
    .select("refresh_token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!connection) return;

  const { clientId, clientSecret } = getStravaConfig();
  const authorization = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(STRAVA_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authorization}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      token: decryptStravaSecret(connection.refresh_token_ciphertext),
      token_type_hint: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Strava access could not be revoked. Nothing was removed locally.");

  await removeStravaConnectionData(admin, userId);
}

export async function processStravaWebhookEvent(admin: AdminClient, event: StravaWebhookEvent) {
  const { data: connection, error: connectionError } = await admin
    .from("strava_connections")
    .select("*")
    .eq("athlete_id", event.ownerId)
    .maybeSingle();
  if (connectionError) throw new Error(connectionError.message);
  if (!connection) return { status: "ignored" as const, reason: "athlete_not_connected" as const };

  if (event.objectType === "athlete") {
    if (event.aspectType === "update" && event.updates.authorized === "false") {
      await removeStravaConnectionData(admin, connection.user_id);
      return { status: "deauthorized" as const };
    }
    return { status: "ignored" as const, reason: "unsupported_athlete_event" as const };
  }

  if (event.aspectType === "delete") {
    const { error } = await admin.from("strava_activities").delete()
      .eq("user_id", connection.user_id)
      .eq("activity_id", event.objectId);
    if (error) throw new Error(error.message);
    return { status: "deleted" as const };
  }

  try {
    const accessToken = await getValidAccessToken(admin, connection);
    const response = await fetch(`${STRAVA_API_URL}/activities/${event.objectId}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (response.status === 403 || response.status === 404) {
      const { error } = await admin.from("strava_activities").delete()
        .eq("user_id", connection.user_id)
        .eq("activity_id", event.objectId);
      if (error) throw new Error(error.message);
      return { status: "removed" as const };
    }
    const activity = await response.json().catch(() => null) as StravaSummaryActivity | { message?: string } | null;
    if (!response.ok || !activity || !("id" in activity)) {
      throw new Error(activity && "message" in activity && activity.message ? activity.message : "Strava activity could not be refreshed.");
    }
    if (activity.id !== event.objectId || (activity.athlete?.id && activity.athlete.id !== connection.athlete_id)) {
      throw new Error("Strava returned activity data for an unexpected owner or identifier.");
    }

    if (!CYCLING_SPORT_TYPES.has(activity.sport_type ?? activity.type ?? "")) {
      const { error } = await admin.from("strava_activities").delete()
        .eq("user_id", connection.user_id)
        .eq("activity_id", event.objectId);
      if (error) throw new Error(error.message);
      return { status: "ignored" as const, reason: "not_cycling" as const };
    }

    const { error: upsertError } = await admin.from("strava_activities").upsert(
      normalizeActivity(connection.user_id, connection.athlete_id, activity),
      { onConflict: "user_id,activity_id" },
    );
    if (upsertError) throw new Error(upsertError.message);
    const rateLimit = readRateLimit(response.headers);
    const { error: statusError } = await admin.from("strava_connections").update({
      last_synced_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_error: null,
      rate_limit_15m_used: rateLimit.used15Minutes,
      rate_limit_15m_limit: rateLimit.limit15Minutes,
      rate_limit_daily_used: rateLimit.usedDaily,
      rate_limit_daily_limit: rateLimit.limitDaily,
    }).eq("user_id", connection.user_id);
    if (statusError) throw new Error(statusError.message);
    return { status: "upserted" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Strava webhook processing failed.";
    await admin.from("strava_connections").update({ last_sync_status: "error", last_sync_error: message }).eq("user_id", connection.user_id);
    throw error;
  }
}

async function removeStravaConnectionData(admin: AdminClient, userId: string) {
  const { error: activityError } = await admin.from("strava_activities").delete().eq("user_id", userId);
  if (activityError) throw new Error(activityError.message);
  const { error: connectionDeleteError } = await admin.from("strava_connections").delete().eq("user_id", userId);
  if (connectionDeleteError) throw new Error(connectionDeleteError.message);
}

function normalizeActivity(userId: string, athleteId: number, activity: StravaSummaryActivity) {
  return {
    user_id: userId,
    activity_id: activity.id,
    athlete_id: activity.athlete?.id ?? athleteId,
    name: activity.name?.trim() || "Untitled ride",
    sport_type: activity.sport_type ?? activity.type ?? "Ride",
    start_date: activity.start_date,
    start_date_local: activity.start_date_local ?? null,
    timezone: activity.timezone ?? null,
    distance_m: nonNegative(activity.distance),
    moving_time_s: Math.round(nonNegative(activity.moving_time)),
    elapsed_time_s: Math.round(nonNegative(activity.elapsed_time)),
    total_elevation_gain_m: nonNegative(activity.total_elevation_gain),
    average_speed_mps: optionalNumber(activity.average_speed),
    max_speed_mps: optionalNumber(activity.max_speed),
    average_watts: optionalNumber(activity.average_watts),
    weighted_average_watts: optionalNumber(activity.weighted_average_watts),
    kilojoules: optionalNumber(activity.kilojoules),
    average_heartrate: optionalNumber(activity.average_heartrate),
    max_heartrate: optionalNumber(activity.max_heartrate),
    suffer_score: optionalNumber(activity.suffer_score),
    trainer: Boolean(activity.trainer),
    commute: Boolean(activity.commute),
    manual: Boolean(activity.manual),
    private: Boolean(activity.private),
    achievement_count: Math.round(nonNegative(activity.achievement_count)),
    kudos_count: Math.round(nonNegative(activity.kudos_count)),
    imported_at: new Date().toISOString(),
  };
}

function readRateLimit(headers: Headers): RateLimitSnapshot {
  const limit = parseRatePair(headers.get("x-readratelimit-limit") ?? headers.get("x-ratelimit-limit"));
  const usage = parseRatePair(headers.get("x-readratelimit-usage") ?? headers.get("x-ratelimit-usage"));
  return {
    used15Minutes: usage[0],
    usedDaily: usage[1],
    limit15Minutes: limit[0],
    limitDaily: limit[1],
  };
}

function parseRatePair(value: string | null): [number | null, number | null] {
  if (!value) return [null, null];
  const [shortTerm, daily] = value.split(",").map((item) => Number(item.trim()));
  return [Number.isFinite(shortTerm) ? shortTerm : null, Number.isFinite(daily) ? daily : null];
}

function nonNegative(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, value ?? 0) : 0;
}

function optionalNumber(value: number | undefined) {
  return Number.isFinite(value) ? value ?? null : null;
}

function disconnectedStatus(configured: boolean): StravaConnectionStatus {
  return {
    configured,
    connected: false,
    athleteName: null,
    athleteAvatarUrl: null,
    scopes: [],
    lastSyncedAt: null,
    syncStatus: null,
    syncError: null,
    rateLimit: null,
    readiness: null,
  };
}
