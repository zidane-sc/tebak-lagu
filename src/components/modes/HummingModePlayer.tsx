"use client";

import React, { useState, useEffect, useRef } from "react";
import { Mic, Square, Play, RotateCcw } from "lucide-react";
import { HummingSynth, SynthTimbre } from "@/lib/audio-synth";
import { SoundBars } from "@/components/SoundBars";

interface HummingModePlayerProps {
  melody: Array<{ note: number; duration: number }>;
}

export const HummingModePlayer: React.FC<HummingModePlayerProps> = ({
  melody,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [timbre, setTimbre] = useState<SynthTimbre>("humming");
  const synthRef = useRef<HummingSynth | null>(null);

  useEffect(() => {
    synthRef.current = new HummingSynth();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  const handlePlay = () => {
    if (!synthRef.current) return;
    synthRef.current.timbre = timbre;
    setIsPlaying(true);
    setCurrentNoteIndex(0);

    synthRef.current.playMelody(
      melody,
      (idx) => setCurrentNoteIndex(idx),
      () => {
        setIsPlaying(false);
        setCurrentNoteIndex(-1);
      }
    );
  };

  const handleStop = () => {
    synthRef.current?.stop();
    setIsPlaying(false);
    setCurrentNoteIndex(-1);
  };

  const changeTimbre = (t: SynthTimbre) => {
    setTimbre(t);
    if (synthRef.current) {
      synthRef.current.timbre = t;
    }
    if (isPlaying) {
      handleStop();
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col items-center gap-4 bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-sm relative">
      {/* Top Header Row */}
      <div className="w-full flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-mutedDark uppercase tracking-wider">
          <Mic className="w-3.5 h-3.5 text-accent" />
          <span>Vocal Synthesizer</span>
        </div>

        {/* Timbre Selector */}
        <div className="flex items-center bg-surfaceRaised p-0.5 rounded-lg border border-surfaceBorder text-[11px] font-medium">
          {(
            [
              { id: "humming", label: "Hum" },
              { id: "flute", label: "Flute" },
              { id: "chiptune", label: "8-Bit" },
              { id: "synth", label: "Saw" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => changeTimbre(item.id)}
              className={`px-2 py-1 rounded-md transition-all ${
                timbre === item.id
                  ? "bg-zinc-700 text-white font-semibold shadow-sm"
                  : "text-muted hover:text-zinc-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Play Action */}
      <div className="flex flex-col items-center gap-2.5 my-2">
        <button
          onClick={isPlaying ? handleStop : handlePlay}
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-md ${
            isPlaying
              ? "bg-red-500 text-white ring-4 ring-red-500/20"
              : "bg-zinc-100 hover:bg-white text-zinc-950"
          }`}
          title={isPlaying ? "Hentikan Melodi" : "Dengarkan Melodi"}
        >
          {isPlaying ? (
            <Square className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-6 h-6 fill-current ml-0.5" />
          )}
        </button>

        <SoundBars isPlaying={isPlaying} color="bg-accent" />
      </div>

      {/* LED Step Sequencer Track */}
      <div className="w-full bg-surfaceRaised/60 border border-surfaceBorder rounded-xl p-4 flex flex-col items-center gap-3">
        <p className="text-xs text-muted">
          {isPlaying
            ? "Memainkan notasi melodi vokal..."
            : "Tekan tombol putar untuk mendengarkan alunan nada."}
        </p>

        {/* Note Step Indicator */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-full py-1">
          {melody.map((_, idx) => (
            <div
              key={idx}
              className={`w-3 h-3 rounded-full transition-all duration-150 ${
                idx === currentNoteIndex
                  ? "bg-accent scale-125 shadow-sm shadow-accent/50"
                  : idx < currentNoteIndex
                  ? "bg-zinc-600"
                  : "bg-zinc-800"
              }`}
            />
          ))}
        </div>

        <button
          onClick={handlePlay}
          disabled={isPlaying}
          className="text-[11px] text-muted hover:text-white flex items-center gap-1 font-medium transition"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Putar Ulang</span>
        </button>
      </div>
    </div>
  );
};
