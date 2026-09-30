import { NextResponse } from "next/server";
import { initDb, upsertGoogleUser, createPlayerSession } from "@/lib/db";
import { newSessionId, setSessionCookie } from "@/lib/session-guard";

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

    // The signature alone is not enough: an ID token minted by a different
    // Google client is still a valid Google token. Without this check, a token
    // obtained from any other app that uses Sign in with Google would be
    // accepted here and create an account in this game.
    const expectedAud = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (expectedAud && payload.aud !== expectedAud) {
      return NextResponse.json(
        { error: "Token Google ini dibuat untuk aplikasi lain." },
        { status: 401 }
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

    // Issue a session so the rest of the API can identify this player. The
    // client previously trusted a userId in localStorage, which anyone could
    // edit, so every authenticated route is now session-gated.
    const sessionId = newSessionId();
    await createPlayerSession(sessionId, user.id, request.headers.get("user-agent") || undefined);

    const res = NextResponse.json({
      success: true,
      message: `Selamat datang, ${user.name}!`,
      user,
    });
    setSessionCookie(res, sessionId);
    return res;
  } catch (err: any) {
    console.error("Auth Google API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
