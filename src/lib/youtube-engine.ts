"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import {
  startSpoilerGuard,
  guardPlayback,
  anchorMediaSession,
  releaseMediaSession,
} from "@/lib/spoiler-guard";

// ── Types ────────────────────────────────────────────────────────────────────
export type YTEngineState =
  | "idle"
  | "loading"
  | "cued"
  | "playing"
  | "paused"
  | "error"
  | "unavailable";

export interface YTSong {
  youtubeId: string;
  startSecond?: number;
  title?: string;
  artist?: string;
}

export interface YouTubeEngineHandle {
  play: (song: YTSong) => void;
  cue: (song: YTSong) => void;         // muted preload (lobby/result screen)
  unmuteAndPlay: (startSecond?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (second: number) => void;
  state: YTEngineState;
  currentSong: YTSong | null;
  error: string | null;
}

interface Props {
  onStateChange?: (state: YTEngineState) => void;
  onError?: (msg: string, code?: number) => void;
  onReady?: () => void;
}

// ── Singleton IFrame API loader ───────────────────────────────────────────────
let apiLoaded = false;
let apiCallbacks: (() => void)[] = [];

function loadYouTubeAPI(cb: () => void) {
  if (typeof window === "undefined") return;
  if (apiLoaded && (window as any).YT?.Player) { cb(); return; }
  apiCallbacks.push(cb);
  if (document.getElementById("yt-api-script")) return;

  (window as any).onYouTubeIframeAPIReady = () => {
    apiLoaded = true;
    apiCallbacks.forEach(fn => fn());
    apiCallbacks = [];
  };

  const s = document.createElement("script");
  s.id = "yt-api-script";
  s.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(s);
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useYouTubeEngine({ onStateChange, onError, onReady }: Props = {}): YouTubeEngineHandle {
  const playerRef = useRef<any>(null);
  const isReadyRef = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pendingSong = useRef<YTSong | null>(null);
  const pendingUnmute = useRef<number | null>(null);
  const isCued = useRef(false);
  const [state, setState] = useState<YTEngineState>("idle");
  const [currentSong, setCurrentSong] = useState<YTSong | null>(null);
  const [error, setError] = useState<string | null>(null);

  const updateState = useCallback((s: YTEngineState) => {
    setState(s);
    onStateChange?.(s);
  }, [onStateChange]);

  const initPlayer = useCallback(() => {
    if (playerRef.current || !containerRef.current) return;
    updateState("loading");

    playerRef.current = new (window as any).YT.Player(containerRef.current, {
      width: 160,
      height: 90,
      playerVars: {
        autoplay: 0,
        mute: 1,
        controls: 0,
        disablekb: 1,
        fs: 0,
        modestbranding: 1,
        rel: 0,
        playsinline: 1,
        origin: window.location.origin,
      },
      events: {
        onReady: () => {
          isReadyRef.current = true;
          updateState("idle");
          onReady?.();
          // Load pending song if queued
          if (pendingSong.current) {
            const s = pendingSong.current;
            pendingSong.current = null;
            if (isCued.current) {
              setCurrentSong(s);
              try {
                playerRef.current?.mute();
                if (typeof playerRef.current?.cueVideoById === "function") {
                  playerRef.current.cueVideoById({ videoId: s.youtubeId, startSeconds: 0 });
                }
              } catch {}
            } else {
              loadSong(s, false);
            }
          }

          // Silence the Media Session so Android/desktop doesn't raise a
          // system notification showing the currently playing song (spoiler).
          // The shared guard owns this logic; call it rather than duplicating.
          guardPlayback();
        },
        onStateChange: (e: any) => {
          const YT = (window as any).YT.PlayerState;
          if (e.data === YT.PLAYING) {
            updateState("playing");
            anchorMediaSession();
            try {
              playerRef.current?.unMute();
              playerRef.current?.setVolume(100);
            } catch {}
          }
          else if (e.data === YT.PAUSED) {
            updateState("paused");
            releaseMediaSession();
          }
          else if (e.data === YT.CUED) updateState("cued");
          else if (e.data === YT.BUFFERING) updateState("loading");
          else if (e.data === YT.ENDED) {
            updateState("idle");
            releaseMediaSession();
          }
        },
        onError: (e: any) => {
          // Error codes: 2=invalid, 5=html5, 100=not found, 101/150=embedding disabled
          const msgs: Record<number, string> = {
            2: "Video ID tidak valid",
            5: "Error pemutar HTML5",
            100: "Video tidak ditemukan",
            101: "Video tidak bisa diembed",
            150: "Video tidak bisa diembed",
          };
          const msg = msgs[e.data] || `YouTube error ${e.data}`;
          setError(msg);
          updateState("unavailable");
          onError?.(msg, e.data);
        },
      },
    });
  }, [updateState, onReady, onError]);

  // Internal load helper
  const loadSong = useCallback((song: YTSong, muteOnly = false) => {
    if (!isReadyRef.current || !playerRef.current || typeof playerRef.current.loadVideoById !== "function") {
      pendingSong.current = song;
      isCued.current = muteOnly;
      return;
    }
    setError(null);
    setCurrentSong(song);
    updateState("loading");

    try {
      playerRef.current.mute();
      playerRef.current.loadVideoById({
        videoId: song.youtubeId,
        startSeconds: muteOnly ? 0 : (song.startSecond ?? 20),
      });

      if (!muteOnly) {
        // Unmute when the player actually reports PLAYING, not on a blind timer.
        // A blind setTimeout races with loadVideoById and can unmute the wrong video.
        pendingUnmute.current = song.startSecond ?? 20;
      }
    } catch {
      pendingSong.current = song;
      isCued.current = muteOnly;
    }
  }, [updateState]);

  // Unmute on the PLAYING event instead of a timer (fixes silent playback)
  useEffect(() => {
    if (state === "playing" && pendingUnmute.current !== null && !isCued.current) {
      const sec = pendingUnmute.current;
      pendingUnmute.current = null;
      try {
        playerRef.current?.seekTo(sec, true);
        playerRef.current?.unMute();
        playerRef.current?.setVolume(100);
        playerRef.current?.playVideo();
        // Clear before the OS can read the metadata the start just published.
        guardPlayback();
        setError(null);
        // Watchdog: browsers sometimes keep the player muted after a
        // programmatic load, so re-assert the volume.
        setTimeout(() => {
          try {
            playerRef.current?.unMute();
            playerRef.current?.setVolume(100);
          } catch {}
        }, 400);
      } catch {
        // player not ready — ignore
      }
    }
  }, [state]);

  // Mount container div (completely hidden offscreen so no YouTube logo/box appears)
  useEffect(() => {
    if (!containerRef.current) {
      let div = document.getElementById("yt-engine-player") as HTMLDivElement | null;
      if (!div) {
        div = document.createElement("div");
        div.id = "yt-engine-player";
        // 1x1 px, clipped out of view. The iframe still renders (so audio plays
        // and the embed counts as visible for TOS), but takes no layout space.
        div.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 1px;
          height: 1px;
          opacity: 0.01;
          pointer-events: none;
          z-index: -1;
          overflow: hidden;
        `;
        document.body.appendChild(div);
      }
      containerRef.current = div;
    }

    loadYouTubeAPI(initPlayer);

    return () => {
      // Don't destroy on unmount — keep singleton alive across route changes
    };
  }, [initPlayer]);

  useEffect(() => {
    // YouTube IFrame API writes the video title into document.title on some
    // browsers, which surfaces a system notification / tab label with the answer.
    // Pin the title so no spoiler leaks.
    const baseTitle = "Tebak Lagu";
    document.title = baseTitle;
    const titleGuard = setInterval(() => {
      if (document.title !== baseTitle) document.title = baseTitle;
    }, 1000);
    return () => clearInterval(titleGuard);
  }, []);

  useEffect(() => {
    // A cross-origin document (the YouTube iframe) republishes its own Media
    // Session metadata on its own schedule, so clearing once is not enough.
    // startSpoilerGuard runs the sweep; guardPlayback() also fires synchronously
    // at each play/seek below so the metadata never has a window to appear.
    return startSpoilerGuard();
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────
  const play = useCallback((song: YTSong) => {
    isCued.current = false;
    if (!isReadyRef.current || !playerRef.current || typeof playerRef.current.playVideo !== "function") {
      pendingSong.current = song;
      return;
    }

    // If the player already has this video cued/loaded, just seek and unmute immediately
    if (currentSong?.youtubeId === song.youtubeId) {
      const sec = song.startSecond ?? currentSong?.startSecond ?? 20;
      try {
        playerRef.current.seekTo(sec, true);
        playerRef.current.unMute();
        playerRef.current.setVolume(100);
        playerRef.current.playVideo();
        updateState("playing");
        guardPlayback();
        // Mobile can silently drop the unmute if the video was paused, so
        // re-assert volume shortly after as a watchdog.
        setTimeout(() => {
          try {
            playerRef.current?.unMute();
            playerRef.current?.setVolume(100);
          } catch {}
        }, 350);
        return;
      } catch (e) {
        loadSong(song, false);
        return;
      }
    }
    loadSong(song, false);
  }, [currentSong, loadSong, updateState]);

  const cue = useCallback((song: YTSong) => {
    // Muted preload — use during lobby/result screen and round kickoff.
    // cueVideoById, not loadVideoById: the latter asks the iframe to start
    // playback, which leaks ~1s of audio before the 3-2-1 overlay clears and
    // then gets restarted by the real clue.
    isCued.current = true;
    if (!isReadyRef.current || !playerRef.current || typeof playerRef.current.cueVideoById !== "function") {
      pendingSong.current = song;
      return;
    }
    setCurrentSong(song);
    try {
      playerRef.current.mute();
      if (typeof playerRef.current.cueVideoById === "function") {
        playerRef.current.cueVideoById({ videoId: song.youtubeId, startSeconds: 0 });
      } else {
        playerRef.current.loadVideoById({ videoId: song.youtubeId, startSeconds: 0 });
        playerRef.current.pauseVideo();
      }
    } catch {
      pendingSong.current = song;
    }
  }, []);

  const unmuteAndPlay = useCallback((startSecond?: number) => {
    if (!playerRef.current) return;
    const sec = startSecond ?? currentSong?.startSecond ?? 20;
    playerRef.current.seekTo(sec, true);
    playerRef.current.unMute();
    playerRef.current.setVolume(100);
    playerRef.current.playVideo();
    isCued.current = false;
    guardPlayback();
  }, [currentSong]);

  const pause = useCallback(() => {
    playerRef.current?.pauseVideo();
    releaseMediaSession();
  }, []);
  const stop = useCallback(() => {
    playerRef.current?.stopVideo();
    releaseMediaSession();
    updateState("idle");
  }, [updateState]);
  const seek = useCallback((sec: number) => playerRef.current?.seekTo(sec, true), []);

  useEffect(() => {
    const handleRemotePause = () => {
      try {
        playerRef.current?.pauseVideo();
      } catch {}
      releaseMediaSession();
    };
    window.addEventListener("tl:mediasession-pause", handleRemotePause);
    return () => {
      window.removeEventListener("tl:mediasession-pause", handleRemotePause);
    };
  }, []);

  return { play, cue, unmuteAndPlay, pause, stop, seek, state, currentSong, error };
}
