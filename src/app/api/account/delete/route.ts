import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!token) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  if (!url || !publishableKey || !secretKey) {
    return NextResponse.json({ error: "Account deletion is not configured on this deployment." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { confirmation?: string } | null;
  if (body?.confirmation !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm permanent account deletion." }, { status: 400 });
  }

  const verifier = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: verified, error: verificationError } = await verifier.auth.getUser(token);
  if (verificationError || !verified.user) {
    return NextResponse.json({ error: "Your session is invalid or expired." }, { status: 401 });
  }

  const admin = createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await admin.auth.admin.deleteUser(verified.user.id);
  if (error) {
    console.error("Account deletion failed", { userId: verified.user.id, code: error.code });
    return NextResponse.json({ error: "Your account could not be deleted. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
