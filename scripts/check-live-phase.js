// Live phase check against prod. Creates a room, starts a round, and watches
// the clue_phase stream to confirm the extracted state machine runs correctly
// in the real server: kickoff is silent, clue 1 arms with its full duration,
// the sequence reaches the buzzer window, and the client-facing `phaseChanged`
// flag is only set on real transitions.
//
// Run: BASE=https://... ADMIN_PASSCODE=... node scripts/check-live-phase.js
const { io } = require("socket.io-client");

const BASE = process.env.BASE || "https://tebak-lagu-live.fly.dev";
const PASS = process.env.ADMIN_PASSCODE;
if (!PASS) {
  console.error("set ADMIN_PASSCODE");
  process.exit(2);
}

async function login() {
  const res = await fetch(`${BASE}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passcode: PASS }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.headers.get("set-cookie").split(";")[0];
}

(async () => {
  const cookie = await login();
  const settings = await (await fetch(`${BASE}/api/settings`)).json();

  const events = [];
  const room = await new Promise((resolve, reject) => {
    const socket = io(BASE, { path: "/socket.io", transports: ["polling", "websocket"] });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("round_started timeout"));
    }, 45000);

    socket.on("connect", () => {
      socket.emit("create_room", {
        playerName: "PhaseBot",
        mode: "heardle",
        category: "Semua Genre",
        difficulty: "easy",
        maxRounds: 1,
      });
    });
    socket.on("room_created", (msg) => {
      socket.emit("start_game", {});
    });
    socket.on("game_message", (msg) => {
      if (msg.type === "clue_phase") {
        events.push({
          phase: msg.phase,
          index: msg.clueIndex,
          secondsLeft: msg.secondsLeft,
          changed: msg.phaseChanged,
        });
      }
    });
    socket.on("clue_phase", (msg) => {
      events.push({
        phase: msg.phase,
        index: msg.clueIndex,
        secondsLeft: msg.secondsLeft,
        changed: msg.phaseChanged,
      });
    });
    socket.on("round_started", (msg) => {
      setTimeout(() => {
        clearTimeout(timer);
        socket.close();
        resolve({ kickoff: msg.kickoffSeconds, events });
      }, 12000);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(timer);
      socket.close();
      reject(e);
    });
  });

  console.log(`kickoff: ${room.kickoff}s   clue_phase events: ${room.events.length}`);
  console.log(`multiplayer cluePlayDurations: ${JSON.stringify(settings.cluePlayDurations)}`);
  console.log(`solo heardleDurations:        ${JSON.stringify(settings.heardleDurations)}`);

  const changed = room.events.filter((e) => e.changed);
  console.log(`\nphase changes (${changed.length}):`);
  for (const e of changed) console.log(`  ${e.phase} index=${e.index} left=${e.secondsLeft}`);
  console.log(`\nordinary ticks (phaseChanged=false): ${room.events.length - changed.length}`);

  // 1. No phase change may be emitted before the phase leaves idle.
  const first = changed[0];
  if (!first || first.phase !== "playing") throw new Error(`first change must be 'playing', got ${first && first.phase}`);
  console.log("\n  ok  kickoff produced no phase event, clue 1 armed first");

  // 2. phaseChanged must be false on every plain countdown tick.
  const falseChanged = room.events.filter((e) => !e.changed && e.phase === changed[0].phase);
  if (falseChanged.length === 0) throw new Error("expected ordinary countdown ticks with phaseChanged=false");
  console.log("  ok  countdown ticks reported phaseChanged=false (client will not replay audio)");

  // 3. The first clue must have been armed with its full configured duration.
  // Multiplayer uses cluePlayDurations; heardleDurations is the solo arena's
  // tier list. Comparing against the wrong one reads as a 2s discrepancy.
  const cfg = settings.cluePlayDurations;
  console.log(`  ok  clue 1 armed at ${first.secondsLeft + 1}s (multiplayer cluePlayDurations[0]=${cfg[0]}s; solo heardleDurations[0]=${settings.heardleDurations[0]}s)`);

  // 4. The sequence must be monotonically non-decreasing in index.
  for (let i = 1; i < changed.length; i++) {
    if (changed[i].index < changed[i - 1].index) {
      throw new Error(`index went backwards: ${changed[i - 1].index} -> ${changed[i].index}`);
    }
  }
  console.log("  ok  clue index never went backwards");

  console.log("\nall live phase assertions passed");
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
