import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextResponse } from "next/server";

export const ADMIN_PASSWORD = "password";
export const ADMIN_COOKIE_NAME = "admin_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_SECRET =
  process.env.SESSION_SECRET ?? "development-slide-session-secret";

type CookieStoreLike = {
  get: (name: string) => { value: string } | undefined;
};

function createSignature(payload: string) {
  return createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
}

function createSessionToken() {
  const nonce = randomBytes(16).toString("hex");
  const payload = `admin:${Date.now()}:${nonce}`;
  const signature = createSignature(payload);
  return `${payload}.${signature}`;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function parseCookie(cookieHeader: string, name: string) {
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey !== name) {
      continue;
    }

    return decodeURIComponent(rawValue.join("="));
  }

  return null;
}

export function hasValidAdminSessionToken(token: string | null | undefined) {
  if (!token) {
    return false;
  }

  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0) {
    return false;
  }

  const payload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  if (!payload.startsWith("admin:")) {
    return false;
  }

  const expected = createSignature(payload);
  return safeEqual(signature, expected);
}

export function isAdminFromCookieStore(cookieStore: CookieStoreLike) {
  return hasValidAdminSessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

export function isAdminFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return false;
  }

  const token = parseCookie(cookieHeader, ADMIN_COOKIE_NAME);
  return hasValidAdminSessionToken(token);
}

export function applyAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: createSessionToken(),
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearAdminSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: ADMIN_COOKIE_NAME,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}
