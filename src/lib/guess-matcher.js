/**
 * Shared guess matcher for solo and multiplayer.
 *
 * ponytail: one module, because this was duplicated verbatim in server.js and
 * the copies had already drifted in comments. Both paths decide whether a
 * player wins, so a rule change has to apply to both or multiplayer quietly
 * plays by different rules than solo.
 *
 * Rules:
 *  - A guess is correct when it names the song (title hit).
 *  - Artist alone only counts for very short titles, otherwise "Dewa 19" would
 *    answer every Dewa 19 track.
 *  - An empty guess never matches (cleanStr("") is a substring of everything).
 *  - A guess may be longer than the target, but only by a small amount.
 *    Previously any extra text was allowed, so "Shape of You Live At Wembley"
 *    answered "Shape of You" and "Wirang" answered "Wirang (feat. Masdddho)".
 *    The catalogue has 275 title pairs where one is a prefix of another, so
 *    that was a real scoring bug, not a theoretical one.
 */

/**
 * Normalise a guess or a catalogue title for comparison: lowercase, drop
 * everything that is not a letter or a digit.
 *
 * Parentheticals are deliberately kept. Stripping them collapses distinct
 * songs onto one another — "Kangen" and "Kangen (Ku 'Kan Datang)" both become
 * "kangen", and collisions in this catalogue rise from 95 to 210. The player's
 * extra text is bounded by titleMatches() instead.
 *
 * @param {string} s
 */
function cleanGuess(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** How much extra text a guess may carry beyond the title it names. */
const MAX_EXTRA_CHARS = 6;
/** A guess shorter than this is too generic to accept as a partial answer. */
const MIN_PARTIAL_CHARS = 3;
/**
 * Fraction of the target a partial guess must cover.
 *
 * 0.7 is the value that separates a real answer from a word-boundary
 * accident: "Shape of" for "Shape of You" is exactly 0.700 and must pass, while
 * "Sendiri" for "Sendiri Dulu" is 0.636 and must not. The old 0.6 accepted the
 * latter, so guessing the first word of a two-word title scored a point.
 */
const MIN_PARTIAL_RATIO = 0.7;

/** @param {string} guess @param {string} target */
function titleMatches(guess, target) {
  if (!target || !guess) return false;
  if (guess === target) return true;

  // The guess may carry a little extra (a typo, "official video", a stray
  // space) but not a whole second phrase.
  if (guess.length > target.length) {
    if (guess.length - target.length > MAX_EXTRA_CHARS) return false;
    // The extra text must sit at the edges, not in the middle: "shape of you
    // live at wembley" is not an answer for "shape of you", but "shapeof you"
    // and "shape of youy" are.
    return guess.startsWith(target) || guess.endsWith(target);
  }

  // The guess is shorter than the target: accept it as a partial when it is a
  // prefix of the target and long enough to be distinctive.
  return (
    target.startsWith(guess) &&
    guess.length >= MIN_PARTIAL_CHARS &&
    guess.length / target.length >= MIN_PARTIAL_RATIO
  );
}

/**
 * @param {string} guessTitle
 * @param {string} guessArtist
 * @param {string} targetTitle
 * @param {string} targetArtist
 * @returns {boolean}
 */
function isGuessCorrect(guessTitle, guessArtist, targetTitle, targetArtist) {
  const gT = cleanGuess(guessTitle);
  const gA = cleanGuess(guessArtist);
  const tT = cleanGuess(targetTitle);
  const tA = cleanGuess(targetArtist);

  // Nothing typed can't be right.
  if (!gT && !gA) return false;

  const titleHit = titleMatches(gT, tT);

  const artistHit =
    tA.length > 0 && gA.length > 0 && (gA === tA || tA.includes(gA) || gA.includes(tA));

  // Typo tolerance: one edit on a reasonably long title.
  const nearTitle = !titleHit && tT.length >= 5 && gT.length >= 5 && withinOneEdit(gT, tT);

  return titleHit || nearTitle || (artistHit && tT.length <= 4);
}

/**
 * Damerau-Levenshtein distance capped at 1 edit.
 *
 * Counts an adjacent transposition as one edit, which plain Levenshtein scores
 * as two. That matters because swapping two letters is the most common typing
 * mistake on a phone keyboard: "wriang" for "wirang" and "shpae of you" for
 * "shape of you" are one slip, not two, and a two-edit budget rejected the very
 * typo the tolerance exists to forgive.
 *
 * @param {string} a
 * @param {string} b
 */
function withinOneEdit(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;

  let i = 0;
  let j = 0;
  let edits = 0;

  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    // Adjacent swap: a[i] === b[j+1] and a[i+1] === b[j].
    if (
      edits === 0 &&
      i + 1 < a.length &&
      j + 1 < b.length &&
      a[i] === b[j + 1] &&
      a[i + 1] === b[j]
    ) {
      edits++;
      i += 2;
      j += 2;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }

  if (i < a.length || j < b.length) edits++;

  return edits <= 1;
}

module.exports = { cleanGuess, isGuessCorrect, titleMatches };
