import { NextResponse } from "next/server";
import { initDb, updateUserStats } from "@/lib/db";
import { requireUser, sessionUserId } from "@/lib/session-guard";

export const dynamic = "force-dynamic";

/** Longest run of game points a single submission may credit. */
const MAX_POINTS_PER_SUBMIT = 5000;

/**
 * Credit a finished game to the signed-in player's record.
 *
 * This previously took a bare userId with no session, so anyone could post
 * points into anyone's total and forge the leaderboard. The session is now the
 * only identity, the target must be the caller's own account, and the amount is
 * capped — a client that sends a nonsense number should not be able to mint
 * points even for itself.
 */
export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { userId: requested, pointsGained, isWin } = body || {};

    const denied = await requireUser(request, requested || null);
    if (denied) return denied;

    const userId = await sessionUserId(request);

    const raw = Number.parseInt(pointsGained, 10);
    const points = Number.isFinite(raw) ? Math.max(0, Math.min(MAX_POINTS_PER_SUBMIT, raw)) : 0;

    const updatedUser = await updateUserStats(userId!, points, Boolean(isWin));

    if (!updatedUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      pointsCredited: points,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("Auth Score API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
