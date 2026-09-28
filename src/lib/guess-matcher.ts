/**
 * Shared guess matcher for solo and multiplayer.
 *
 * Rules:
 *  - A guess is correct when it names the song (title hit).
 *  - Artist alone only counts for very short titles, otherwise "Dewa 19" would
 *    answer every Dewa 19 track.
 *  - An empty guess never matches (cleanStr("") is a substring of everything).
 */

export function cleanGuess(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function isGuessCorrect(
  guessTitle: string,
  guessArtist: string,
  targetTitle: string,
  targetArtist: string
): boolean {
  const gT = cleanGuess(guessTitle);
  const gA = cleanGuess(guessArtist);
  const tT = cleanGuess(targetTitle);
  const tA = cleanGuess(targetArtist);

  // Nothing typed can't be right.
  if (!gT && !gA) return false;

  const titleHit =
    tT.length > 0 &&
    gT.length > 0 &&
    (gT === tT || gT.includes(tT) || (tT.includes(gT) && gT.length >= 3 && gT.length / tT.length >= 0.6));

  const artistHit =
    tA.length > 0 && gA.length > 0 && (gA === tA || tA.includes(gA) || gA.includes(tA));

  // Typo tolerance: one edit on a reasonably long title.
  const nearTitle =
    !titleHit && tT.length >= 5 && gT.length >= 5 && withinOneEdit(gT, tT);

  return titleHit || nearTitle || (artistHit && tT.length <= 4);
}

/** Levenshtein distance capped at 1 edit. */
function withinOneEdit(a: string, b: string): boolean {
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
