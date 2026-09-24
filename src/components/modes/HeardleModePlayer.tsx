"use client";

import React, { useState, useRef, useEffect } from "react";
import { Timer, Play, Square, Loader2, Shuffle } from "lucide-react";
import { SoundBars } from "@/components/SoundBars";
import { VinylPlayer } from "@/components/VinylPlayer";
import { sfx } from "@/lib/sound-fx";

interface HeardleModePlayerProps {
  previewUrl?: string;
  searchQuery: string;
  startSecond?: number;
  unlockedLevel: number; // 0 to 5
}

// Stepped unlocked durations in seconds
const DURATIONS = [0.5, 1.5, 3.0, 6.0, 10.0, 15.0];

export const HeardleModePlayer: React.FC<HeardleModePlayerProps> = ({
  previewUrl: initialPreview,
  searchQuery,
  startSecond,
  unlockedLevel,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreview || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [randomOffset, setRandomOffset] = useState<number>(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const maxAllowedDuration = DURATIONS[Math.min(unlockedLevel, DURATIONS.length - 1)];

  // Pick a random snippet timestamp whenever a new song loads
  useEffect(() => {
    const offset =
      startSecond !== undefined
        ? Math.min(12, startSecond % 14)
        : Math.floor(Math.random() * 10);
    setRandomOffset(offset);
  }, [searchQuery, startSecond]);

  // Fetch Deezer preview if needed
  useEffect(() => {
    if (!initialPreview && searchQuery) {
      setIsLoading(true);
      fetch(`/api/preview?q=${encodeURIComponent(searchQuery)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.previewUrl) setPreviewUrl(data.previewUrl);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    } else if (initialPreview) {
      setPreviewUrl(initialPreview);
    }
  }, [initialPreview, searchQuery]);

  const stopPlayback = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setIsPlaying(false);
  };

  const handlePlay = () => {
    if (isPlaying) {
      stopPlayback();
      return;
    }

    if (!audioRef.current || !previewUrl) {
      return;
    }

    setIsPlaying(true);
    audioRef.current.currentTime = randomOffset;

    audioRef.current
      .play()
      .then(() => {
        timerRef.current = setTimeout(() => {
          stopPlayback();
        }, maxAllowedDuration * 1000);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-5 bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-sm relative">
      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-mutedDark uppercase tracking-wider">
          <Timer className="w-3.5 h-3.5 text-accent" />
          <span>Time Slice Engine</span>
        </div>

        <div className="flex items-center gap-1 bg-surfaceRaised px-2 py-0.5 rounded text-[11px] font-mono text-muted border border-surfaceBorder">
          <Shuffle className="w-3 h-3 text-mutedDark" />
          <span>Detik Acak</span>
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
          disabled={isLoading || !previewUrl}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all transform active:scale-95 shadow-md cursor-pointer ${
            isPlaying
              ? "bg-red-500 hover:bg-red-600 text-white ring-4 ring-red-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={isPlaying ? "Hentikan" : `Putar ${maxAllowedDuration}s`}
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-zinc-600" />
          ) : isPlaying ? (
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
      </div>

      {/* Hardware-Style Segmented Timeline Bar */}
      <div className="w-full bg-surfaceRaised/60 border border-surfaceBorder rounded-xl p-4 flex flex-col gap-2.5">
        <div className="flex justify-between items-center text-xs font-mono">
          <span className="text-mutedDark">DURASI TERBUKA</span>
          <span className="text-zinc-100 font-semibold">
            {maxAllowedDuration}s <span className="text-mutedDark">/ 15.0s</span>
          </span>
        </div>

        {/* 6 Segment Progress Blocks (Precision Track) */}
        <div className="grid grid-cols-6 gap-1.5 h-2.5">
          {DURATIONS.map((dur, index) => {
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
          Cuplikan dipotong di detik acak. Salah tebak membuka durasi lebih panjang.
        </p>
      </div>

      {/* Hidden native audio element */}
      {previewUrl && <audio ref={audioRef} src={previewUrl} preload="auto" />}
    </div>
  );
};
