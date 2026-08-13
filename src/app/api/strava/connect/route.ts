import { NextResponse } from "next/server";
import { authenticateBearerRequest } from "@/lib/supabase/server";
import { createStravaAuthorizationUrl, createStravaOAuthState, isStravaConfigured } from "@/lib/strava/server";
import { getSiteUrl } from "@/lib/siteUrl";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await authenticateBearerRequest(request);
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  if (!isStravaConfigured()) {
    return NextResponse.json({ error: "Strava is not configured on this deployment." }, { status: 503 });
  }

  try {
    const oauth = createStravaOAuthState(user.id);
    const response = NextResponse.json({ url: createStravaAuthorizationUrl(oauth.state) });
    response.cookies.set("expedition_strava_oauth", oauth.cookieValue, {
      httpOnly: true,
      secure: getSiteUrl().startsWith("https://"),
      sameSite: "lax",
      path: "/api/strava/callback",
      maxAge: oauth.maxAge,
    });
    return response;
  } catch (error) {
    console.error("Strava authorization setup failed", error instanceof Error ? error.message : "Unknown error");
    return NextResponse.json({ error: "The Strava connection could not be started." }, { status: 500 });
  }
}
