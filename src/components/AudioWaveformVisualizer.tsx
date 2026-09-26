"use client";

import React, { useEffect, useState } from "react";

interface AudioWaveformVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
  className?: string;
  variant?: "emerald" | "amber" | "cyberpunk";
}

export const AudioWaveformVisualizer: React.FC<AudioWaveformVisualizerProps> = ({
  isPlaying,
  barCount = 28,
  height = 42,
  className = "",
  variant = "emerald",
}) => {
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: barCount }, () => 15)
  );

  useEffect(() => {
    if (!isPlaying) {
      // Idle resting heights
      setHeights(Array.from({ length: barCount }, () => 12));
      return;
    }

    // Dynamic wave animation loop
    const interval = setInterval(() => {
      setHeights(
        Array.from({ length: barCount }, (_, i) => {
          // Combination of sine wave and pseudo-random dynamic pulse
          const t = Date.now() / 180;
          const sine = Math.sin(t + i * 0.45) * 0.4 + 0.5; // 0.1 to 0.9
          const rand = Math.random() * 0.35;
          const pct = Math.min(100, Math.max(15, (sine + rand) * 100));
          return Math.round(pct);
        })
      );
    }, 85);

    return () => clearInterval(interval);
  }, [isPlaying, barCount]);

  const getBarColor = (index: number) => {
    if (variant === "amber") {
      return index % 3 === 0 ? "bg-amber-400" : "bg-amber-500/80";
    }
    if (variant === "cyberpunk") {
      return index % 4 === 0
        ? "bg-purple-400"
        : index % 4 === 1
        ? "bg-sky-400"
        : index % 4 === 2
        ? "bg-accent"
        : "bg-emerald-400";
    }
    // Emerald default
    return index % 5 === 0
      ? "bg-emerald-300"
      : index % 2 === 0
      ? "bg-accent"
      : "bg-green-500/80";
  };

  return (
    <div
      className={`flex items-end justify-center gap-1 overflow-hidden py-1 ${className}`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      {heights.map((h, idx) => (
        <div
          key={idx}
          className={`w-1 sm:w-1.5 rounded-full transition-all duration-100 ${getBarColor(
            idx
          )} ${isPlaying ? "shadow-sm shadow-accent/20" : "opacity-30"}`}
          style={{
            height: `${isPlaying ? h : 15}%`,
            minHeight: "4px",
          }}
        />
      ))}
    </div>
  );
};
