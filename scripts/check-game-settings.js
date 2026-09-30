// Assert-based self-check for the shared settings resolver. Run: node scripts/check-game-settings.js
const assert = require("assert");
const { DEFAULT_SETTINGS, resolveSettings } = require("../src/lib/game-settings.js");

// 1. Empty DB (the exact local state that caused the split-brain) must land on
//    the same values prod had stored, not on the old `|| 10` fallbacks.
const empty = resolveSettings({});
assert.strictEqual(empty.clueExtensionIntervalSeconds, 30, "empty must use 30s clue interval, not 10");
assert.strictEqual(empty.finalStageSeconds, 90, "empty must use 90s final stage, not 15");
assert.strictEqual(empty.buzzerTimerSeconds, 20, "empty must use 20s buzzer, not 15");
assert.strictEqual(empty.playerLivesPerRound, 3, "empty must use 3 lives");
assert.deepStrictEqual(empty.heardleDurations, [3, 5, 9, 15, 22, 30], "empty must not fall back to [5,9,18,30]");

// 2. Stored values win over defaults.
const stored = resolveSettings({
  buzzerTimerSeconds: 45,
  finalStageSeconds: 120,
  heardleDurations: [2, 4, 8],
  consensusVoteSkip: false,
});
assert.strictEqual(stored.buzzerTimerSeconds, 45);
assert.strictEqual(stored.finalStageSeconds, 120);
assert.deepStrictEqual(stored.heardleDurations, [2, 4, 8]);
assert.strictEqual(stored.consensusVoteSkip, false, "explicit false must not be replaced by the default");

// 3. Defaults fill only the gaps.
assert.strictEqual(stored.clueExtensionIntervalSeconds, DEFAULT_SETTINGS.clueExtensionIntervalSeconds);
assert.strictEqual(stored.playerLivesPerRound, DEFAULT_SETTINGS.playerLivesPerRound);

// 4. Junk from a hand-edited DB row must not reach the game loop.
const junk = resolveSettings({
  buzzerTimerSeconds: 0,
  finalStageSeconds: -5,
  playerLivesPerRound: "abc",
  heardleDurations: [],
  cluePlayDurations: "not-a-list",
  clueGapSeconds: null,
  ttsCluesProgression: [0, 5, -1],
});
assert.strictEqual(junk.buzzerTimerSeconds, DEFAULT_SETTINGS.buzzerTimerSeconds, "0 must fall back");
assert.strictEqual(junk.finalStageSeconds, DEFAULT_SETTINGS.finalStageSeconds, "negative must fall back");
assert.strictEqual(junk.playerLivesPerRound, DEFAULT_SETTINGS.playerLivesPerRound, "NaN must fall back");
assert.deepStrictEqual(junk.heardleDurations, DEFAULT_SETTINGS.heardleDurations, "empty list must fall back");
assert.deepStrictEqual(junk.cluePlayDurations, DEFAULT_SETTINGS.cluePlayDurations, "non-list must fall back");
assert.strictEqual(junk.clueGapSeconds, DEFAULT_SETTINGS.clueGapSeconds, "null must fall back");
assert.deepStrictEqual(junk.ttsCluesProgression, [5], "non-positive entries dropped");

// 5. Defaults are returned by reference only as fresh copies — mutating the
//    result must not corrupt the shared default for the next request.
const a = resolveSettings({});
a.heardleDurations.push(999);
a.cluePlayDurations[0] = -1;
const b = resolveSettings({});
assert.deepStrictEqual(b.heardleDurations, DEFAULT_SETTINGS.heardleDurations, "heardleDurations leaked mutation");
assert.deepStrictEqual(b.cluePlayDurations, DEFAULT_SETTINGS.cluePlayDurations, "cluePlayDurations leaked mutation");
assert.ok(!("error" in DEFAULT_SETTINGS), "sanity: defaults object intact");

// 6. null/undefined stored must behave like empty.
for (const v of [null, undefined]) {
  assert.deepStrictEqual(resolveSettings(v).heardleDurations, DEFAULT_SETTINGS.heardleDurations);
}

console.log("game-settings: all 24 assertions passed");
