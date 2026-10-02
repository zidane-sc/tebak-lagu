/**
 * No-spoiler guard.
 *
 * The game is a guessing game: the title of the current song must never leave
 * the round. Two browser channels leak it, and both are publishers we do not
 * control:
 *
 *   1. `navigator.mediaSession` — a playing <audio> or YouTube iframe publishes
 *      its track title/artist here, which Android renders in the media output
 *      panel and iOS shows on the lock screen / Control Center.
 *   2. `document.title` — the YouTube IFrame API writes the video title into
 *      the host page's title, which surfaces in the tab label and in the OS
 *      task switcher.
 *
 * Polling both was the previous approach (every 700ms / 1000ms). That cannot
 * win: it is a race, so a notification can still appear in the gap between two
 * polls, and it burns a timer for the lifetime of the page. Instead this clears
 * synchronously at every point where we start audio, and keeps a slow poll only
 * as a backstop for metadata a cross-origin document republishes on its own
 * schedule.
 */

const BASE_TITLE = "Tebak Lagu";

let pollHandle: ReturnType<typeof setInterval> | null = null;

/** Strip the answer out of anything the browser would surface. Idempotent. */
export function clearSpoilers(): void {
  // 1. Media Session — metadata and artwork are what the OS notification shows.
  try {
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      if (ms.metadata) ms.metadata = null;
      if (ms.playbackState !== "none") ms.playbackState = "none";
      // Removing the action handlers also stops the system from rendering a
      // cover image in the media panel.
      if (typeof ms.setActionHandler === "function") {
        const actions: MediaSessionAction[] = [
          "play",
          "pause",
          "seekbackward",
          "seekforward",
          "previoustrack",
          "nexttrack",
          "skipad",
          "stop",
        ];
        for (const a of actions) {
          try {
            ms.setActionHandler(a, null);
          } catch {
            // Action unsupported on this browser — ignore.
          }
        }
      }
    }
  } catch {
    // Media Session unsupported — fine.
  }

  // 2. Document title — the YouTube IFrame API overwrites this with the video
  //    title. Android's task switcher and the browser tab both show it.
  try {
    if (document.title !== BASE_TITLE) document.title = BASE_TITLE;
  } catch {
    // No document (SSR) — fine.
  }
}

/**
 * Run the guard continuously. Call once from the app shell.
 *
 * The poll is a backstop, not the primary defence: a cross-origin document can
 * republish Media Session metadata on its own schedule after we clear it, so a
 * slow sweep catches the stragglers without being the only line of defence.
 */
export function startSpoilerGuard(): () => void {
  clearSpoilers();

  if (pollHandle === null) {
    pollHandle = setInterval(clearSpoilers, 700);
  }

  return () => {
    if (pollHandle !== null) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };
}

/**
 * Clear spoilers now and again on the next tick.
 *
 * A publisher usually writes metadata a moment after playback starts, so a
 * single synchronous clear can land before the leak exists. Call this wherever
 * audio is started; the poll from startSpoilerGuard remains the backstop.
 */
export function guardPlayback(): void {
  clearSpoilers();
  setTimeout(clearSpoilers, 0);
}