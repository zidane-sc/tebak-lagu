"use client";

import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";

interface TtsModePlayerProps {
  clues?: string[];
  activeClueCount: number;
  initialVoiceType?: RobotVoiceType;
  lang?: "id" | "en";
  isGameOver?: boolean;
}

type RobotVoiceType = "normal" | "deep" | "fast";

export const TtsModePlayer: React.FC<TtsModePlayerProps> = ({
  clues = [],
  activeClueCount,
  initialVoiceType = "normal",
  lang = "id",
  isGameOver = false,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceType] = useState<RobotVoiceType>(initialVoiceType);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isGameOver && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [isGameOver]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeClueCount, voiceType]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const safeClues =
    clues && clues.length > 0
      ? clues
      : [
          "Dengarkan pembacaan lirik lagu ini dengan seksama",
          "Tebak judul lagu dan nama penyanyinya sekarang",
        ];

  const currentLines = safeClues.slice(0, Math.max(1, activeClueCount)).join(". ");
  const cleanText = currentLines.replace(/['"“”]/g, "").trim() || "Dengarkan lirik lagu ini";
  const speedParam = voiceType === "fast" ? "1.25" : voiceType === "deep" ? "0.8" : "1";
  const ttsAudioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&speed=${speedParam}&lang=${lang}`;

  const handlePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    setIsLoading(true);
    audioRef.current.currentTime = 0;

    if (voiceType === "deep") {
      audioRef.current.playbackRate = 0.85;
    } else if (voiceType === "fast") {
      audioRef.current.playbackRate = 1.25;
    } else {
      audioRef.current.playbackRate = 1.0;
    }

    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Audio playback error:", err);
        setIsLoading(false);
        setIsPlaying(false);
      });
  };

  return (
    <div className="w-full max-w-md mx-auto flex flex-col items-center gap-2.5 bg-surface border border-surfaceBorder rounded-2xl p-3.5 sm:p-4 shadow-sm relative">
      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between text-xs">
        <span className="text-[10px] font-mono text-mutedDark font-bold uppercase tracking-wider">
          BAIT LIRIK ROBOT
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-semibold">
          Bait {Math.min(activeClueCount, safeClues.length)} dari {safeClues.length}
        </span>
      </div>

      {/* Tactile Play Button Row */}
      <div className="flex items-center justify-center gap-4 py-1">
        <button
          onClick={handlePlay}
          className={`w-12 h-12 rounded-full flex items-center justify-center text-zinc-950 transition-all transform active:scale-95 shadow-md ${
            isPlaying
              ? "bg-rose-500 text-white ring-4 ring-rose-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={isPlaying ? "Hentikan Suara" : "Dengarkan Lirik Robot"}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
          ) : isPlaying ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5 ml-0.5" />
          )}
        </button>

        <div className="flex flex-col">
          <span className="text-xs font-bold text-white">
            {isPlaying ? "Sedang Membacakan..." : "Putar Lirik Robot"}
          </span>
          <span className="text-[10px] font-mono text-muted">
            Suara: {voiceType === "fast" ? "Cepat ⚡" : voiceType === "deep" ? "Bass 🔊" : "Datar 🤖"}
          </span>
        </div>
      </div>

      {/* Audio element */}
      <audio
        ref={audioRef}
        src={ttsAudioUrl}
        preload="auto"
        onEnded={() => setIsPlaying(false)}
        onError={() => {
          setIsLoading(false);
          setIsPlaying(false);
        }}
      />
    </div>
  );
};
