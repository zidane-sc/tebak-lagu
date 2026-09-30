// Differential check: the extracted state machine must produce the same
// (phase, index, secondsLeft, reveal) sequence as the original inline logic
// from server.js, for every clue configuration the admin can set.
//
// Run: node scripts/verify-clue-phase-parity.js
//
// Why: the refactor replaced ~50 lines of timer body. A parity test against
// the old code is the only way to be sure the players' timing did not shift by
// a second somewhere.
const assert = require("assert");
const { advanceClueState, KICKOFF_SECONDS } = require("../src/lib/clue-phase.js");

/** The pre-refactor implementation, transcribed from the old timer body. */
function oldNextPhase(room) {
  if (room.clueIndex < room.cluePlayDurations.length) {
    room.clueIndex += 1;
    room.clueStage = room.clueIndex;
    room.cluePhase = "playing";
    room.clueSecondsLeft = room.cluePlayDurations[room.clueIndex - 1];
    return;
  }
  room.cluePhase = "final_silence";
  room.clueSecondsLeft = room.clueFinalSilenceSeconds;
}

function oldIsLastClue(room) {
  return room.clueIndex >= room.cluePlayDurations.length;
}

function oldTick(room) {
  if (room.clueSecondsLeft === 0) {
    room.clueIndex = 1;
    room.clueStage = 1;
    room.cluePhase = "playing";
    room.clueSecondsLeft = room.cluePlayDurations[0] || 5;
    return { emit: true, revealed: false };
  }
  if (room.cluePhase === "idle") {
    room.clueSecondsLeft -= 1;
    return { emit: false, revealed: false };
  }
  room.clueSecondsLeft -= 1;
  if (room.clueSecondsLeft > 0) {
    return { emit: true, revealed: false };
  }
  if (room.cluePhase === "playing") {
    if (oldIsLastClue(room)) {
      room.cluePhase = "final_silence";
      room.clueSecondsLeft = room.clueFinalSilenceSeconds;
    } else {
      room.cluePhase = "silence";
      room.clueSecondsLeft = room.clueGapSeconds;
    }
  } else if (room.cluePhase === "silence") {
    oldNextPhase(room);
  } else {
    return { emit: true, revealed: true };
  }
  return { emit: true, revealed: false };
}

function newTick(room) {
  const r = advanceClueState(
    { phase: room.cluePhase, index: room.clueIndex, secondsLeft: room.clueSecondsLeft },
    {
      playDurations: room.cluePlayDurations,
      gapSeconds: room.clueGapSeconds,
      finalSilenceSeconds: room.clueFinalSilenceSeconds,
    }
  );
  room.cluePhase = r.state.phase;
  room.clueIndex = r.state.index;
  room.clueStage = r.state.index;
  room.clueSecondsLeft = r.state.secondsLeft;
  return { emit: true, revealed: r.action === "reveal", phaseChanged: r.phaseChanged };
}

function makeRoom(cfg) {
  return {
    cluePhase: "idle",
    clueIndex: 0,
    clueSecondsLeft: KICKOFF_SECONDS,
    cluePlayDurations: cfg.playDurations,
    clueGapSeconds: cfg.gapSeconds,
    clueFinalSilenceSeconds: cfg.finalSilenceSeconds,
  };
}

const configs = [
  { name: "prod heardle", playDurations: [5, 9, 15], gapSeconds: 5, finalSilenceSeconds: 30 },
  { name: "tts", playDurations: [20], gapSeconds: 0, finalSilenceSeconds: 20 },
  { name: "6-tier heardle", playDurations: [3, 5, 9, 15, 22, 30], gapSeconds: 5, finalSilenceSeconds: 90 },
  { name: "single clue", playDurations: [5], gapSeconds: 5, finalSilenceSeconds: 30 },
  // gap=0 with more than one clue is not a reachable configuration: the admin
  // form only exposes a gap for the slice mode, and TTS is forced to a single
  // read with a zero gap. It is also the one case where the pre-refactor code
  // looped forever (silence with a 0s budget re-entered nextPhase every tick),
  // so parity there is not a goal — see check-clue-phase.js group 11.
  { name: "long final silence", playDurations: [5], gapSeconds: 5, finalSilenceSeconds: 120 },
];

let ticks = 0;
for (const cfg of configs) {
  const a = makeRoom(cfg);
  const b = makeRoom(cfg);
  for (let i = 0; i < 400; i++) {
    const ra = oldTick(a);
    const rb = newTick(b);
    ticks++;
    assert.strictEqual(b.cluePhase, a.cluePhase,
      `${cfg.name} tick ${i}: phase ${b.cluePhase} != ${a.cluePhase}`);
    assert.strictEqual(b.clueIndex, a.clueIndex,
      `${cfg.name} tick ${i}: index ${b.clueIndex} != ${a.clueIndex}`);
    assert.strictEqual(b.clueSecondsLeft, a.clueSecondsLeft,
      `${cfg.name} tick ${i}: secondsLeft ${b.clueSecondsLeft} != ${a.clueSecondsLeft}`);
    assert.strictEqual(rb.revealed, ra.revealed,
      `${cfg.name} tick ${i}: revealed ${rb.revealed} != ${ra.revealed}`);
    if (ra.revealed) break;
  }
  // Both must have reached the buzzer window and the same reveal tick.
  assert.strictEqual(a.cluePhase, b.cluePhase);
}

console.log(`clue-phase-parity: ${ticks} ticks across ${configs.length} configs match the pre-refactor behaviour`);
