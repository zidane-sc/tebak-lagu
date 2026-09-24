"use client";

import React, { useState, useRef, useEffect } from "react";
import { Music, Play, Square, Loader2 } from "lucide-react";
import { SoundBars } from "@/components/SoundBars";

interface InstrumentalModePlayerProps {
  previewUrl?: string;
  searchQuery: string;
}

export const InstrumentalModePlayer: React.FC<InstrumentalModePlayerProps> = ({
  previewUrl: initialPreview,
  searchQuery,
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialPreview || null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  const togglePlay = () => {
    if (!audioRef.current || !previewUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.currentTime = 0;
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-sm relative">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-mutedDark uppercase tracking-wider">
          <Music className="w-3.5 h-3.5 text-accent" />
          <span>Minus-One Instrumental</span>
        </div>
      </div>

      {/* Main Play Button */}
      <div className="flex flex-col items-center gap-2.5 my-2">
        <button
          onClick={togglePlay}
          disabled={isLoading || !previewUrl}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-md disabled:opacity-40 ${
            isPlaying
              ? "bg-red-500 text-white ring-4 ring-red-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={isPlaying ? "Hentikan Musik" : "Putar Musik"}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          ) : isPlaying ? (
            <Square className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        <SoundBars isPlaying={isPlaying} color="bg-accent" />
      </div>

      {/* Instruction Card */}
      <div className="w-full bg-surfaceRaised/60 border border-surfaceBorder rounded-xl p-4 text-center">
        <p className="text-xs text-zinc-300 font-medium">
          Dengarkan aransemen instrumen musik asli.
        </p>
        <p className="text-[11px] text-mutedDark mt-1">
          Ketik judul lagu atau artis pada kolom tebakan di bawah.
        </p>
      </div>

      {previewUrl && (
        <audio
          ref={audioRef}
          src={previewUrl}
          onEnded={handleEnded}
          preload="auto"
        />
      )}
    </div>
  );
};
