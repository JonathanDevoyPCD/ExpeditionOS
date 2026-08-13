export function getSiteUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL)?.replace(/\/$/, "") ?? "http://localhost:3010";
}
