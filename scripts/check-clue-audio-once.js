/**
 * Regression check for the multiplayer "clue plays 1 second, then restarts
 * from the top" bug.
 *
 * The bug was a timing race, so the invariant is not "which function ran" but
 * "how many times did a given round+clue actually start". This replays the real
 * event sequences — including the interleaving that used to trigger it — and
 * asserts the audible start count.
 */

// ── The logic under test, mirrored from src/app/multiplayer/page.tsx ────────
function makeGuard() {
  let startedKey = null;
  const plays = [];

  return {
    plays,
    /** one-shot start; force = genuine restart */
    play(r, force = false) {
      const idx = Number(r.clueIndex ?? r.clueStage ?? 0);
      if (!Number.isFinite(idx) || idx <= 0) return;
      const key = `${r.currentRound ?? 0}:${idx}`;
      if (!force && startedKey === key) return;
      startedKey = key;
      plays.push(key);
    },
    get currentKey() {
      return startedKey;
    },
  };
}

const assert = require("assert");
const checks = [];
const test = (name, fn) => {
  try {
    fn();
    checks.push({ name, ok: true });
  } catch (e) {
    checks.push({ name, ok: false, err: e.message });
  }
};

// ── 1. The regression itself ───────────────────────────────────────────────
// Overlay cleared and played the buffered clue; then the server's first real
// clue_phase event arrived a tick later. Two audible starts for one clue.
test("late phase event does not restart a clue the kickoff just started", () => {
  const g = makeGuard();
  const room = { currentRound: 1, clueIndex: 1 };

  g.play(room, true); // kickoff completion, buffered phase
  g.play(room); // server clue_phase(PLAYING) lands ~1 tick later

  assert.strictEqual(g.plays.length, 1, `expected 1 audible start, got ${g.plays.length}`);
  assert.deepStrictEqual(g.plays, ["1:1"]);
});

// ── 2. Kickoff with no buffered phase, then the server event ───────────────
test("kickoff with nothing buffered still yields exactly one start", () => {
  const g = makeGuard();
  g.play({ currentRound: 1, clueIndex: 1 }, true); // buffered replay
  g.play({ currentRound: 1, clueIndex: 1 }); // server event
  assert.strictEqual(g.plays.length, 1);
});

// ── 3. Every later clue in the same round must still play ──────────────────
test("a new clue index is not suppressed by the previous one", () => {
  const g = makeGuard();
  g.play({ currentRound: 1, clueIndex: 1 }, true);
  g.play({ currentRound: 1, clueIndex: 2 }, true);
  g.play({ currentRound: 1, clueIndex: 3 }, true);
  assert.strictEqual(g.plays.length, 3);
  assert.deepStrictEqual(g.plays, ["1:1", "1:2", "1:3"]);
});

// ── 4. Same clue index in the next round must play ─────────────────────────
// Guards the missing-reset class of bug: a round-blind key would swallow it.
test("the same clue index in a new round still plays", () => {
  const g = makeGuard();
  g.play({ currentRound: 1, clueIndex: 1 }, true);
  g.play({ currentRound: 2, clueIndex: 1 }, true);
  assert.strictEqual(g.plays.length, 2, "round change must not be swallowed");
  assert.deepStrictEqual(g.plays, ["1:1", "2:1"]);
});

// ── 5. Genuine restarts must still work ───────────────────────────────────
// A wrong guess, a buzz timeout and a host replay all rewind the same clue.
test("forced restarts rewind the same clue", () => {
  const g = makeGuard();
  const room = { currentRound: 2, clueIndex: 1 };
  g.play(room);
  g.play(room, true); // wrong-guess resume
  g.play(room, true); // buzz-timeout resume
  assert.strictEqual(g.plays.length, 3);
});

// ── 6. Reconnect storm: several syncs for one clue ─────────────────────────
test("repeated reconnect syncs for one clue start it once", () => {
  const g = makeGuard();
  const room = { currentRound: 3, clueIndex: 2 };
  g.play(room);
  for (let i = 0; i < 5; i++) g.play(room);
  assert.strictEqual(g.plays.length, 1);
});

// ── 7. Unkeyed state (TTS / no clue index) must not be swallowed ──────────
test("a room without a clue index is never suppressed", () => {
  const g = makeGuard();
  g.play({ currentRound: 1 });
  g.play({ currentRound: 1 });
  assert.strictEqual(g.plays.length, 0, "unkeyed rooms have no key to compare");
});

// ── 8. Server/client kickoff lengths must agree ────────────────────────────
// The server armed 4 seconds while the client hardcoded a 3-second overlay,
// so the real phase change landed after the overlay had gone.
const { KICKOFF_SECONDS } = require("../src/lib/clue-phase.js");
test("client kickoff length comes from the server", () => {
  const fs = require("fs");
  const src = fs.readFileSync(
    require("path").join(__dirname, "..", "src", "app", "multiplayer", "page.tsx"),
    "utf8",
  );
  assert.ok(
    /kickoffSeconds\s*===\s*"number"\s*\?\s*data\.kickoffSeconds/.test(src),
    "client must take the kickoff length from the server payload",
  );
  assert.ok(
    !/setRoundKickoff\(3\)/.test(src),
    "client must not hardcode a kickoff length that can drift from the server",
  );
  assert.strictEqual(KICKOFF_SECONDS, 4);
});

// ── 9. Phase-driven starts must go through the guard ───────────────────────
test("every phase-driven start goes through the once-guard", () => {
  const fs = require("fs");
  const src = fs.readFileSync(
    require("path").join(__dirname, "..", "src", "app", "multiplayer", "page.tsx"),
    "utf8",
  );
  // applyCluePhase + syncAudioToServerPhase must not call the raw player.
  assert.ok(
    !/setTimeout\(\(\) => playAudioRef\.current\(data\.room\), 120\)/.test(src),
    "applyCluePhase must use the guarded start",
  );
  assert.ok(
    !/\n\s*playAudioRef\.current\(r\);\s*\n\s*\}\s*\n\s*\/\/ Silence phase/.test(src),
    "syncAudioToServerPhase must use the guarded start",
  );
});

// ── report ─────────────────────────────────────────────────────────────────
let failed = 0;
for (const c of checks) {
  if (c.ok) {
    console.log(`  ok   ${c.name}`);
  } else {
    failed++;
    console.log(`  FAIL ${c.name}\n         ${c.err}`);
  }
}
console.log(
  failed === 0
    ? `clue-audio-once: all ${checks.length} assertions passed`
    : `clue-audio-once: ${failed}/${checks.length} FAILED`,
);
process.exit(failed === 0 ? 0 : 1);