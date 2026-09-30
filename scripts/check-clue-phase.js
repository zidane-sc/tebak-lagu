// Assert-based self-check for the clue phase state machine. Run: npm test
//
// Every case here is a regression that actually shipped. The commits before
// these checks existed were all "fix: <regression>" in this same code:
//   - clue audio leaked during the 3-2-1 kickoff
//   - the last clue jumped straight to the buzzer, skipping the final gap
//   - the 5s gap only belonged between clues, not after the last one
//   - the server burned ~4s of the first clue on the countdown overlay
//   - phase events fired on every tick, restarting audio every second
const assert = require("assert");
const {
  PHASE, KICKOFF_SECONDS, initialClueState, isLastClue, advanceClueState,
} = require("../src/lib/clue-phase.js");

const CFG = { playDurations: [5, 9, 15], gapSeconds: 5, finalSilenceSeconds: 30 };

/** Run the machine for n ticks. */
function run(state, n, cfg = CFG) {
  let s = state;
  const transitions = [];
  for (let i = 0; i < n; i++) {
    const r = advanceClueState(s, cfg);
    s = r.state;
    if (r.phaseChanged) transitions.push(s.phase);
    if (r.action === "reveal") return { state: s, transitions, revealed: true };
  }
  return { state: s, transitions, revealed: false };
}

// 1. The kickoff must be silent: no phase event before the countdown ends, or
//    the client starts playing audio over its own "3... 2... 1..." overlay.
{
  const s0 = initialClueState();
  assert.strictEqual(s0.phase, PHASE.IDLE);
  assert.strictEqual(s0.secondsLeft, KICKOFF_SECONDS);
  const r = run(s0, KICKOFF_SECONDS - 1);
  assert.strictEqual(r.state.phase, PHASE.IDLE, "must still be idle one tick before the kickoff ends");
  assert.deepStrictEqual(r.transitions, [], "the kickoff must not emit a phase change");
  assert.strictEqual(r.state.secondsLeft, 1, "one second of kickoff must remain");
}

// 2. Clue 1 is armed on the tick after the kickoff countdown reaches zero, with
//    its full duration. The zero-budget branch is checked before the phase
//    branches, so the tick that lands on 0 only decrements; the next one arms.
{
  const r = run(initialClueState(), KICKOFF_SECONDS + 1);
  assert.strictEqual(r.state.phase, PHASE.PLAYING);
  assert.strictEqual(r.state.index, 1);
  assert.strictEqual(r.state.secondsLeft, CFG.playDurations[0],
    "clue 1 must get its full duration, not one second less");
  assert.deepStrictEqual(r.transitions, [PHASE.PLAYING]);
}

// 3. phaseChanged must be false on ordinary ticks. The bug: every tick emitted
//    a phase event, so clients replayed the clip once a second.
{
  const armed = { phase: PHASE.PLAYING, index: 1, secondsLeft: 4 };
  const r = advanceClueState(armed, CFG);
  assert.strictEqual(r.phaseChanged, false, "a countdown tick is not a phase change");
  assert.strictEqual(r.state.secondsLeft, 3);
}

// 4. Clue 1 exhausted -> gap -> clue 2 -> gap -> clue 3 -> buzzer window.
{
  const r = run(initialClueState(), 200);
  assert.deepStrictEqual(r.transitions, [
    PHASE.PLAYING,   // clue 1 (3s kickoff + 5s)
    PHASE.SILENCE,   // 5s gap
    PHASE.PLAYING,   // clue 2 (9s)
    PHASE.SILENCE,   // 5s gap
    PHASE.PLAYING,   // clue 3 (15s)
    PHASE.FINAL_SILENCE,
  ], `unexpected phase sequence: ${r.transitions.join(" -> ")}`);
}

// 5. The last clue must jump straight to the buzzer window. A regression
//    inserted the gap after the final clue, adding 5 dead seconds.
{
  const lastClue = { phase: PHASE.PLAYING, index: 3, secondsLeft: 1 };
  const r = advanceClueState(lastClue, CFG);
  assert.strictEqual(r.state.phase, PHASE.FINAL_SILENCE, "no gap after the last clue");
  assert.strictEqual(r.state.secondsLeft, CFG.finalSilenceSeconds);
  assert.ok(isLastClue(3, CFG.playDurations));
}

// 6. The final silence is where the round can end, and only there.
{
  const inSilence = { phase: PHASE.FINAL_SILENCE, index: 3, secondsLeft: 1 };
  const r = advanceClueState(inSilence, CFG);
  assert.strictEqual(r.action, "reveal", "the round must reveal when the buzzer window expires");
  assert.strictEqual(r.phaseChanged, false, "a reveal is not a phase change");
}

// 7. Nothing may reveal before the buzzer window.
{
  const mid = run(initialClueState(), 14, CFG);
  assert.strictEqual(mid.revealed, false, "must not reveal mid-clue");
}

// 8. TTS: a single long read means no inter-clue gap at all.
{
  const tts = { playDurations: [20], gapSeconds: 0, finalSilenceSeconds: 20 };
  const r = run(initialClueState(KICKOFF_SECONDS), 60, tts);
  assert.deepStrictEqual(r.transitions, [PHASE.PLAYING, PHASE.FINAL_SILENCE],
    `TTS must go straight from the read to the buzzer, got: ${r.transitions.join(" -> ")}`);
}

// 9. A zero-duration play list must not spin. Clue 1 falls back to 5s, and the
//    round still ends at the buzzer window instead of looping on index 0.
{
  const empty = { playDurations: [], gapSeconds: 5, finalSilenceSeconds: 10 };
  const r = run(initialClueState(), 200, empty);
  assert.strictEqual(r.revealed, true, "an empty clue list must still finish the round");
  assert.ok(r.transitions.length <= 3, `must not cycle, got ${r.transitions.length} transitions`);
}

// 10. Clue 3 in a 6-tier heardle list must not be treated as the last.
{
  const six = { playDurations: [3, 5, 9, 15, 22, 30], gapSeconds: 5, finalSilenceSeconds: 30 };
  assert.strictEqual(isLastClue(3, six.playDurations), false,
    "index 3 of 6 is mid-timeline, not the last clue");
  assert.strictEqual(isLastClue(6, six.playDurations), true);
}


// 11. A zero-second gap with multiple clues must not loop. The pre-refactor
//     code set the phase to "silence" with a 0s budget, then nextPhase() ran
//     on the very next tick, re-entering silence — the round never advanced.
{
  const cfg = { playDurations: [3, 3, 3], gapSeconds: 0, finalSilenceSeconds: 15 };
  const r = run(initialClueState(), 400, cfg);
  assert.strictEqual(r.state.index, 3, "must reach the last clue index, not spin on clue 1");
  assert.ok(r.revealed, "a zero-gap multi-clue round must still finish");
  const silences = r.transitions.filter((p) => p === PHASE.SILENCE).length;
  assert.ok(silences <= 2, `zero gap must not produce repeated silence phases, got ${silences}`);
}

// 12. TTS production shape: one long read, zero gap, buzzer window sized to the
//     buzzer timer. Must never insert a silence phase.
{
  const tts = { playDurations: [20], gapSeconds: 0, finalSilenceSeconds: 20 };
  const r = run(initialClueState(), 120, tts);
  assert.deepStrictEqual(r.transitions, [PHASE.PLAYING, PHASE.FINAL_SILENCE],
    `TTS must not insert a gap, got: ${r.transitions.join(" -> ")}`);
  assert.ok(r.revealed, "the TTS round must end at the buzzer window");
}

console.log("clue-phase: all 12 groups passed");
