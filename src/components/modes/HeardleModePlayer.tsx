"use client";

import React, { useState, useRef, useEffect } from "react";
import { Play, Square } from "lucide-react";
import { VinylPlayer } from "@/components/VinylPlayer";

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

const DEFAULT_DURATIONS = [3.0, 5.0, 9.0, 15.0, 22.0, 30.0];

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
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2.5 bg-surface border border-surfaceBorder rounded-2xl p-3.5 sm:p-4 shadow-sm relative">
      {/* Vinyl & Play Control Row */}
      <div className="flex items-center justify-center gap-4 py-1">
        <VinylPlayer
          isPlaying={isPlaying}
          label={`${maxAllowedDuration}s`}
          size="sm"
          hideTag
        />

        <div className="flex flex-col items-start gap-1.5">
          <button
            onClick={handlePlay}
            disabled={!canPlay}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all transform active:scale-95 shadow-md ${
              canPlay ? "cursor-pointer" : "cursor-not-allowed opacity-50"
            } ${
              isPlaying
                ? "bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-500/20"
                : "bg-zinc-100 hover:bg-white text-zinc-950"
            }`}
            title={isPlaying ? "Hentikan" : `Putar ${maxAllowedDuration}s`}
          >
            {isPlaying ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Stop Audio</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Putar ({maxAllowedDuration}s)</span>
              </>
            )}
          </button>

          <span className="text-[10px] font-mono text-muted">
            {isPlaying ? "▶ Sedang berputar..." : `Mulai ${youtubeStartSecond ?? 0}s`}
          </span>
        </div>
      </div>

      {ytEngineState === "unavailable" && (
        <p className="text-[10px] text-rose-400 font-mono text-center">
          Audio tidak bisa dimuat — video tidak tersedia.
        </p>
      )}

      {/* Segmented Timeline Bar */}
      <div className="w-full bg-surfaceRaised/80 border border-surfaceBorder rounded-xl px-3 py-2 flex flex-col gap-1.5">
        <div className="flex justify-between items-center text-[11px] font-mono">
          <span className="text-mutedDark">DURASI</span>
          <span className="text-zinc-200 font-bold">
            {maxAllowedDuration}s <span className="text-mutedDark">/ {maxDuration}s</span>
          </span>
        </div>

        <div
          className="grid gap-1 h-2"
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
      </div>
    </div>
  );
};
