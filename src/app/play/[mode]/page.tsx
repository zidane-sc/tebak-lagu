"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ScoreHeader } from "@/components/ScoreHeader";
import { GuessInput } from "@/components/GuessInput";
import { GameOverModal } from "@/components/GameOverModal";
import { TtsModePlayer } from "@/components/modes/TtsModePlayer";
import { HummingModePlayer } from "@/components/modes/HummingModePlayer";
import { InstrumentalModePlayer } from "@/components/modes/InstrumentalModePlayer";
import { HeardleModePlayer } from "@/components/modes/HeardleModePlayer";
import { Song, SONGS_CATALOG } from "@/data/songs";
import { sfx } from "@/lib/sound-fx";
import { Loader2 } from "lucide-react";

const MODE_CONFIG: Record<
  string,
  { title: string; icon: string; maxGuesses: number }
> = {
  tts: {
    title: "Dinyanyiin Robot TTS",
    icon: "🤖",
    maxGuesses: 5,
  },
  humming: {
    title: "Humming & Melodi",
    icon: "🎵",
    maxGuesses: 5,
  },
  instrumental: {
    title: "Musiknya Doang",
    icon: "🎸",
    maxGuesses: 5,
  },
  heardle: {
    title: "Detik Bertahap (Heardle)",
    icon: "⏱️",
    maxGuesses: 6,
  },
};

export default function PlayArenaPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const modeKey = (params?.mode as string) || "tts";
  const categoryFilter = searchParams.get("category");
  const difficultyFilter = searchParams.get("difficulty");
  const audioProfile = searchParams.get("audioProfile") || "normal";
  const config = MODE_CONFIG[modeKey] || MODE_CONFIG.tts;

  const [song, setSong] = useState<Song | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);
  const [albumCover, setAlbumCover] = useState<string | undefined>(undefined);

  // Gameplay States
  const [guesses, setGuesses] = useState<Array<{ text: string; isCorrect: boolean }>>([]);
  const [activeClueCount, setActiveClueCount] = useState(1);
  const [unlockedHeardleLevel, setUnlockedHeardleLevel] = useState(0);

  // Score & Streak
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [scoreGained, setScoreGained] = useState(0);

  // Round Over State
  const [isGameOver, setIsGameOver] = useState(false);
  const [isWon, setIsWon] = useState(false);

  // Load Saved Stats
  useEffect(() => {
    try {
      setStreak(parseInt(localStorage.getItem("tebak_lagu_streak") || "0", 10));
      setScore(parseInt(localStorage.getItem("tebak_lagu_score") || "0", 10));
    } catch {}
  }, []);

  // Pick Random Song and Preload Preview
  const loadNewSong = useCallback(() => {
    setIsLoading(true);
    setIsGameOver(false);
    setIsWon(false);
    setGuesses([]);
    setActiveClueCount(1);
    setUnlockedHeardleLevel(0);
    setScoreGained(0);

    let pool = SONGS_CATALOG;
    if (categoryFilter && categoryFilter !== "Semua Genre") {
      pool = pool.filter((s) => s.category === categoryFilter);
    }
    if (difficultyFilter && difficultyFilter !== "all") {
      const diffFiltered = pool.filter((s) => s.difficulty === difficultyFilter);
      if (diffFiltered.length > 0) pool = diffFiltered;
    }
    const activePool = pool.length > 0 ? pool : SONGS_CATALOG;

    const randomSong = activePool[Math.floor(Math.random() * activePool.length)];
    setSong(randomSong);

    fetch(`/api/preview?q=${encodeURIComponent(randomSong.searchQuery)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.previewUrl) setPreviewUrl(data.previewUrl);
        else setPreviewUrl(randomSong.previewFallback);

        if (data.albumCover) setAlbumCover(data.albumCover);
      })
      .catch(() => {
        setPreviewUrl(randomSong.previewFallback);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [categoryFilter, difficultyFilter]);

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
      // Sound FX
      sfx.playCorrect();

      const points = (config.maxGuesses - guesses.length) * 100;
      const newStreak = streak + 1;
      const newScore = score + points;

      setGuesses((prev) => [
        ...prev,
        { text: `${guessedTitle} - ${guessedArtist}`, isCorrect: true },
      ]);
      setScoreGained(points);
      setIsWon(true);
      setIsGameOver(true);
      setStreak(newStreak);
      setScore(newScore);

      try {
        localStorage.setItem("tebak_lagu_streak", newStreak.toString());
        localStorage.setItem("tebak_lagu_score", newScore.toString());
      } catch {}
    } else {
      // Sound FX
      sfx.playWrong();

      const newGuesses = [
        ...guesses,
        { text: `${guessedTitle} - ${guessedArtist}`, isCorrect: false },
      ];
      setGuesses(newGuesses);

      setActiveClueCount((prev) => Math.min(song.lyricsClues.length, prev + 1));
      setUnlockedHeardleLevel((prev) => Math.min(5, prev + 1));

      if (newGuesses.length >= config.maxGuesses) {
        setIsWon(false);
        setIsGameOver(true);
        setStreak(0);
        try {
          localStorage.setItem("tebak_lagu_streak", "0");
        } catch {}
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

    setActiveClueCount((prev) => Math.min(song.lyricsClues.length, prev + 1));
    setUnlockedHeardleLevel((prev) => Math.min(5, prev + 1));

    if (newGuesses.length >= config.maxGuesses) {
      setIsWon(false);
      setIsGameOver(true);
      setStreak(0);
      try {
        localStorage.setItem("tebak_lagu_streak", "0");
      } catch {}
    }
  };

  const handleNextRound = () => {
    setRoundNumber((r) => r + 1);
    loadNewSong();
  };

  if (isLoading || !song) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-white">
        <Loader2 className="w-10 h-10 text-brandCyan animate-spin mb-3" />
        <p className="text-sm font-mono text-gray-400">
          Menyiapkan lagu misteri ({categoryFilter || "Semua Genre"})...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col justify-between">
      {/* Top Header */}
      <ScoreHeader
        title={`${config.title} #${roundNumber}`}
        icon={config.icon}
        streak={streak}
        score={score}
      />

      {/* Main Arena Content */}
      <main className="flex-1 w-full max-w-2xl mx-auto flex flex-col justify-center items-center p-4 gap-6 my-auto">
        {/* Genre Pill Tag */}
        {categoryFilter && (
          <div className="bg-surfaceLight/90 border border-gray-800 px-3 py-1 rounded-full text-xs font-mono text-brandCyan">
            Genre: {categoryFilter}
          </div>
        )}

        {/* Render Active Mode Component */}
        {modeKey === "tts" && (
          <TtsModePlayer
            clues={song.lyricsClues}
            activeClueCount={activeClueCount}
            initialVoiceType={audioProfile === "fast" ? "fast" : audioProfile === "bass" ? "deep" : "normal"}
          />
        )}

        {modeKey === "humming" && (
          <HummingModePlayer melody={song.hummingMelody} />
        )}

        {modeKey === "instrumental" && (
          <InstrumentalModePlayer
            previewUrl={previewUrl}
            searchQuery={song.searchQuery}
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
      <footer className="w-full text-center py-3 text-xs text-gray-600 font-mono">
        Tebak Lagu · Endless Arcade · Lagu #{roundNumber}
      </footer>

      {/* Game Over Modal with Confetti & Share */}
      {isGameOver && (
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
        />
      )}
    </div>
  );
}
