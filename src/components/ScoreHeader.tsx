"use client";

import React from "react";
import Link from "next/link";
import { ChevronLeft, Trophy } from "lucide-react";

interface ScoreHeaderProps {
  title: string;
  icon?: string;
  score: number;
  roundInfo?: string;
}

export const ScoreHeader: React.FC<ScoreHeaderProps> = ({
  title,
  score,
  roundInfo,
}) => {
  return (
    <header className="w-full max-w-md mx-auto px-4 py-2 flex items-center justify-between border-b border-surfaceBorder/80 select-none shrink-0">
      {/* Back Button */}
      <Link
        href="/"
        className="flex items-center gap-1 text-xs font-medium text-muted hover:text-white transition py-1 px-2 -ml-1 rounded-lg hover:bg-surfaceRaised active:scale-95"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        <span>Menu</span>
      </Link>

      {/* Mode Title & Round Info */}
      <div className="flex items-center gap-2">
        <h1 className="text-xs sm:text-sm font-bold text-zinc-100 tracking-tight">
          {title}
        </h1>
        {roundInfo && (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/10 border border-accent/25 text-accent font-bold">
            {roundInfo}
          </span>
        )}
      </div>

      {/* Stats Monospace Counter */}
      <div className="flex items-center gap-1.5 font-mono text-xs bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-full text-zinc-200 font-bold">
        <Trophy className="w-3 h-3 text-accent" />
        <span>{score}</span>
      </div>
    </header>
  );
};
