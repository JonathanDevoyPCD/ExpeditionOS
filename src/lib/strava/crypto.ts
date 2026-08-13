import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = "v1";

function encryptionKey() {
  const encoded = process.env.STRAVA_TOKEN_ENCRYPTION_KEY;
  if (!encoded) throw new Error("Strava token encryption is not configured.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) throw new Error("STRAVA_TOKEN_ENCRYPTION_KEY must contain 32 base64-encoded bytes.");
  return key;
}

export function encryptStravaSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptStravaSecret(value: string) {
  const [version, ivValue, tagValue, ciphertextValue] = value.split(".");
  if (version !== VERSION || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored Strava secret is invalid.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
}
