/**
 * Single source of truth for gameplay tuning defaults.
 *
 * ponytail: one file, not a config layer. The previous state had these numbers
 * in three places that disagreed — the admin API, the socket engine's `|| 10`
 * fallbacks, and the client — so an admin save changed multiplayer but not the
 * server's own defaults. Import this everywhere; do not re-inline a literal.
 *
 * Written as CommonJS + JSDoc so both the Next.js route handlers (allowJs) and
 * the CJS socket engine in server.js can load the same object.
 */

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
  // Time Slice progression (seconds for Level 1 - 6)
  heardleDurations: [3, 5, 9, 15, 22, 30],
  // Robot Speech TTS progression (stanzas opened per attempt)
  ttsCluesProgression: [1, 2, 3, 4],
  // Clue sequence: play a slice, go quiet, play the next slice, then stay quiet
  // and finally open the buzzer.
  cluePlayDurations: [5, 9, 15],
  clueGapSeconds: 5,
  clueFinalSilenceSeconds: 30,
  ttsReadSeconds: 20,
};

const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const list = (v, fallback) =>
  Array.isArray(v) && v.length > 0 ? v.map((n) => num(n, 0)).filter((n) => n > 0) : fallback;

/** Merge stored settings over the defaults, coercing every field to a usable value. */
function resolveSettings(stored) {
  const s = stored ?? {};
  return {
    ...s,
    buzzerTimerSeconds: num(s.buzzerTimerSeconds, DEFAULT_SETTINGS.buzzerTimerSeconds),
    playerLivesPerRound: num(s.playerLivesPerRound, DEFAULT_SETTINGS.playerLivesPerRound),
    clueExtensionIntervalSeconds: num(
      s.clueExtensionIntervalSeconds,
      DEFAULT_SETTINGS.clueExtensionIntervalSeconds
    ),
    finalStageSeconds: num(s.finalStageSeconds, DEFAULT_SETTINGS.finalStageSeconds),
    disconnectGracePeriodSeconds: num(
      s.disconnectGracePeriodSeconds,
      DEFAULT_SETTINGS.disconnectGracePeriodSeconds
    ),
    defaultRounds: num(s.defaultRounds, DEFAULT_SETTINGS.defaultRounds),
    defaultDifficulty: String(s.defaultDifficulty ?? DEFAULT_SETTINGS.defaultDifficulty),
    defaultAudioProfile: String(s.defaultAudioProfile ?? DEFAULT_SETTINGS.defaultAudioProfile),
    allowMidGameJoin:
      s.allowMidGameJoin === undefined ? DEFAULT_SETTINGS.allowMidGameJoin : Boolean(s.allowMidGameJoin),
    consensusVoteSkip:
      s.consensusVoteSkip === undefined ? DEFAULT_SETTINGS.consensusVoteSkip : Boolean(s.consensusVoteSkip),
    heardleDurations: list(s.heardleDurations, DEFAULT_SETTINGS.heardleDurations.slice()),
    ttsCluesProgression: list(s.ttsCluesProgression, DEFAULT_SETTINGS.ttsCluesProgression.slice()),
    cluePlayDurations: list(s.cluePlayDurations, DEFAULT_SETTINGS.cluePlayDurations.slice()),
    clueGapSeconds: num(s.clueGapSeconds, DEFAULT_SETTINGS.clueGapSeconds),
    clueFinalSilenceSeconds: num(s.clueFinalSilenceSeconds, DEFAULT_SETTINGS.clueFinalSilenceSeconds),
    ttsReadSeconds: num(s.ttsReadSeconds, DEFAULT_SETTINGS.ttsReadSeconds),
  };
}

module.exports = { DEFAULT_SETTINGS, resolveSettings };
