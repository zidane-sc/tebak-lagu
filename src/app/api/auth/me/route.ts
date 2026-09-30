import { NextResponse } from "next/server";
import { initDb, getUserById, softDeleteUser } from "@/lib/db";
import {
  requireUser,
  sessionUserId,
  verifySessionToken,
  SESSION_COOKIE,
} from "@/lib/session-guard";

export const dynamic = "force-dynamic";

/**
 * The signed-in player's own profile.
 *
 * The userId query parameter is no longer trusted. It used to be the only input,
 * so anyone could read anyone's profile, and the DELETE branch could soft-delete
 * any account by guessing an id. The session is the only identity now; the
 * parameter is accepted only when it matches, so a stale client that still sends
 * it keeps working.
 */
export async function GET(request: Request) {
  try {
    await initDb();

    const { searchParams } = new URL(request.url);
    const requested = searchParams.get("userId");

    const denied = await requireUser(request, requested);
    if (denied) return denied;

    const userId = await sessionUserId(request);
    const user = await getUserById(userId!);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    console.error("Auth Me API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/** Withdraw the session. Only ever affects the caller's own account. */
export async function DELETE(request: Request) {
  try {
    await initDb();

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const requested = body.userId || searchParams.get("userId");

    const denied = await requireUser(request, requested);
    if (denied) return denied;

    const userId = await sessionUserId(request);
    const success = await softDeleteUser(userId!);
    if (!success) {
      return NextResponse.json(
        { error: "User not found or already deleted" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Akun berhasil dinonaktifkan (soft delete). Riwayat leaderboard tetap aman.",
    });
  } catch (err: any) {
    console.error("Auth Delete API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
