import { NextResponse } from "next/server";
import { initDb, getUserById, softDeleteUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await initDb();
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const user = await getUserById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ user });
  } catch (err: any) {
    console.error("Auth Me API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const userId = body.userId || searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing userId parameter" }, { status: 400 });
    }

    const success = await softDeleteUser(userId);
    if (!success) {
      return NextResponse.json({ error: "User not found or already deleted" }, { status: 404 });
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
