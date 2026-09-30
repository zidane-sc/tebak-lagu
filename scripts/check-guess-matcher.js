// Assert-based self-check for the guess matcher. Run: npm test
//
// These decide who wins a round. The previous implementation accepted unlimited
// extra text, so "Shape of You Live At Wembley" answered "Shape of You" and
// "Wirang" answered "Wirang (feat. Masdddho)" — the catalogue has 275 title
// pairs where one is a prefix of another, so that was a live scoring bug.
const assert = require("assert");
const { isGuessCorrect, cleanGuess } = require("../src/lib/guess-matcher.js");

// 1. Exact matches.
for (const [t, a] of [
  ["Shape of You", "Ed Sheeran"],
  ["Wirang", "Guyon Waton"],
  ["Dan", "Sheila On 7"],
  ["Kau", "Fiersa Besari"],
  ["Ai", "Doel Sumbang"],
  ["Sendiri", "Kotak"],
]) {
  assert.strictEqual(isGuessCorrect(t, a, t, a), true, `"${t}" must match itself`);
}

// 2. A guess may carry a little extra, but not a second phrase.
assert.strictEqual(isGuessCorrect("Shape of You", "", "Shape of You", "Ed Sheeran"), true, "no artist typed is fine");
assert.strictEqual(isGuessCorrect("shape of you!", "", "Shape of You", "Ed Sheeran"), true, "punctuation is stripped");
assert.strictEqual(isGuessCorrect("Shapeof You", "", "Shape of You", "Ed Sheeran"), true, "a missing space is a typo");
// Parentheticals are kept, not stripped: stripping collapses "Kangen" and
// "Kangen (Ku 'Kan Datang)" and raises catalogue collisions from 95 to 210.
// A full YouTube title copied from a search result is therefore rejected,
// which is a deliberate trade for not accepting the wrong song.
assert.strictEqual(
  isGuessCorrect("Shape of You (Official Music Video)", "", "Shape of You", "Ed Sheeran"),
  false,
  "a long parenthetical is not the plain title and must not be guessed around"
);
assert.strictEqual(
  isGuessCorrect("Shape of You Extra Long Second Phrase", "", "Shape of You", "Ed Sheeran"),
  false,
  "a second phrase is not a descriptor and must not answer the song"
);

// 3. The prefix collision that motivated the change.
const collisions = [
  ["Wirang", "Wirang (feat. Masdddho)", "Denny Caknan"],
  ["Dan", "Dance Tonight (feat. JFlow) [Asian Games 2018 Official Song]", "Bunga Citra Lestari"],
  ["Kangen", "Kangen (Ku 'Kan Datang)", "Dewa 19"],
  ["Sendiri", "Sendiri Dulu", "Feby Putri"],
  ["Virus", "Virus Masa Lalu", "Dhyo Haw"],
  ["Kita", "Kita usahakan rumah itu", "Sal Priadi"],
  ["Arjuna", "Arjunanya Buaya", "Inul Daratista"],
];
for (const [guess, target, artist] of collisions) {
  assert.strictEqual(
    isGuessCorrect(guess, "", target, artist),
    false,
    `"${guess}" must not answer "${target}" (${artist})`
  );
}

// 4. A shorter guess is accepted only when it is a distinctive prefix.
assert.strictEqual(isGuessCorrect("Shape", "", "Shape of You", "Ed Sheeran"), false,
  "one word of a long title is too generic");
assert.strictEqual(isGuessCorrect("Shape of", "", "Shape of You", "Ed Sheeran"), true,
  "a covering prefix is an acceptable answer");
assert.strictEqual(isGuessCorrect("Dan", "", "Dance Tonight", "Someone"), false,
  "a 3-of-13 prefix is below the ratio floor");

// 5. Artist alone only answers a very short title, or every track by that
//    artist would be guessable by typing the band name.
assert.strictEqual(isGuessCorrect("", "Dewa 19", "Kau", "Dewa 19"), true, "artist answers a 3-char title");
assert.strictEqual(isGuessCorrect("", "Dewa 19", "Arjuna", "Dewa 19"), false,
  "the artist rule stops at 4 chars; a 6-char title must be named");
assert.strictEqual(isGuessCorrect("", "Dewa 19", "Separuh Nafas", "Dewa 19"), false,
  "artist must not answer a long title");
assert.strictEqual(isGuessCorrect("", "Dewa 19", "Kau", "Dewa 19"), true, "artist answers a 3-char title");

// 6. One typo is forgiven, two are not.
assert.strictEqual(isGuessCorrect("Shpae of You", "", "Shape of You", "Ed Sheeran"), true, "one transposition");
assert.strictEqual(isGuessCorrect("Shap of You", "", "Shape of You", "Ed Sheeran"), true, "one deletion");
assert.strictEqual(isGuessCorrect("Shpa of Yuo", "", "Shape of You", "Ed Sheeran"), false, "two edits is not a guess");
assert.strictEqual(isGuessCorrect("Shap", "", "Shape of You", "Ed Sheeran"), false, "too short for typo tolerance");

// 7. An empty guess is never correct — cleanGuess("") is a substring of
//    everything, which is the whole reason this guard exists.
assert.strictEqual(isGuessCorrect("", "", "Shape of You", "Ed Sheeran"), false, "empty is never right");
assert.strictEqual(isGuessCorrect("   ", "  ", "Kau", "Fiersa Besari"), false, "whitespace is empty");
assert.strictEqual(isGuessCorrect("!!!", "???", "Ai", "Doel Sumbang"), false, "punctuation-only is empty");
assert.strictEqual(isGuessCorrect("", "Anyone At All", "Shape of You", "Ed Sheeran"), false,
  "an unrelated artist must not answer a long title");

// 8. A song whose title is a single repeated character still works.
assert.strictEqual(isGuessCorrect("Aaa", "", "Aaa", "Danilla"), true);
assert.strictEqual(isGuessCorrect("Ai", "", "Ai", "Doel Sambung"), true);

console.log("guess-matcher: all 8 groups passed");
