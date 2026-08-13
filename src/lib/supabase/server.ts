import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function getSupabaseServerConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !publishableKey || !secretKey) {
    throw new Error("Supabase server configuration is missing.");
  }

  return { url, publishableKey, secretKey };
}

export function createSupabaseAdminClient() {
  const { url, secretKey } = getSupabaseServerConfig();
  return createClient<Database>(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function authenticateBearerRequest(request: Request): Promise<User | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;

  const { url, publishableKey } = getSupabaseServerConfig();
  const verifier = createClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.getUser(token);
  return error ? null : data.user;
}
