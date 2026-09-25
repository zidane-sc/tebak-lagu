import { NextResponse } from "next/server";
import { initDb, getSettingsFromDb, saveSettingToDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULT_SETTINGS = {
  buzzerTimerSeconds: 20,
  playerLivesPerRound: 3,
  clueExtensionIntervalSeconds: 30,
  finalStageSeconds: 90,
  disconnectGracePeriodSeconds: 45,
  defaultRounds: 5,
  defaultDifficulty: "easy",
  defaultAudioProfile: "normal",
  allowMidGameJoin: true,
  consensusVoteSkip: true,
};

export async function GET() {
  try {
    await initDb();
    const dbSettings = await getSettingsFromDb();
    const merged = { ...DEFAULT_SETTINGS, ...dbSettings };
    return NextResponse.json(merged);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const current = await getSettingsFromDb();
    const updated = { ...DEFAULT_SETTINGS, ...current, ...body };

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
