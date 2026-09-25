"use client";

import React, { useState, useEffect, useRef } from "react";
import { Volume2, VolumeX, AudioWaveform, Loader2, Ear, Sparkles } from "lucide-react";
import { SoundBars } from "@/components/SoundBars";

interface TtsModePlayerProps {
  clues: string[];
  activeClueCount: number;
  initialVoiceType?: RobotVoiceType;
}

type RobotVoiceType = "normal" | "deep" | "fast";

export const TtsModePlayer: React.FC<TtsModePlayerProps> = ({
  clues,
  activeClueCount,
  initialVoiceType = "normal",
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [voiceType, setVoiceType] = useState<RobotVoiceType>(initialVoiceType);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Take the active couplets up to activeClueCount
  const currentLines = clues.slice(0, activeClueCount).join(". ");
  const cleanText = currentLines.replace(/['"“”]/g, "").trim();
  const speedParam = voiceType === "fast" ? "1.2" : voiceType === "deep" ? "0.8" : "1";
  const ttsAudioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&speed=${speedParam}`;

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, [activeClueCount, voiceType]);

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

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsPlaying(false);
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-sm relative">
      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-mutedDark uppercase tracking-wider">
          <Ear className="w-3.5 h-3.5 text-accent" />
          <span>Blind Audio · Uji Pendengaran</span>
        </div>

        {/* Minimalist Segmented Voice Controller */}
        <div className="flex items-center bg-surfaceRaised p-0.5 rounded-lg border border-surfaceBorder text-[11px] font-medium">
          {(
            [
              { id: "normal", label: "Datar" },
              { id: "deep", label: "Bass" },
              { id: "fast", label: "Cepat" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => {
                setVoiceType(v.id);
                if (isPlaying) handleStop();
              }}
              className={`px-2.5 py-1 rounded-md transition-all ${
                voiceType === v.id
                  ? "bg-zinc-700 text-white font-semibold shadow-sm"
                  : "text-muted hover:text-zinc-200"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tactile Play Button with Sound visualizer */}
      <div className="flex flex-col items-center gap-2.5 my-2">
        <button
          onClick={handlePlay}
          className={`w-16 h-16 rounded-full flex items-center justify-center text-zinc-950 transition-all transform active:scale-95 shadow-md ${
            isPlaying
              ? "bg-red-500 text-white ring-4 ring-red-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={isPlaying ? "Hentikan Suara" : "Dengarkan Lirik Robot"}
        >
          {isLoading ? (
            <Loader2 className="w-6 h-6 animate-spin text-zinc-600" />
          ) : isPlaying ? (
            <VolumeX className="w-6 h-6" />
          ) : (
            <Volume2 className="w-6 h-6 ml-0.5" />
          )}
        </button>

        <SoundBars isPlaying={isPlaying} color="bg-accent" />
      </div>

      {/* Pure Blind Listening Audio Deck (NO TEXT REVEALED!) */}
      <div className="w-full bg-surfaceRaised/60 border border-surfaceBorder rounded-xl p-4 flex flex-col items-center text-center gap-2.5">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="text-mutedDark">AUDIO CLUE:</span>
          <span className="text-zinc-200 font-semibold">
            Bait {activeClueCount} dari {clues.length} Terbuka
          </span>
        </div>

        <p className="text-xs sm:text-sm font-medium text-zinc-300">
          {isPlaying
            ? "🔊 Robot sedang membacakan lirik dengan nada kaku..."
            : "Tekan tombol di atas untuk mendengarkan pembacaan lirik."}
        </p>

        <p className="text-[11px] text-mutedDark max-w-xs leading-relaxed">
          Teks lirik sengaja disembunyikan. Tebak lagunya murni dari ucapan kata-kata robot tanpa melodi!
        </p>

        {activeClueCount < clues.length && (
          <div className="text-[11px] text-amber-400/90 flex items-center gap-1.5 pt-2 border-t border-surfaceBorder/40 w-full justify-center">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Salah tebak atau lewati untuk mendengar bait berikutnya.</span>
          </div>
        )}
      </div>

      {/* Guaranteed Audio Element (Server-Rendered MP3) */}
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
