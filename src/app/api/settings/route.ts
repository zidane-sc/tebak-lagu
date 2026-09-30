import { NextResponse } from "next/server";
import { initDb, getSettingsFromDb } from "@/lib/db";
import { resolveSettings } from "@/lib/game-settings";

export const dynamic = "force-dynamic";

/**
 * Public read-only view of the gameplay tuning. The solo arena needs these to
 * render the clue timeline before a socket round exists, so it cannot sit
 * behind the admin cookie — this deliberately returns no admin-only keys.
 * Writes stay in /api/admin/settings.
 */
export async function GET() {
  try {
    await initDb();
    const dbSettings = await getSettingsFromDb();
    return NextResponse.json(resolveSettings(dbSettings));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
