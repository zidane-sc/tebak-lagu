import { NextResponse } from "next/server";
import { initDb, getSettingsFromDb, saveSettingToDb } from "@/lib/db";
import { requireAdmin } from "@/lib/admin-guard";
import { resolveSettings } from "@/lib/game-settings";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await initDb();
    const dbSettings = await getSettingsFromDb();
    return NextResponse.json(resolveSettings(dbSettings));
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = requireAdmin(request);
  if (denied) return denied;

  try {
    await initDb();
    const body = await request.json();
    const current = await getSettingsFromDb();
    const updated = resolveSettings({ ...current, ...body });

    for (const [key, value] of Object.entries(updated)) {
      await saveSettingToDb(key, value);
    }

    return NextResponse.json({
      success: true,
      message: "Pengaturan game berhasil disimpan ke database persistent!",
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
