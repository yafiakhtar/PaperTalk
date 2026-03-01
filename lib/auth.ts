import crypto from "crypto";
import { getEnv } from "./env";

const COOKIE_NAME = "papertalk_auth";

function hmac(value: string) {
  const env = getEnv();
  return crypto
    .createHmac("sha256", env.APP_SESSION_SECRET)
    .update(value)
    .digest("hex");
}

export function createAuthCookie() {
  const payload = `ok:${Date.now()}`;
  const signature = hmac(payload);
  return `${payload}.${signature}`;
}

export function verifyAuthCookie(cookieValue: string | undefined) {
  if (!cookieValue) return false;
  const decoded = decodeCookieValue(cookieValue);
  const [payload, signature] = decoded.split(".");
  if (!payload || !signature) return false;
  const expected = hmac(payload);
  if (signature.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

function decodeCookieValue(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function validatePassword(password: string) {
  const env = getEnv();
  const provided = crypto.createHash("sha256").update(password).digest("hex");
  const expected = crypto.createHash("sha256").update(env.APP_AUTH_PASSWORD).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export const authCookieName = COOKIE_NAME;
