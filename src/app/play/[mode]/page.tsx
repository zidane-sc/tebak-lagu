"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ScoreHeader } from "@/components/ScoreHeader";
import { GuessInput } from "@/components/GuessInput";
import { GameOverModal } from "@/components/GameOverModal";
import { TtsModePlayer } from "@/components/modes/TtsModePlayer";
import { HeardleModePlayer } from "@/components/modes/HeardleModePlayer";
import { Song } from "@/data/songs";
import { sfx } from "@/lib/sound-fx";
import { useAuth } from "@/lib/auth-context";
import { SocialShareModal } from "@/components/SocialShareModal";
import { useYouTubeEngine } from "@/lib/youtube-engine";
// CommonJS so the socket engine loads the same matcher.
import guessMatcher from "@/lib/guess-matcher";
const { isGuessCorrect } = guessMatcher as any;
import { Loader2, Trophy, RotateCcw, Home, Sparkles, CheckCircle2, XCircle, Share2, ArrowRight } from "lucide-react";
import confetti from "canvas-confetti";
import { DEFAULT_SETTINGS } from "@/lib/game-settings";

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
  const { user, syncScore } = useAuth();

  const modeKey = (params?.mode as string) || "heardle";
  const config = MODE_CONFIG[modeKey] || MODE_CONFIG.heardle;

  // Single player config from sessionStorage (clean URL without query params)
  const [gameConfig, setGameConfig] = useState({
    filterType: "category" as "category" | "artists",
    category: "Semua Playlist",
    selectedArtists: [] as string[],
    difficulty: "easy",
    audioProfile: "normal",
    maxRounds: 5,
  });

  // Blocks the first song fetch until the real config is read. Without this the
  // initial load races ahead with the default config and round 1 comes from the
  // wrong pool (e.g. "Semua Playlist" instead of the chosen artist).
  const [isConfigReady, setIsConfigReady] = useState(false);

  const [song, setSong] = useState<Song | null>(null);
  const [roundNumber, setRoundNumber] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [albumCover, setAlbumCover] = useState<string | undefined>(undefined);

  // YouTube Audio Engine (persistent singleton)
  const ytEngine = useYouTubeEngine({
    onError: (msg) => console.warn("[YT Engine]", msg),
  });

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
  const [showShareModal, setShowShareModal] = useState(false);

  // Load Config from sessionStorage or fallback to URL query.
  // The stored config is consumed once so a later visit can't silently inherit
  // the previous run's picks.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("tebak_lagu_single_config");
      if (saved) {
        const parsed = JSON.parse(saved);
        sessionStorage.removeItem("tebak_lagu_single_config");
        setGameConfig({
          filterType: parsed.filterType || "category",
          category: parsed.category || "Semua Playlist",
          selectedArtists: Array.isArray(parsed.selectedArtists) ? parsed.selectedArtists : [],
          difficulty: parsed.difficulty || "easy",
          audioProfile: parsed.audioProfile || "normal",
          maxRounds: parsed.maxRounds || 5,
        });
      } else {
        setGameConfig({
          filterType: "category",
          category: searchParams.get("category") || "Semua Playlist",
          selectedArtists: [],
          difficulty: searchParams.get("difficulty") || "easy",
          audioProfile: searchParams.get("audioProfile") || "normal",
          maxRounds: parseInt(searchParams.get("rounds") || "5", 10),
        });
      }
    } catch {}
    setIsConfigReady(true);
  }, [searchParams]);

  // Load Saved Lifetime Score
  useEffect(() => {
    try {
      setScore(parseInt(localStorage.getItem("tebak_lagu_score") || "0", 10));
    } catch {}
  }, []);

  // Fetch Server Tuned Settings (durations, tts progression)
  const [serverSettings, setServerSettings] = useState<any>(null);
  // Full-length preview for the results screen. This is not the Time Slice
  // audio path: Time Slice is YouTube-only now, but the game-over modal still
  // plays the song through so a player can hear what they missed.
  const [previewUrl, setPreviewUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => setServerSettings(data))
      .catch(() => {});
  }, []);

  // Serialise the artist list so the callback identity stays stable. Without
  // this, every render produces a new array -> new useCallback -> refetch loop.
  const artistsKey = (gameConfig.selectedArtists || []).join(",");

  // Fetch song from server database (with guaranteed LRCLIB lyrics & Apple preview)
  const loadNewSong = useCallback(() => {
    setIsLoading(true);
    setIsGameOver(false);
    setIsWon(false);
    setGuesses([]);
    setActiveClueCount(serverSettings?.ttsCluesProgression?.[0] ?? DEFAULT_SETTINGS.ttsCluesProgression[0]);
    setUnlockedHeardleLevel(0);
    setScoreGained(0);

    const q = new URLSearchParams({
      mode: modeKey,
      difficulty: gameConfig.difficulty,
    });

    if (gameConfig.filterType === "artists" && artistsKey) {
      q.set("filterType", "artists");
      q.set("artists", artistsKey);
    } else {
      q.set("category", gameConfig.category);
    }

    const exclude = Array.from(playedSongIds.current);
    if (exclude.length > 0) {
      q.set("exclude", exclude.join(","));
    }

    fetch(`/api/songs/random?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.song) {
          const s = data.song;
          setSong(s);
                setAlbumCover(s.albumCover);
          setPreviewUrl(s.previewResolved || s.previewUrl);
          // Cue YouTube player (muted preload) if youtube_id exists
          if (s.youtubeId && s.youtubeStatus === "ready") {
            ytEngine.cue({ youtubeId: s.youtubeId, startSecond: s.youtubeStartSecond ?? 20, title: s.title, artist: s.artist });
          }
        }
      })
      .catch((err) => {
        console.error("Failed to load song from API:", err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [modeKey, gameConfig.category, gameConfig.difficulty, gameConfig.filterType, artistsKey]);

  useEffect(() => {
    if (isConfigReady) loadNewSong();
  }, [loadNewSong, isConfigReady]);

  // Track played song IDs to avoid repeats in the same session
  const playedSongIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (song?.id) {
      playedSongIds.current.add(song.id);
    }
  }, [song?.id]);

  // Handle Player Guess
  const handleGuess = (guessedTitle: string, guessedArtist: string) => {
    if (!song || isGameOver) return;

    const isMatch = isGuessCorrect(
      guessedTitle,
      guessedArtist,
      song.title,
      song.artist
    );

    if (isMatch) {
      sfx.playCorrect();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([40, 50, 100]);
      }
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#10b981", "#38bdf8", "#facc15"],
      });

      // Score mirrors the multiplayer engine: fewer wrong guesses pays more, but
      // a round won on the first try is worth far more than a last-guess save.
      const wrongGuesses = guesses.length;
      const points = Math.max(100, (config.maxGuesses - wrongGuesses) * 150);
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

      if (user) {
        syncScore(points, true);
      }

      // Track correct guess analytics
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songId: song.id, action: "result", isCorrect: true }),
      }).catch(() => {});

      try {
        localStorage.setItem("tebak_lagu_score", newScore.toString());
      } catch {}
    } else {
      sfx.playWrong();
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([160]);
      }

      const newGuesses = [
        ...guesses,
        { text: `${guessedTitle} - ${guessedArtist}`, isCorrect: false },
      ];
      setGuesses(newGuesses);

      const cluesTotal = song.lyricsClues?.length || 4;
      const ttsProgression = serverSettings?.ttsCluesProgression ?? DEFAULT_SETTINGS.ttsCluesProgression;
      const nextTtsIdx = Math.min(ttsProgression.length - 1, newGuesses.length);
      const nextTtsCount = ttsProgression[nextTtsIdx] ?? (newGuesses.length + 1);
      setActiveClueCount(Math.min(cluesTotal, nextTtsCount));
      const levels = (serverSettings?.heardleDurations ?? DEFAULT_SETTINGS.heardleDurations).length;
      setUnlockedHeardleLevel((prev) => Math.min(levels - 1, prev + 1));

      if (newGuesses.length >= config.maxGuesses) {
        setIsWon(false);
        setIsGameOver(true);

        // Track failed guess analytics
        fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ songId: song.id, action: "result", isCorrect: false }),
        }).catch(() => {});
      }
    }
  };

  // Handle Skip
  const handleSkip = () => {
    if (!song || isGameOver) return;

    sfx.playSkip();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([40]);
    }

    const newGuesses = [
      ...guesses,
      { text: "LEWATI (Hint Terbuka)", isCorrect: false },
    ];
    setGuesses(newGuesses);

    const cluesTotal = song.lyricsClues?.length || 4;
    const ttsProgression = serverSettings?.ttsCluesProgression ?? DEFAULT_SETTINGS.ttsCluesProgression;
    const nextTtsIdx = Math.min(ttsProgression.length - 1, newGuesses.length);
    const nextTtsCount = ttsProgression[nextTtsIdx] ?? (newGuesses.length + 1);
    setActiveClueCount(Math.min(cluesTotal, nextTtsCount));
    const levels = (serverSettings?.heardleDurations ?? DEFAULT_SETTINGS.heardleDurations).length;
      setUnlockedHeardleLevel((prev) => Math.min(levels - 1, prev + 1));

    if (newGuesses.length >= config.maxGuesses) {
      setIsWon(false);
      setIsGameOver(true);
    }
  };

  const handleNextRound = () => {
    // Score for the last round is already committed into `score`, so submit the
    // real running total instead of a per-correct-count guess.
    const finalScore = isWon ? score + scoreGained : score;

    if (roundNumber >= gameConfig.maxRounds) {
      setIsGameOver(false);
      setIsMatchFinished(true);
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#22c55e", "#eab308", "#38bdf8"],
      });

      // Submit match score to Leaderboard API
      fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user?.id || null,
          player_name: user?.name || "Raja Musik",
          player_avatar: user?.avatar || "",
          mode: modeKey,
          category: gameConfig.category,
          difficulty: gameConfig.difficulty,
          score: finalScore,
        }),
      }).catch(() => {});

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
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Top Header */}
      <ScoreHeader
        title={config.title}
        roundInfo={`Ronde ${roundNumber}/${gameConfig.maxRounds}`}
        score={score}
      />

      {/*
        Compact arena. This was justify-center inside a min-h-screen, which on a
        tall phone floated the whole stack into the middle of the screen with
        empty space above and below, and pushed the guess box below the fold.
        justify-start with a tighter gap keeps the deck, the tag row and the
        guess field in one viewport, and the bottom padding leaves room for the
        Android navigation bar.
      */}
      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col justify-start items-center px-4 pt-3 pb-24 gap-3">
        {/* Playlist & Difficulty Tags */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="bg-surfaceRaised border border-surfaceBorder px-2 py-0.5 rounded-full text-[10px] font-mono text-accent">
            🎯 {gameConfig.filterType === "artists" && gameConfig.selectedArtists?.length > 0
              ? `${gameConfig.selectedArtists.length} Artis Pilihan`
              : gameConfig.category}
          </span>
          <span className="bg-surfaceRaised border border-surfaceBorder px-2 py-0.5 rounded-full text-[10px] font-mono text-zinc-300">
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
            isGameOver={isGameOver}
          />
        )}

        {modeKey === "heardle" && (
          <HeardleModePlayer
            searchQuery={song.searchQuery}
            unlockedLevel={unlockedHeardleLevel}
            isGameOver={isGameOver}
            customDurations={serverSettings?.heardleDurations}
            youtubeId={(song as any).youtubeId}
            youtubeStatus={(song as any).youtubeStatus}
            youtubeStartSecond={(song as any).youtubeStartSecond ?? 20}
            onYoutubePlay={(startSecond) => {
              if (song && (song as any).youtubeId) {
                ytEngine.play({
                  youtubeId: (song as any).youtubeId,
                  startSecond: startSecond,
                  title: song.title,
                  artist: song.artist,
                });
              } else {
                ytEngine.unmuteAndPlay(startSecond);
              }
            }}
            onYoutubePause={() => ytEngine.pause()}
            ytEngineState={ytEngine.state}
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
                onClick={() => setShowShareModal(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan Hasil (WA / IG / TikTok)</span>
              </button>

              <button
                onClick={handlePlayAgain}
                className="w-full bg-accent hover:bg-green-500 text-zinc-950 font-black py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-95 cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Main Lagi</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/leaderboard"
                  className="bg-surfaceRaised hover:bg-zinc-800 text-amber-400 font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs border border-surfaceBorder transition"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Peringkat</span>
                </Link>

                <button
                  onClick={() => router.push("/")}
                  className="bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white font-semibold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 text-xs border border-surfaceBorder transition"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Menu</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Hasil Pertandingan Tebak Lagu"
        score={score}
        modeTitle={`${config.title} (${correctCount}/${gameConfig.maxRounds} Benar)`}
        shareUrl="https://tebak-lagu-live.fly.dev/"
      />
    </div>
  );
}
