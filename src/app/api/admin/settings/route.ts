import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const settingsPath = path.join(process.cwd(), "src/data/settings.json");

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

function readSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      return JSON.parse(fs.readFileSync(settingsPath, "utf-8"));
    }
  } catch (e) {}
  return DEFAULT_SETTINGS;
}

export async function GET() {
  return NextResponse.json(readSettings());
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const current = readSettings();
    const updated = { ...current, ...body };

    fs.writeFileSync(settingsPath, JSON.stringify(updated, null, 2), "utf-8");

    return NextResponse.json({
      success: true,
      message: "Pengaturan game berhasil disimpan!",
      settings: updated,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
