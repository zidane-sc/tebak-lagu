"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, Flame, Trophy } from "lucide-react";

interface ScoreHeaderProps {
  title: string;
  icon?: string;
  streak: number;
  score: number;
}

export const ScoreHeader: React.FC<ScoreHeaderProps> = ({
  title,
  streak,
  score,
}) => {
  return (
    <header className="w-full max-w-2xl mx-auto px-4 py-3.5 flex items-center justify-between border-b border-surfaceBorder select-none">
      {/* Back Button */}
      <Link
        href="/"
        className="flex items-center gap-1.5 text-xs font-medium text-muted hover:text-white transition py-1.5 px-2.5 -ml-2 rounded-lg hover:bg-surfaceRaised active:scale-95"
      >
        <ChevronLeft className="w-4 h-4" />
        <span>Lobi</span>
      </Link>

      {/* Mode Title */}
      <div className="flex items-center gap-2">
        <h1 className="text-xs sm:text-sm font-semibold text-zinc-200 tracking-tight">
          {title}
        </h1>
      </div>

      {/* Stats Monospace Counter */}
      <div className="flex items-center gap-2 font-mono text-xs">
        <div
          className="flex items-center gap-1 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-md text-amber-400 font-semibold"
          title="Winning Streak"
        >
          <Flame className="w-3.5 h-3.5 fill-amber-400" />
          <span>{streak}</span>
        </div>

        <div
          className="flex items-center gap-1 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-md text-zinc-200 font-semibold"
          title="Total Score"
        >
          <Trophy className="w-3.5 h-3.5 text-zinc-400" />
          <span>{score}</span>
        </div>
      </div>
    </header>
  );
};
