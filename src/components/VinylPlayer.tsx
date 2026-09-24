"use client";

import React from "react";
import { Disc, Music } from "lucide-react";
import { SoundBars } from "./SoundBars";

interface VinylPlayerProps {
  isPlaying: boolean;
  coverUrl?: string;
  label?: string;
  size?: "sm" | "md" | "lg";
}

export const VinylPlayer: React.FC<VinylPlayerProps> = ({
  isPlaying,
  coverUrl,
  label = "Audio Deck",
  size = "md",
}) => {
  const sizeClasses = {
    sm: "w-24 h-24",
    md: "w-36 h-36",
    lg: "w-48 h-48",
  }[size];

  const labelSizeClasses = {
    sm: "w-8 h-8 text-[9px]",
    md: "w-12 h-12 text-xs",
    lg: "w-16 h-16 text-sm",
  }[size];

  return (
    <div className="relative flex flex-col items-center justify-center select-none py-2">
      {/* Vinyl Shadow & Aura */}
      <div
        className={`absolute rounded-full transition-all duration-700 pointer-events-none ${
          isPlaying
            ? "w-44 h-44 bg-accent/15 blur-xl scale-110"
            : "w-36 h-36 bg-black/40 blur-md scale-95"
        }`}
      />

      {/* The Vinyl Disc */}
      <div
        className={`relative ${sizeClasses} rounded-full bg-zinc-950 border-4 border-zinc-900 shadow-2xl flex items-center justify-center overflow-hidden transition-transform duration-500 ${
          isPlaying
            ? "animate-spin [animation-duration:3.5s] ring-2 ring-accent/30"
            : "ring-1 ring-zinc-800"
        }`}
        style={{
          backgroundImage: `
            radial-gradient(circle, transparent 35%, rgba(255,255,255,0.03) 36%, transparent 37%),
            radial-gradient(circle, transparent 50%, rgba(255,255,255,0.03) 51%, transparent 52%),
            radial-gradient(circle, transparent 65%, rgba(255,255,255,0.03) 66%, transparent 67%),
            radial-gradient(circle, transparent 80%, rgba(255,255,255,0.03) 81%, transparent 82%)
          `,
        }}
      >
        {/* Center Label Hole & Artwork */}
        <div
          className={`${labelSizeClasses} rounded-full bg-gradient-to-tr from-accent/80 to-emerald-400 p-1 flex items-center justify-center text-zinc-950 shadow-inner relative z-10 overflow-hidden`}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt="Vinyl Label"
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-accent">
              <Music className="w-3.5 h-3.5" />
            </div>
          )}

          {/* Center spindle spindle pin */}
          <div className="absolute w-2 h-2 rounded-full bg-zinc-950 border border-zinc-700 z-20" />
        </div>
      </div>

      {/* Floating Status Equalizer Tag */}
      <div className="mt-3 flex items-center gap-2 bg-surfaceRaised/90 border border-surfaceBorder px-3 py-1 rounded-full text-[11px] font-mono shadow-sm">
        <SoundBars isPlaying={isPlaying} color="bg-accent" />
        <span className={isPlaying ? "text-zinc-200 font-semibold" : "text-mutedDark"}>
          {isPlaying ? label : "Audio Siap"}
        </span>
      </div>
    </div>
  );
};
