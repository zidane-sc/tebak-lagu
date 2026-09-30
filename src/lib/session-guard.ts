import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Player session, separate from the admin cookie.
 *
 * ponytail: the same shape as admin-guard, duplicated on purpose. The two
 * audiences are different (a player vs the operator) and a shared module would
 * read as if one credential unlocked both. Session ids are random, not derived
 * from anything the client can see, so a leaked id cannot be recomputed.
 *
 * The cookie holds a session id; the secret that proves it lives in a signed
 * value derived from SESSION_SECRET, so a tampered cookie fails the HMAC before
 * it ever reaches the database.
 */

export const SESSION_COOKIE = "tl_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function secret(): string {
  return process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "";
}

function hmac(value: string): string {
  return createHash("sha256").update(`${value}:${secret()}`).digest("hex");
}

function constantTimeEquals(a: string, b: string): boolean {
  if (!/^[0-9a-f]{64}$/.test(a) || !/^[0-9a-f]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Opaque id for a new session. */
export function newSessionId(): string {
  return createHash("sha256")
    .update(`${Date.now()}:${Math.random()}:${process.pid}`)
    .digest("hex")
    .slice(0, 32);
}

/** The value the cookie carries: sessionId.signature. */
export function signSession(sessionId: string): string | null {
  if (!secret() || !sessionId) return null;
  return `${sessionId}.${hmac(sessionId)}`;
}

export function verifySessionToken(token: string | undefined): string | null {
  if (!token || !secret()) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const sessionId = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!constantTimeEquals(signature, hmac(sessionId))) return null;
  return sessionId;
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

/**
 * The signed-in player's id, or null.
 *
 * Two checks, both needed. The signature proves the cookie was issued by this
 * server and not edited; the database row proves the session still exists and
 * has not expired, which is what makes it revocable.
 */
export async function sessionUserId(request: Request): Promise<string | null> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  const sessionId = verifySessionToken(token);
  if (!sessionId) return null;
  const { resolvePlayerSession } = await import("@/lib/db");
  return resolvePlayerSession(sessionId);
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

export function setSessionCookie(res: NextResponse, sessionId: string) {
  const token = signSession(sessionId);
  if (token) res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Returns a 401/403 response, or null when the caller is allowed through. */
export async function requireUser(
  request: Request,
  expectedUserId?: string | null
): Promise<NextResponse | null> {
  const userId = await sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Belum masuk. Masuk dengan Google untuk melanjutkan." }, { status: 401 });
  }
  // A user may only act on their own record. The session proves who they are;
  // this stops one player editing another by passing a different id.
  if (expectedUserId && expectedUserId !== userId) {
    return NextResponse.json({ error: "Forbidden: bukan akun Anda." }, { status: 403 });
  }
  return null;
}
