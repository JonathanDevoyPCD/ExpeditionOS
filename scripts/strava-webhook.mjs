import { existsSync, readFileSync } from "node:fs";

loadLocalEnvironment();

const API_URL = "https://www.strava.com/api/v3/push_subscriptions";
const command = process.argv[2] ?? "list";
const clientId = required("STRAVA_CLIENT_ID");
const clientSecret = required("STRAVA_CLIENT_SECRET");

if (command === "list") {
  printSubscriptions(await listSubscriptions());
} else if (command === "register") {
  const siteUrl = required("SITE_URL").replace(/\/$/, "");
  const verifyToken = required("STRAVA_WEBHOOK_VERIFY_TOKEN");
  const callbackUrl = `${siteUrl}/api/strava/webhook`;
  if (!callbackUrl.startsWith("https://")) throw new Error("SITE_URL must be a public HTTPS origin before registering a Strava webhook.");
  const existing = await listSubscriptions();
  const matching = existing.find((subscription) => subscription.callback_url === callbackUrl);
  if (matching) {
    console.log(`Webhook already registered. Subscription ID: ${matching.id}`);
    printNextStep(matching.id);
  } else if (existing.length) {
    throw new Error(`Strava permits one subscription per application. Delete subscription ${existing[0].id} before registering ${callbackUrl}.`);
  } else {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, callback_url: callbackUrl, verify_token: verifyToken }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !Number.isSafeInteger(result?.id)) throw new Error(`Strava registration failed (${response.status}): ${JSON.stringify(result)}`);
    console.log(`Webhook registered at ${callbackUrl}. Subscription ID: ${result.id}`);
    printNextStep(result.id);
  }
} else if (command === "delete") {
  const id = Number(process.argv[3]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Usage: npm run strava:webhook -- delete <subscription-id>");
  const url = new URL(`${API_URL}/${id}`);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  const response = await fetch(url, { method: "DELETE" });
  if (!response.ok) throw new Error(`Strava subscription deletion failed (${response.status}).`);
  console.log(`Deleted Strava webhook subscription ${id}.`);
} else {
  throw new Error("Usage: npm run strava:webhook -- [list|register|delete <subscription-id>]");
}

async function listSubscriptions() {
  const url = new URL(API_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  const response = await fetch(url);
  const result = await response.json().catch(() => null);
  if (!response.ok || !Array.isArray(result)) throw new Error(`Strava subscription lookup failed (${response.status}): ${JSON.stringify(result)}`);
  return result;
}

function printSubscriptions(subscriptions) {
  if (!subscriptions.length) return console.log("No Strava webhook subscription is registered for this application.");
  for (const subscription of subscriptions) console.log(`Subscription ${subscription.id}: ${subscription.callback_url}`);
}

function printNextStep(id) {
  console.log(`Add STRAVA_WEBHOOK_SUBSCRIPTION_ID=${id} to .env.local and Vercel, then redeploy.`);
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function loadLocalEnvironment() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}
