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
      // Brief wait for player to start, then unmute
      setTimeout(() => {
        if (playerRef.current) {
          playerRef.current.seekTo(song.startSecond ?? 20, true);
          playerRef.current.unMute();
          playerRef.current.setVolume(100);
        }
      }, 800);
    }
  }, [updateState]);

  // Mount container div (completely hidden offscreen so no YouTube logo/box appears)
  useEffect(() => {
    if (!containerRef.current) {
      let div = document.getElementById("yt-engine-player") as HTMLDivElement | null;
      if (!div) {
        div = document.createElement("div");
        div.id = "yt-engine-player";
        div.style.cssText = `
          position: fixed;
          top: -9999px;
          left: -9999px;
          width: 200px;
          height: 200px;
          opacity: 0;
          pointer-events: none;
          z-index: -999;
          visibility: hidden;
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
