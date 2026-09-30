/**
 * Clue phase state machine.
 *
 * ponytail: pure functions, one file, no classes. The timer in server.js mixed
 * three concerns — counting down, deciding the next phase, and side effects
 * (broadcast, reveal) — so a transition bug meant reasoning about setInterval
 * ordering. This holds only the decision, so it can be asserted directly.
 *
 * Every rule here was a regression at some point; see scripts/check-clue-phase.js.
 */

/**
 * Seconds of client kickoff before the first clue's clock starts.
 * Server sends the same value in round_started as `kickoffSeconds`, so the
 * client overlay and the server clock cannot drift apart.
 */
const KICKOFF_SECONDS = 4;

const PHASE = {
  IDLE: "idle",
  PLAYING: "playing",
  SILENCE: "silence",
  FINAL_SILENCE: "final_silence",
};

/** Initial state for a fresh round. */
function initialClueState(kickoffSeconds = KICKOFF_SECONDS) {
  return { phase: PHASE.IDLE, index: 0, secondsLeft: kickoffSeconds };
}

/**
 * True when no more clues remain, so the next transition goes to the buzzer
 * window rather than burning an inter-clue gap first.
 */
function isLastClue(index, playDurations) {
  return index >= playDurations.length;
}

/**
 * Advance one second.
 *
 * Returns { state, action, phaseChanged }:
 *   action       "none" | "reveal"
 *   phaseChanged true only on a real phase transition, so the client can avoid
 *                replaying audio on every tick — that bug shipped twice.
 *
 * `playDurations` is the clue timeline; for TTS it is a single long read, so
 * the silence gap is skipped entirely and the only path is playing -> buzzer.
 */
function advanceClueState(state, config) {
  const { playDurations = [], gapSeconds = 5, finalSilenceSeconds = 30 } = config;
  const next = { ...state };

  // Kickoff finished: arm the first clue. This branch is reached only because
  // the countdown hit zero while idle, so it must precede the phase checks.
  if (next.secondsLeft === 0) {
    if (next.phase === PHASE.IDLE) {
      next.index = 1;
      next.phase = PHASE.PLAYING;
      next.secondsLeft = playDurations[0] || 5;
      return { state: next, action: "none", phaseChanged: true };
    }
    // A non-idle phase with a zero budget would otherwise re-arm clue 1
    // forever. The settings resolver refuses a 0, but the state machine should
    // not depend on that.
    if (next.phase === PHASE.PLAYING) {
      next.phase = PHASE.FINAL_SILENCE;
      next.secondsLeft = finalSilenceSeconds || 1;
    } else if (next.phase === PHASE.SILENCE) {
      return advanceCluePhase(next, config);
    } else {
      return { state: next, action: "reveal", phaseChanged: false };
    }
    return { state: next, action: "none", phaseChanged: true };
  }

  // Still inside the client kickoff: tick silently. Broadcasting here would
  // tell the client about a phase it has no UI for yet, and the client starts
  // playing audio on a phase event.
  if (next.phase === PHASE.IDLE) {
    next.secondsLeft -= 1;
    return { state: next, action: "none", phaseChanged: false };
  }

  next.secondsLeft -= 1;
  if (next.secondsLeft > 0) {
    return { state: next, action: "none", phaseChanged: false };
  }

  // A phase just ran out.
  if (next.phase === PHASE.PLAYING) {
    if (isLastClue(next.index, playDurations)) {
      next.phase = PHASE.FINAL_SILENCE;
      next.secondsLeft = finalSilenceSeconds;
    } else {
      next.phase = PHASE.SILENCE;
      next.secondsLeft = gapSeconds;
    }
    return { state: next, action: "none", phaseChanged: true };
  }

  if (next.phase === PHASE.SILENCE) {
    return advanceCluePhase(next, config);
  }

  return { state: next, action: "reveal", phaseChanged: false };
}

/** Open the next clue. Shared by the timer and the zero-budget guard. */
function advanceCluePhase(state, config) {
  const { playDurations = [] } = config;
  if (state.index < playDurations.length) {
    state.index += 1;
    state.phase = PHASE.PLAYING;
    state.secondsLeft = playDurations[state.index - 1];
    return { state, action: "none", phaseChanged: true };
  }
  state.phase = PHASE.FINAL_SILENCE;
  state.secondsLeft = config.finalSilenceSeconds ?? 30;
  return { state, action: "none", phaseChanged: true };
}

module.exports = { PHASE, KICKOFF_SECONDS, initialClueState, isLastClue, advanceClueState, advanceCluePhase };
