"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ScoreHeader } from "@/components/ScoreHeader";
import { GuessInput } from "@/components/GuessInput";
import { GameOverModal } from "@/components/GameOverModal";
import { TtsModePlayer } from "@/components/modes/TtsModePlayer";
import { HeardleModePlayer } from "@/components/modes/HeardleModePlayer";
import { Song } from "@/data/songs";
import { sfx } from "@/lib/sound-fx";
import { Loader2, Trophy, RotateCcw, Home, Sparkles, CheckCircle2, XCircle } from "lucide-react";
import confetti from "canvas-confetti";

const MODE_CONFIG: Record<
  string,
  { title: string; icon: string; maxGuesses: number }
> = {
  tts: {
    title: "Robot Speech (TTS)",
    icon: "🤖",
    maxGuesses: 5,
  },
  heardle: {
    title: "Time Slice (Heardle)",
    icon: "⏱️",
    maxGuesses: 6,
  },
};

export default function PlayArenaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const modeKey = (params?.mode as string) || "heardle";
  const config = MODE_CONFIG[modeKey] || MODE_CONFIG.heardle;

  // Single player config from sessionStorage (clean URL without query params)
  const [gameConfig, setGameConfig] = useState({
    category: "Semua Genre",
    difficulty: "easy",
    audioProfile: "normal",
    maxRounds: 5,
  });

  const [song, setSong] = useState<Song | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [albumCover, setAlbumCover] = useState<string | undefined>(undefined);

  // Gameplay States
  const [guesses, setGuesses] = useState<Array<{ text: string; isCorrect: boolean }>>([]);
  const [activeClueCount, setActiveClueCount] = useState(1);
  const [unlockedHeardleLevel, setUnlockedHeardleLevel] = useState(0);

  // Score & Round Stats
  const [score, setScore] = useState(0);
  const [scoreGained, setScoreGained] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);

  // Round Over State & Match Completed State
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);
  const [isMatchFinished, setIsMatchFinished] = useState(false);

  // Load Config from sessionStorage or fallback to URL query
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tebak_lagu_single_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        setGameConfig({
          category: parsed.category || "Semua Genre",
          difficulty: parsed.difficulty || "easy",
          audioProfile: parsed.audioProfile || "normal",
          maxRounds: parsed.maxRounds || 5,
        });
      } else {
        setGameConfig({
          category: searchParams.get("category") || "Semua Genre",
          difficulty: searchParams.get("difficulty") || "easy",
          audioProfile: searchParams.get("audioProfile") || "normal",
          maxRounds: parseInt(searchParams.get("rounds") || "5", 10),
        });
      }
    } catch {}
  }, [searchParams]);

  // Load Saved Lifetime Score
  useEffect(() => {
    try {
      setScore(parseInt(localStorage.getItem("tebak_lagu_score") || "0", 10));
    } catch {}
  }, []);

  // Fetch song from server database (with guaranteed LRCLIB lyrics & Apple preview)
  const loadNewSong = useCallback(() => {
    setIsLoading(true);
    setIsGameOver(false);
    setIsWon(false);
    setGuesses([]);
    setActiveClueCount(1);
    setUnlockedHeardleLevel(0);
    setScoreGained(0);

    const q = new URLSearchParams({
      mode: modeKey,
      category: gameConfig.category,
      difficulty: gameConfig.difficulty,
    });

    fetch(`/api/songs/random?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.song) {
          const s = data.song;
          setSong(s);
          setPreviewUrl(s.previewResolved || s.previewUrl);
          setAlbumCover(s.albumCover);
        }
      })
      .catch((err) => {
        console.error("Failed to load song from API:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [modeKey, gameConfig.category, gameConfig.difficulty]);

  useEffect(() => {
    loadNewSong();
  }, [loadNewSong]);

  // Clean String for fuzzy matching
  const cleanStr = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  // Handle Player Guess
  const handleGuess = (guessedTitle: string, guessedArtist: string) => {
    if (!song || isGameOver) return;

    const targetTitle = cleanStr(song.title);
    const targetArtist = cleanStr(song.artist);
    const inputTitle = cleanStr(guessedTitle);
    const inputArtist = cleanStr(guessedArtist);

    const isMatch =
      inputTitle.includes(targetTitle) ||
      targetTitle.includes(inputTitle);

    if (isMatch) {
      sfx.playCorrect();

      const points = (config.maxGuesses - guesses.length) * 100;
      const newScore = score + points;

      setGuesses((prev) => [
        ...prev,
        { text: `${guessedTitle} - ${guessedArtist}`, isCorrect: true },
      ]);
      setScoreGained(points);
      setIsWon(true);
      setIsGameOver(true);
      setScore(newScore);
      setCorrectCount((c) => c + 1);

      try {
        localStorage.setItem("tebak_lagu_score", newScore.toString());
      } catch {}
    } else {
      sfx.playWrong();

      const newGuesses = [
        ...guesses,
        { text: `${guessedTitle} - ${guessedArtist}`, isCorrect: false },
      ];
      setGuesses(newGuesses);

      const cluesTotal = song.lyricsClues?.length || 4;
      setActiveClueCount((prev) => Math.min(cluesTotal, prev + 1));
      setUnlockedHeardleLevel((prev) => Math.min(5, prev + 1));

      if (newGuesses.length >= config.maxGuesses) {
        setIsWon(false);
        setIsGameOver(true);
      }
    }
  };

  // Handle Skip
  const handleSkip = () => {
    if (!song || isGameOver) return;

    sfx.playSkip();

    const newGuesses = [
      ...guesses,
      { text: "LEWATI (Hint Terbuka)", isCorrect: false },
    ];
    setGuesses(newGuesses);

    const cluesTotal = song.lyricsClues?.length || 4;
    setActiveClueCount((prev) => Math.min(cluesTotal, prev + 1));
    setUnlockedHeardleLevel((prev) => Math.min(5, prev + 1));

    if (newGuesses.length >= config.maxGuesses) {
      setIsWon(false);
      setIsGameOver(true);
    }
  };

  const handleNextRound = () => {
    if (roundNumber >= gameConfig.maxRounds) {
      setIsGameOver(false);
      setIsMatchFinished(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#eab308", "#38bdf8"],
      });
      return;
    }

    setRoundNumber((r) => r + 1);
    loadNewSong();
  };

  const handlePlayAgain = () => {
    setIsMatchFinished(false);
    setRoundNumber(1);
    setCorrectCount(0);
    loadNewSong();
  };

  if (isLoading || !song) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-10 h-10 text-accent animate-spin mb-3" />
        <p className="text-sm font-mono text-gray-400">
          Menyiapkan lagu misteri ({gameConfig.category})...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Top Header */}
      <ScoreHeader
        title={config.title}
        roundInfo={`Ronde ${roundNumber}/${gameConfig.maxRounds}`}
        score={score}
      />

      {/* Main Arena Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto flex flex-col justify-center items-center p-4 gap-5 my-auto">
        {/* Genre & Difficulty Tags */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="bg-surfaceRaised border border-surfaceBorder px-2.5 py-0.5 rounded-full text-[11px] font-mono text-accent">
            🎯 {gameConfig.category}
          </span>
          <span className="bg-surfaceRaised border border-surfaceBorder px-2.5 py-0.5 rounded-full text-[11px] font-mono text-zinc-300">
            {gameConfig.difficulty === "easy"
              ? "🟢 Mudah"
              : gameConfig.difficulty === "medium"
              ? "🟡 Sedang"
              : "🔴 Sulit"}
          </span>
        </div>

        {/* Render Active Mode Component */}
        {modeKey === "tts" && (
          <TtsModePlayer
            clues={song.lyricsClues}
            activeClueCount={activeClueCount}
            initialVoiceType={
              gameConfig.audioProfile === "fast"
                ? "fast"
                : gameConfig.audioProfile === "bass"
                ? "deep"
                : "normal"
            }
            lang={song.lang || (song.category === "Western Hits" ? "en" : "id")}
          />
        )}

        {modeKey === "heardle" && (
          <HeardleModePlayer
            previewUrl={previewUrl}
            searchQuery={song.searchQuery}
            startSecond={song.startSecond}
            unlockedLevel={unlockedHeardleLevel}
          />
        )}

        {/* Guess Input & Autocomplete */}
        <GuessInput
          onGuess={handleGuess}
          onSkip={handleSkip}
          disabled={isGameOver}
          guesses={guesses}
          maxGuesses={config.maxGuesses}
        />
      </main>

      {/* Footer hint */}
      <footer className="w-full text-center py-3 text-xs text-mutedDark font-mono">
        Tebak Lagu · Ronde {roundNumber} dari {gameConfig.maxRounds}
      </footer>

      {/* Round Over Modal (Per-Round) */}
      {isGameOver && !isMatchFinished && (
        <GameOverModal
          isWon={isWon}
          song={song}
          scoreGained={scoreGained}
          guessesCount={guesses.length}
          maxGuesses={config.maxGuesses}
          guesses={guesses}
          modeTitle={config.title}
          onNext={handleNextRound}
          onExit={() => router.push("/")}
          albumCover={albumCover}
          previewUrl={previewUrl}
          isLastRound={roundNumber >= gameConfig.maxRounds}
        />
      )}

      {/* Match Completed Summary (Final Result) */}
      {isMatchFinished && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-3xl p-6 sm:p-7 max-w-sm w-full flex flex-col items-center text-center gap-4 shadow-2xl relative">
            <div className="w-16 h-16 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent shadow-lg shadow-accent/20">
              <Trophy className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-xl font-black text-white">Pertandingan Selesai!</h2>
              <p className="text-xs text-muted mt-0.5">
                {gameConfig.maxRounds} Ronde telah tuntas kamu mainkan
              </p>
            </div>

            <div className="w-full bg-surfaceRaised/80 border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted">Tebakan Benar:</span>
                <span className="text-emerald-400 font-bold">
                  {correctCount} / {gameConfig.maxRounds} Lagu
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-muted">Akurasi:</span>
                <span className="text-accent font-bold">
                  {Math.round((correctCount / Math.max(1, gameConfig.maxRounds)) * 100)}%
                </span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono pt-2 border-t border-surfaceBorder">
                <span className="text-muted">Total Skor:</span>
                <span className="text-white font-bold text-sm">
                  {score} Pts
                </span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2 pt-1">
              <button
                onClick={handlePlayAgain}
                className="w-full bg-accent hover:bg-green-500 text-zinc-950 font-black py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-xs sm:text-sm transition active:scale-95 cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Main Lagi</span>
              </button>

              <button
                onClick={() => router.push("/")}
                className="w-full bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs border border-surfaceBorder transition"
              >
                <Home className="w-4 h-4" />
                <span>Kembali ke Menu Utama</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
