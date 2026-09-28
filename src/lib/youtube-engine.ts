"use client";

import { useEffect, useRef, useCallback, useState } from "react";

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
  onError?: (msg: string) => void;
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
          updateState("idle");
          onReady?.();
          // Load pending song if queued
          if (pendingSong.current) {
            const s = pendingSong.current;
            pendingSong.current = null;
            loadSong(s, isCued.current);
          }

          // Silence the Media Session so Android/desktop doesn't raise a
          // system notification showing the currently playing song (spoiler).
          try {
            if ("mediaSession" in navigator) {
              navigator.mediaSession.metadata = null;
              navigator.mediaSession.playbackState = "none";
            }
          } catch {
            // Media Session unsupported — fine
          }
        },
        onStateChange: (e: any) => {
          const YT = (window as any).YT.PlayerState;
          if (e.data === YT.PLAYING) updateState("playing");
          else if (e.data === YT.PAUSED) updateState("paused");
          else if (e.data === YT.CUED) updateState("cued");
          else if (e.data === YT.BUFFERING) updateState("loading");
          else if (e.data === YT.ENDED) updateState("idle");
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
          onError?.(msg);
        },
      },
    });
  }, [updateState, onReady, onError]);

  // Internal load helper
  const loadSong = useCallback((song: YTSong, muteOnly = false) => {
    if (!playerRef.current) return;
    setError(null);
    setCurrentSong(song);
    updateState("loading");

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
        setError(null);
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
    // The YouTube iframe lives on a cross-origin document, so it republishes its
    // own Media Session metadata (artist + title) every time a video starts.
    // Clearing it once at onReady is not enough — it gets re-set on each
    // loadVideoById, which is what surfaced the answer in Android's "Media
    // output" panel. Keep clearing it while the engine is alive.
    const clearMediaSession = () => {
      try {
        if (!("mediaSession" in navigator)) return;
        const ms = navigator.mediaSession;
        if (ms.metadata) ms.metadata = null;
        if (ms.playbackState !== "none") ms.playbackState = "none";
        // Dropping the artwork handler stops Android from rendering a cover in
        // the media panel, which was another leak of the current track.
        if (typeof ms.setActionHandler === "function") {
          for (const a of ["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack", "skipad", "stop"]) {
            try { ms.setActionHandler(a, null); } catch {}
          }
        }
      } catch {
        // Media Session unsupported — fine
      }
    };

    clearMediaSession();
    const id = setInterval(clearMediaSession, 700);

    return () => clearInterval(id);
  }, []);

  // ── Public API ─────────────────────────────────────────────────────────────
  const play = useCallback((song: YTSong) => {
    isCued.current = false;
    if (!playerRef.current) {
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
      } catch (e) {
        loadSong(song, false);
      }
      return;
    }
    loadSong(song, false);
  }, [currentSong, loadSong, updateState]);

  const cue = useCallback((song: YTSong) => {
    // Muted preload — use during lobby/result screen
    isCued.current = true;
    if (!playerRef.current) {
      pendingSong.current = song;
      return;
    }
    setCurrentSong(song);
    playerRef.current.mute();
    playerRef.current.loadVideoById({ videoId: song.youtubeId, startSeconds: 0 });
  }, []);

  const unmuteAndPlay = useCallback((startSecond?: number) => {
    if (!playerRef.current) return;
    const sec = startSecond ?? currentSong?.startSecond ?? 20;
    playerRef.current.seekTo(sec, true);
    playerRef.current.unMute();
    playerRef.current.setVolume(100);
    playerRef.current.playVideo();
    isCued.current = false;
  }, [currentSong]);

  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const stop = useCallback(() => { playerRef.current?.stopVideo(); updateState("idle"); }, [updateState]);
  const seek = useCallback((sec: number) => playerRef.current?.seekTo(sec, true), []);

  return { play, cue, unmuteAndPlay, pause, stop, seek, state, currentSong, error };
}
