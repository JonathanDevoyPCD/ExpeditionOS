import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SUPABASE_PHONE_OTP_ENABLED: process.env.SUPABASE_PHONE_OTP_ENABLED ?? "false",
    NEXT_PUBLIC_SITE_URL: process.env.SITE_URL
      ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined),
  },
};

export default nextConfig;
