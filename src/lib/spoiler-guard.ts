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

// Clean 0.25s 8kHz mono silent PCM WAV data URI
const SILENT_WAV =
  "data:audio/wav;base64,UklGRvQHAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YdAHAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

let pollHandle: ReturnType<typeof setInterval> | null = null;
let silentAudioElement: HTMLAudioElement | null = null;

function getSilentAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!silentAudioElement) {
    silentAudioElement = new Audio(SILENT_WAV);
    silentAudioElement.loop = true;
    silentAudioElement.volume = 0.01;
  }
  return silentAudioElement;
}

/**
 * Anchor the browser's Media Session routing to the top-level document.
 *
 * In Chromium (Android Chrome) and WebKit (iOS Safari), the OS media panel
 * evaluates the active media session using ComputeFrameForRouting. If only the
 * cross-origin YouTube iframe has a playing HTML media element, Chromium routes
 * directly to the iframe (depth 1), bypassing the top frame's metadata and
 * leaking the YouTube video title.
 *
 * Playing an HTMLAudioElement in the top document (depth 0) ensures the top
 * frame always wins routing precedence, suppressing the iframe's metadata.
 */
export function anchorMediaSession(): void {
  try {
    const audio = getSilentAudio();
    if (audio && audio.paused) {
      audio.play().catch(() => {});
    }
  } catch {}
  clearSpoilers();
  try {
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "playing";
      if (typeof navigator.mediaSession.setActionHandler === "function") {
        navigator.mediaSession.setActionHandler("pause", () => {
          window.dispatchEvent(new CustomEvent("tl:mediasession-pause"));
        });
      }
    }
  } catch {}
}

export function releaseMediaSession(): void {
  try {
    const audio = getSilentAudio();
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  } catch {}
  clearSpoilers();
}

/**
 * Overwrite the media-session metadata with a neutral placeholder instead of
 * clearing it.
 *
 * Why not `metadata = null`: null is not a delete. iOS routes Media Session
 * through `MPNowPlayingInfoCenter`, which keeps the last value it was given —
 * a null assignment is accepted by the API and ignored by the OS, so the song
 * title stays on the lock screen. WebKit's handling is unspecified and varies by
 * version, and the metadata semantics are still being argued in the spec
 * (w3c/mediasession#343, tracked by WebKit #1921511), so "clear by nulling"
 * cannot be relied on across devices.
 *
 * Last write wins. Publishing a harmless placeholder after the publisher writes
 * the title guarantees the OS's most recent value is the placeholder, without
 * depending on delete semantics at all. The player has no metadata of its own
 * to leak — it only ever received the id and offset.
 */
function writeDecoyMetadata(): void {
  try {
    if (!("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({
      title: BASE_TITLE,
      artist: BASE_TITLE,
      album: BASE_TITLE,
    });
  } catch {
    // MediaMetadata unsupported or blocked — the sweep will try again.
  }
}

/** Strip the answer out of anything the browser would surface. Idempotent. */
export function clearSpoilers(): void {
  // 1. Media Session — metadata and artwork are what the OS notification shows.
  try {
    if ("mediaSession" in navigator) {
      const ms = navigator.mediaSession;
      // Overwrite rather than clear, and never null afterwards: the null
      // assignment is the thing that does not retract an already-shown
      // notification on iOS.
      writeDecoyMetadata();
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

  // 3. Iframe title — the YouTube IFrame API sets the iframe element's title
  //    attribute to the video title, which surfaces in accessibility tools,
  //    browser media routers, and OS media controls.
  try {
    const iframes = document.querySelectorAll("iframe");
    for (let i = 0; i < iframes.length; i++) {
      const iframe = iframes[i];
      if (iframe.title && iframe.title !== BASE_TITLE) {
        iframe.title = BASE_TITLE;
      }
    }
  } catch {
    // No document (SSR) — fine.
  }
}

/**
 * Run the guard continuously. Call once from the app shell.
 *
 * The poll is a backstop, not the primary defence: a cross-origin document can
 * republish Media Session metadata on its own schedule after we clear it. In
 * practice the YouTube iframe fires its metadata callback several times per
 * video (see Mozilla bug 1904774 — three times on a plain YouTube page), so no
 * interval can be strictly faster than the publisher. Synchronous clears at
 * every play site are the real defence; this sweep is the net.
 */
export function startSpoilerGuard(): () => void {
  clearSpoilers();

  let observer: MutationObserver | null = null;
  try {
    if (typeof MutationObserver !== "undefined") {
      observer = new MutationObserver(() => {
        clearSpoilers();
      });
      observer.observe(document.documentElement, {
        subtree: true,
        attributes: true,
        attributeFilter: ["title"],
      });
    }
  } catch {}

  // Locking the phone or switching apps is exactly when the OS decides to show
  // the media notification, so clear on the transition itself rather than
  // waiting for the next sweep — it is the moment the title is most likely to
  // be sampled.
  const onVisibility = () => {
    if (document.visibilityState === "hidden") {
      clearSpoilers();
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  // iOS Safari raises `pagehide` when a PWA is backgrounded or closed; the
  // last chance to drop the label before the snapshot is taken.
  const onPageHide = () => clearSpoilers();
  window.addEventListener("pagehide", onPageHide);
  window.addEventListener("blur", onPageHide);

  if (pollHandle === null) {
    pollHandle = setInterval(clearSpoilers, 700);
  }

  return () => {
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", onPageHide);
    window.removeEventListener("blur", onPageHide);
    if (observer !== null) {
      observer.disconnect();
      observer = null;
    }
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