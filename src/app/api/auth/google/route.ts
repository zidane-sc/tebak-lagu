import { NextResponse } from "next/server";
import { initDb, upsertGoogleUser } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const { credential } = body;

    if (!credential || typeof credential !== "string") {
      return NextResponse.json(
        { error: "Token Google ID wajib disertakan untuk autentikasi resmi!" },
        { status: 400 }
      );
    }

    // Cryptographic verification via Google's official tokeninfo endpoint
    let payload: any = null;
    try {
      const verifyRes = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
        { headers: { "User-Agent": "TebakLagu-Auth/1.0" } }
      );

      if (!verifyRes.ok) {
        const errData = await verifyRes.json().catch(() => ({}));
        return NextResponse.json(
          {
            error: "Token Google tidak valid atau sudah kedaluwarsa.",
            details: errData.error_description || "Invalid Google ID token",
          },
          { status: 401 }
        );
      }

      payload = await verifyRes.json();
    } catch (netErr: any) {
      console.error("Error communicating with Google tokeninfo endpoint:", netErr);
      return NextResponse.json(
        { error: "Gagal memverifikasi token ke server Google. Coba lagi beberapa saat." },
        { status: 502 }
      );
    }

    const email = payload.email;
    const name = payload.name || payload.given_name || "Raja Musik";
    const avatar = payload.picture || "";
    const googleId = payload.sub;

    if (!email) {
      return NextResponse.json(
        { error: "Token Google valid namun tidak memuat informasi email akun." },
        { status: 400 }
      );
    }

    // Upsert verified Google account into persistent SQLite DB
    const user = await upsertGoogleUser({
      id: `google_${googleId}`,
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
