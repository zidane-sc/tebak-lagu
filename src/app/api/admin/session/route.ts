import { NextResponse } from "next/server";
import { isPasscodeValid, adminSessionToken, ADMIN_COOKIE } from "@/lib/admin-guard";

export const dynamic = "force-dynamic";

/** POST { passcode } -> sets the admin cookie. Wrong passcode = 401, no cookie. */
export async function POST(request: Request) {
  const token = adminSessionToken();
  if (!token) {
    return NextResponse.json(
      { error: "ADMIN_PASSCODE belum di-set di environment server." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  if (!isPasscodeValid(String(body?.passcode ?? ""))) {
    return NextResponse.json({ error: "Passcode salah." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

/** DELETE -> clears the cookie (lock button). */
export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
