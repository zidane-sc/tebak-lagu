import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Server-side gate for /api/admin/*.
 *
 * ponytail: why not next middleware? env vars referenced in middleware get
 * inlined at BUILD time, which would bake ADMIN_PASSCODE into the public
 * bundle — the exact leak this guard exists to close. The Node runtime reads
 * it per-request instead. Upgrade to middleware only if measured slower.
 *
 * Set ADMIN_PASSCODE in the environment. Unset => fail closed (401).
 */

export const ADMIN_COOKIE = "tl_admin";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  // Buffer.from(x, "hex") silently drops an odd trailing nibble, so "ab...c0"
  // would decode to the same bytes as "ab...c". Shape-check before comparing.
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  const given = Buffer.from(a, "hex");
  const expected = Buffer.from(b, "hex");
  return timingSafeEqual(given, expected);
}

/** True when the submitted passcode matches ADMIN_PASSCODE. */
export function isPasscodeValid(candidate: string): boolean {
  const pass = process.env.ADMIN_PASSCODE;
  if (!pass || !candidate) return false;
  return constantTimeEquals(sha256(candidate), sha256(pass));
}

/**
 * Cookie value handed to an authenticated admin. Derived, never the passcode
 * itself — a leaked cookie must not double as a leaked secret.
 */
export function adminSessionToken(): string | null {
  const pass = process.env.ADMIN_PASSCODE;
  return pass ? sha256(`tl_admin_session:${pass}`) : null;
}

export function isAdminCookieValid(raw: string | undefined): boolean {
  const expected = adminSessionToken();
  if (!expected || !raw) return false;
  return constantTimeEquals(raw, expected);
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return undefined;
}

export function isAdminRequest(request: Request): boolean {
  return isAdminCookieValid(readCookie(request.headers.get("cookie"), ADMIN_COOKIE));
}

/** Returns a 401 response, or null when the caller is allowed through. */
export function requireAdmin(request: Request): NextResponse | null {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ error: "Unauthorized: admin passcode required" }, { status: 401 });
}
