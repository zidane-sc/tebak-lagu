"use client";

import React from "react";

interface SoundBarsProps {
  isPlaying: boolean;
  color?: string;
}

export const SoundBars: React.FC<SoundBarsProps> = ({
  isPlaying,
  color = "bg-accent",
}) => {
  return (
    <div className="flex items-end justify-center gap-1 h-6 w-12 py-0.5">
      <span
        className={`w-1 rounded-full transition-all duration-300 ${
          isPlaying ? `${color} animate-eq-1` : "h-1 bg-zinc-700"
        }`}
      />
      <span
        className={`w-1 rounded-full transition-all duration-300 ${
          isPlaying ? `${color} animate-eq-2` : "h-1.5 bg-zinc-700"
        }`}
      />
      <span
        className={`w-1 rounded-full transition-all duration-300 ${
          isPlaying ? `${color} animate-eq-3` : "h-2 bg-zinc-700"
        }`}
      />
      <span
        className={`w-1 rounded-full transition-all duration-300 ${
          isPlaying ? `${color} animate-eq-4` : "h-1.5 bg-zinc-700"
        }`}
      />
      <span
        className={`w-1 rounded-full transition-all duration-300 ${
          isPlaying ? `${color} animate-eq-5` : "h-1 bg-zinc-700"
        }`}
      />
    </div>
  );
};
