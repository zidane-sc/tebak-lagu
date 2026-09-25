"use client";

import React, { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import {
  Check,
  ArrowRight,
  Share2,
  ExternalLink,
  Play,
  X,
  Disc,
} from "lucide-react";
import { Song } from "@/data/songs";

interface GameOverModalProps {
  isWon: boolean;
  song: Song;
  scoreGained: number;
  guessesCount: number;
  maxGuesses: number;
  guesses: Array<{ text: string; isCorrect: boolean }>;
  modeTitle: string;
  onNext: () => void;
  onExit: () => void;
  albumCover?: string;
  previewUrl?: string;
  isLastRound?: boolean;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  isWon,
  song,
  scoreGained,
  guessesCount,
  maxGuesses,
  guesses,
  modeTitle,
  onNext,
  onExit,
  albumCover,
  previewUrl,
  isLastRound = false,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isWon) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.65 },
        colors: ["#22c55e", "#fafafa", "#a1a1aa"],
      });
    }
  }, [isWon]);

  const handleShare = () => {
    const emojiBlocks = guesses
      .map((g) => (g.isCorrect ? "🟩" : "⬛"))
      .join("");
    const emptyBlocks = "⬜".repeat(Math.max(0, maxGuesses - guesses.length));
    const fullGrid = emojiBlocks + emptyBlocks;

    const shareText = `Tebak Lagu · ${modeTitle}\n${fullGrid} (${guessesCount}/${maxGuesses})\n${
      isWon ? `Score: +${scoreGained} pts` : "Jawaban Terungkap"
    }\nhttps://experiences-nevada-initial-breakdown.trycloudflare.com/`;

    navigator.clipboard.writeText(shareText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const ytSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${song.artist} ${song.title} official`
  )}`;
  const spotifySearchUrl = `https://open.spotify.com/search/${encodeURIComponent(
    `${song.artist} ${song.title}`
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 text-center shadow-2xl flex flex-col items-center gap-4 relative">
        {/* Status Badge */}
        <div className="flex flex-col items-center gap-1">
          <span
            className={`text-[11px] font-mono font-medium px-2.5 py-0.5 rounded-full border ${
              isWon
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                : "bg-zinc-800 text-zinc-400 border-zinc-700"
            }`}
          >
            {isWon ? `Tebakan Tepat · ${guessesCount} Percobaan` : "Ronde Selesai"}
          </span>

          <h2 className="text-xl font-bold tracking-tight text-white mt-1">
            {isWon ? `+${scoreGained} Poin Diperoleh` : "Jawaban Lagu"}
          </h2>
        </div>

        {/* Album Card (Minimalist Spotify Layout) */}
        <div className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-3.5 flex items-center gap-3.5 text-left">
          {albumCover ? (
            <img
              src={albumCover}
              alt={song.title}
              className="w-14 h-14 rounded-lg object-cover shadow-sm shrink-0"
            />
          ) : (
            <div className="w-14 h-14 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 shrink-0">
              <Disc className="w-6 h-6" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-white truncate">
              {song.title}
            </h3>
            <p className="text-xs text-muted truncate mt-0.5">{song.artist}</p>
            <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-mutedDark">
              <span>{song.year}</span>
              <span>·</span>
              <span className="truncate">{song.category}</span>
            </div>
          </div>
        </div>

        {/* Audio Sample Player */}
        {previewUrl && (
          <div className="w-full bg-surfaceRaised/50 rounded-lg p-2 border border-surfaceBorder">
            <audio controls src={previewUrl} className="w-full h-8" autoPlay />
          </div>
        )}

        {/* Full Streaming Links */}
        <div className="w-full grid grid-cols-2 gap-2 text-xs">
          <a
            href={ytSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 font-medium flex items-center justify-center gap-1.5 transition"
          >
            <span>YouTube</span>
            <ExternalLink className="w-3 h-3 text-mutedDark" />
          </a>

          <a
            href={spotifySearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="py-2 px-3 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 font-medium flex items-center justify-center gap-1.5 transition"
          >
            <span>Spotify</span>
            <ExternalLink className="w-3 h-3 text-mutedDark" />
          </a>
        </div>

        {/* Share Button (Wordle Grid) */}
        <button
          onClick={handleShare}
          className="w-full py-2 px-3 rounded-lg border border-surfaceBorder hover:border-zinc-600 bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white text-xs font-mono font-medium flex items-center justify-center gap-2 transition"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-accent" />
              <span className="text-accent">Tersalin ke Clipboard!</span>
            </>
          ) : (
            <>
              <Share2 className="w-3.5 h-3.5 text-mutedDark" />
              <span>Salin Skor (Grid Emoji)</span>
            </>
          )}
        </button>

        {/* Primary Action Button */}
        <div className="w-full flex gap-2 pt-1">
          <button
            onClick={onNext}
            className="flex-1 bg-zinc-100 hover:bg-white text-zinc-950 font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-1.5 shadow transition transform active:scale-95 text-xs sm:text-sm"
          >
            <span>{isLastRound ? "Selesai & Lihat Skor" : "Lagu Berikutnya"}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onExit}
            className="py-2.5 px-3.5 rounded-xl bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white text-xs font-medium border border-surfaceBorder transition"
          >
            Menu
          </button>
        </div>
      </div>
    </div>
  );
};
