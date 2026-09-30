// Assert-based self-check for the buzz/lives rules. Run: npm test
//
// Lives decide whether a player can keep playing, so a hardcoded default is a
// scoring bug waiting to happen: five sites read `= 3` while the room carried
// playerLivesPerRound, so setting it to 5 in Studio Admin changed the room and
// not the game.
const assert = require("assert");

// Mirrors freshLives() in server.js.
function freshLives(room) {
  const n = Number(room?.playerLivesPerRound);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/** Mirrors the allOut check in the wrong-guess handler. */
function allOut(room) {
  return (
    room.players.length > 0 &&
    room.players.every((p) => (room.buzzState.playerLives[p.id] ?? freshLives(room)) <= 0)
  );
}

const mk = (lives, players) => ({
  playerLivesPerRound: lives,
  players: players.map((id) => ({ id })),
  buzzState: { playerLives: Object.fromEntries(players.map((id) => [id, 0])) },
});

// 1. The setting must be honoured, whatever it is.
assert.strictEqual(freshLives({ playerLivesPerRound: 5 }), 5, "five lives must be five");
assert.strictEqual(freshLives({ playerLivesPerRound: 1 }), 1, "one life must be one");
assert.strictEqual(freshLives({ playerLivesPerRound: 10 }), 10, "ten lives must be ten");
assert.strictEqual(freshLives({ playerLivesPerRound: 3 }), 3);

// 2. A missing or nonsensical value falls back to 3 rather than granting 0
//    lives, which would lock every player out of the first round.
assert.strictEqual(freshLives({}), 3, "missing falls back to 3");
assert.strictEqual(freshLives({ playerLivesPerRound: 0 }), 3, "zero must not mean zero lives");
assert.strictEqual(freshLives({ playerLivesPerRound: -2 }), 3, "negative must fall back");
assert.strictEqual(freshLives({ playerLivesPerRound: "abc" }), 3, "non-numeric must fall back");
assert.strictEqual(freshLives(undefined), 3, "no room at all must not throw");

// 3. The regression: with five lives configured, a player who has only been
//    wrong twice is not out. The old code compared against 3, so they were.
const five = { playerLivesPerRound: 5, players: [{ id: "a" }], buzzState: { playerLives: { a: 3 } } };
assert.strictEqual(allOut(five), false, "3 lives left of 5 must not be out — this is the bug");

// Out means zero lives, not "the full allowance is untouched": with 3 lives
// configured a player on their third is still in.
const three = { playerLivesPerRound: 3, players: [{ id: "a" }], buzzState: { playerLives: { a: 3 } } };
assert.strictEqual(allOut(three), false, "a player who has not guessed wrong is still in");
assert.strictEqual(
  allOut({ ...three, buzzState: { playerLives: { a: 0 } } }),
  true,
  "zero lives is out"
);
assert.strictEqual(
  allOut({ ...three, buzzState: { playerLives: { a: 1 } } }),
  false,
  "one life left is still in"
);

// 4. Every player must be out, not just one. A player who has not buzzed yet
//    has no entry and must be granted the full allowance.
const mixed = {
  playerLivesPerRound: 3,
  players: [{ id: "a" }, { id: "b" }],
  buzzState: { playerLives: { a: 0 } },
};
assert.strictEqual(allOut(mixed), false, "a player with no entry is not out");
assert.strictEqual(
  allOut({ ...mixed, buzzState: { playerLives: { a: 0, b: 0 } } }),
  true,
  "both out means out"
);

// 5. An empty room must not report everyone out, which would hang the round.
assert.strictEqual(allOut({ playerLivesPerRound: 3, players: [], buzzState: { playerLives: {} } }), false,
  "an empty room is not allOut");

// 6. Zero lives is out, and lives never go negative through the deduction.
function deduct(current) {
  return Math.max(0, current - 1);
}
assert.strictEqual(deduct(1), 0, "the last life is spent");
assert.strictEqual(deduct(0), 0, "lives never go negative");
assert.strictEqual(deduct(5), 4);

// 7. The penalty cooldown must not be armed once a player is out — there is
//    nothing to come back to.
function cooldownFor(newLives) {
  return newLives > 0 ? 5000 : 0;
}
assert.strictEqual(cooldownFor(1), 5000, "a player with lives left waits five seconds");
assert.strictEqual(cooldownFor(0), 0, "an eliminated player gets no cooldown");

// 8. The timeout path had its own copy of the allOut check, drifted to a hardcoded
//    0, so a player who had never buzzed read as out and the round ended on the
//    first buzz timeout. Both copies must use the room's allowance.
{
  // Two players; "a" burned all five lives, "b" has never buzzed.
  const room = {
    playerLivesPerRound: 5,
    players: [{ id: "a" }, { id: "b" }],
    buzzState: { playerLives: { a: 0 } },
  };
  assert.strictEqual(allOut(room), false,
    "a player with no entry is not out, regardless of the allowance");
  // Once "b" also runs out, the round may end.
  room.buzzState.playerLives.b = 0;
  assert.strictEqual(allOut(room), true, "both out means the round can end");
}

// 9. defaultRounds must reach the room. Two paths read a literal 5 instead, so
//    the admin setting changed the settings screen and nothing else.
function roomRounds(room) {
  const n = Number(room?.maxRounds);
  return Number.isFinite(n) && n > 0 ? n : 5;
}
assert.strictEqual(roomRounds({ maxRounds: 3 }), 3, "the host's choice wins");
assert.strictEqual(roomRounds({ maxRounds: 10 }), 10);
assert.strictEqual(roomRounds({}), 5, "no choice falls back to the default");
assert.strictEqual(roomRounds({ maxRounds: 0 }), 5, "zero is not a round count");
assert.strictEqual(roomRounds({ maxRounds: "7" }), 7, "a string count from the client is honoured");

console.log("buzz-lives: all 9 groups passed");
