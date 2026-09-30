import { NextResponse } from "next/server";
import { initDb, deletePlayerSession } from "@/lib/db";
import {
  clearSessionCookie,
  verifySessionToken,
  SESSION_COOKIE,
} from "@/lib/session-guard";

export const dynamic = "force-dynamic";

/**
 * Withdraw the current session.
 *
 * The row is deleted rather than just clearing the cookie: clearing alone leaves
 * a live token that still works if it was copied, and it makes "log out
 * everywhere" impossible.
 */
export async function POST(request: Request) {
  try {
    await initDb();

    const token = request.headers
      .get("cookie")
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1);

    const sessionId = verifySessionToken(token ? decodeURIComponent(token) : undefined);
    if (sessionId) await deletePlayerSession(sessionId);

    const res = NextResponse.json({ success: true });
    clearSessionCookie(res);
    return res;
  } catch (err: any) {
    console.error("Auth logout error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
