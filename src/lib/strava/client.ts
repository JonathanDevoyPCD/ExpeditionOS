import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { RouteReadinessReport, RouteReadinessTarget, StravaConnectionStatus } from "@/types/strava";

async function stravaRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const { data, error } = await getSupabaseBrowserClient().auth.getSession();
  if (error || !data.session) throw new Error("Your session has expired. Sign in again to continue.");
  const response = await fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${data.session.access_token}`,
    },
  });
  const result = await response.json().catch(() => null) as T & { error?: string };
  if (!response.ok) throw new Error(result?.error ?? "The Strava request failed.");
  return result;
}

export function loadStravaStatus() {
  return stravaRequest<StravaConnectionStatus>("/api/strava/status");
}

export async function startStravaConnection() {
  const result = await stravaRequest<{ url: string }>("/api/strava/connect", { method: "POST" });
  window.location.assign(result.url);
}

export function syncStravaNow() {
  return stravaRequest<{ status: StravaConnectionStatus }>("/api/strava/sync", { method: "POST" });
}

export function disconnectStravaAccount() {
  return stravaRequest<{ disconnected: true }>("/api/strava/disconnect", { method: "DELETE" });
}

export function loadRouteReadiness(target: RouteReadinessTarget) {
  return stravaRequest<RouteReadinessReport>("/api/strava/readiness", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(target),
  });
}
