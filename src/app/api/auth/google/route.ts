import { NextResponse } from "next/server";
import { initDb, upsertGoogleUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { credential, userInfo } = body;

    let email = "";
    let name = "";
    let avatar = "";
    let googleId = "";

    // 1. Verify credential via Google TokenInfo API if standard JWT credential passed
    if (credential) {
      try {
        const verifyRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
          { headers: { "User-Agent": "TebakLagu/3.0" } }
        );

        if (verifyRes.ok) {
          const payload = await verifyRes.json();
          email = payload.email || "";
          name = payload.name || payload.given_name || "Pemain Musik";
          avatar = payload.picture || "";
          googleId = payload.sub || `g_${Date.now()}`;
        }
      } catch (err) {
        console.warn("Google tokeninfo verify network notice:", err);
      }
    }

    // 2. Direct user info fallback (from GSI client decoded or manual setup)
    if (!email && userInfo && userInfo.email) {
      email = userInfo.email;
      name = userInfo.name || "Pemain Musik";
      avatar = userInfo.avatar || userInfo.picture || "";
      googleId = userInfo.id || `g_${Date.now()}`;
    }

    if (!email) {
      return NextResponse.json(
        { error: "Gagal memverifikasi token Google. Email tidak ditemukan." },
        { status: 400 }
      );
    }

    // Upsert into persistent SQLite DB
    const user = await upsertGoogleUser({
      id: googleId || `u_${Math.random().toString(36).substring(2, 10)}`,
      email,
      name,
      avatar,
    });

    return NextResponse.json({
      success: true,
      message: `Selamat datang, ${user.name}!`,
      user,
    });
  } catch (err: any) {
    console.error("Auth Google API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
