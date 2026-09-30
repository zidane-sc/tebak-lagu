"use client";

import React, { useState, useRef, useEffect } from "react";
import { Timer, Play, Square, Loader2 } from "lucide-react";
import { VinylPlayer } from "@/components/VinylPlayer";
import { AudioWaveformVisualizer } from "@/components/AudioWaveformVisualizer";

interface HeardleModePlayerProps {
  searchQuery: string;
  unlockedLevel: number; // 0 to durations.length - 1
  isGameOver?: boolean;
  customDurations?: number[];
  // YouTube engine props
  youtubeId?: string | null;
  youtubeStatus?: string;
  youtubeStartSecond?: number;
  onYoutubePlay?: (startSecond: number) => void;
  onYoutubePause?: () => void;
  ytEngineState?: string;
}

// Stepped unlocked durations in seconds (Fair, exciting progression starting at 3s)
const DEFAULT_DURATIONS = [3.0, 5.0, 9.0, 15.0, 22.0, 30.0];

/**
 * Time Slice plays through YouTube only.
 *
 * The Apple/Deezer 30s preview used to be the fallback whenever a track had no
 * YouTube id. It was a different game with the same label: a preview is 30
 * seconds no matter how long the tier asks for, so the 22s and 30s tiers ran
 * past the end of the clip and the last tier ended in silence. There is also no
 * way to pick a start offset on a preview, so the same song behaved differently
 * depending on which source won. The server no longer selects songs without a
 * YouTube id for this mode.
 */
export const HeardleModePlayer: React.FC<HeardleModePlayerProps> = ({
  searchQuery,
  unlockedLevel,
  isGameOver = false,
  customDurations,
  youtubeId,
  youtubeStatus,
  youtubeStartSecond,
  onYoutubePlay,
  onYoutubePause,
  ytEngineState,
}) => {
  const canPlay = !!(youtubeId && youtubeStatus === "ready" && onYoutubePlay);
  const [isPlaying, setIsPlaying] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const durations =
    Array.isArray(customDurations) && customDurations.length > 0
      ? customDurations
      : DEFAULT_DURATIONS;
  const maxAllowedDuration = durations[Math.min(unlockedLevel, durations.length - 1)];
  const maxDuration = durations[durations.length - 1];

  const stopPlayback = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (isPlaying) onYoutubePause?.();
    setIsPlaying(false);
  };

  // Stop when the game-over modal opens, when a tier is unlocked, and on unmount.
  useEffect(() => {
    if (isGameOver) stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGameOver]);

  useEffect(() => {
    stopPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlockedLevel, searchQuery]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      onYoutubePause?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }
    if (!canPlay) return;

    setIsPlaying(true);
    onYoutubePlay!(youtubeStartSecond ?? 0);
    timerRef.current = setTimeout(() => {
      onYoutubePause?.();
      setIsPlaying(false);
    }, maxAllowedDuration * 1000);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-5 bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-sm relative">
      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-mutedDark uppercase tracking-wider">
          <Timer className="w-3.5 h-3.5 text-accent" />
          <span>Time Slice Engine</span>
        </div>
      </div>

      {/* Main Play Deck with Vinyl */}
      <div className="flex flex-col items-center gap-3 my-1">
        <VinylPlayer
          isPlaying={isPlaying}
          label={`${maxAllowedDuration}s Track`}
          size="md"
        />

        <button
          onClick={handlePlay}
          disabled={!canPlay}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all transform active:scale-95 shadow-md ${
            canPlay ? "cursor-pointer" : "cursor-not-allowed opacity-50"
          } ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={
            !canPlay
              ? "Video belum siap — lagu ini tidak bisa dimuat"
              : isPlaying
              ? "Hentikan"
              : `Putar ${maxAllowedDuration}s`
          }
        >
          {isPlaying ? (
            <>
              <Square className="w-4 h-4 fill-current" />
              <span>Hentikan Audio</span>
            </>
          ) : (
            <>
              <Play className="w-4 h-4 fill-current" />
              <span>Putar Cuplikan ({maxAllowedDuration}s)</span>
            </>
          )}
        </button>

        <AudioWaveformVisualizer isPlaying={isPlaying} variant="emerald" barCount={26} height={32} />

        {ytEngineState === "unavailable" && (
          <p className="text-[11px] text-rose-400 font-mono text-center">
            Audio tidak bisa dimuat — video ini tidak tersedia.
          </p>
        )}
        {!canPlay && ytEngineState !== "unavailable" && (
          <p className="text-[11px] text-mutedDark font-mono text-center">
            Video untuk lagu ini belum siap. advancing ke lagu lain.
          </p>
        )}
      </div>

      {/* Hardware-Style Segmented Timeline Bar */}
      <div className="w-full bg-surfaceRaised/60 border border-surfaceBorder rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-mutedDark">DURASI TERBUKA</span>
          <span className="text-zinc-100 font-semibold">
            {maxAllowedDuration}s <span className="text-mutedDark">/ {maxDuration}s</span>
          </span>
        </div>

        <div
          className="grid gap-1.5 h-2.5"
          style={{ gridTemplateColumns: `repeat(${durations.length}, minmax(0, 1fr))` }}
        >
          {durations.map((dur, index) => {
            const isUnlocked = index <= unlockedLevel;
            return (
              <div
                key={index}
                className={`h-full rounded-sm transition-all duration-300 ${
                  isUnlocked ? "bg-accent" : "bg-zinc-800"
                }`}
                title={`Level ${index + 1}: ${dur}s`}
              />
            );
          })}
        </div>

        <p className="text-[11px] text-mutedDark text-center mt-0.5">
          Cuplikan selalu mulai dari vokal. Salah tebak membuka durasi lebih panjang.
        </p>
      </div>
    </div>
  );
};
