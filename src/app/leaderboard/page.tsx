"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Trophy,
  ChevronLeft,
  Flame,
  Award,
  Crown,
  Medal,
  Sparkles,
  Share2,
  RefreshCw,
  Gamepad2,
  Zap,
  Users,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { SocialShareModal } from "@/components/SocialShareModal";

interface LeaderboardEntry {
  rank: number;
  player_key: string;
  player_name: string;
  player_avatar?: string;
  score: number;
  games_count: number;
  wins?: number;
  last_played?: string;
}

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<"all_time" | "weekly">("all_time");
  const [mode, setMode] = useState<string>("all");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);

  // Fetch leaderboard data from API
  const fetchLeaderboard = () => {
    setIsLoading(true);
    const q = new URLSearchParams({
      tab,
      mode,
      limit: "50",
    });

    fetch(`/api/leaderboard?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.leaderboard) {
          setLeaderboard(data.leaderboard);
        }
      })
      .catch((err) => console.error("Error fetching leaderboard:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchLeaderboard();
  }, [tab, mode]);

  // Find current user's rank
  const myEntry = user
    ? leaderboard.find(
        (e) =>
          e.player_key === user.id ||
          e.player_name.toLowerCase() === user.name.toLowerCase()
      )
    : null;

  const top1 = leaderboard[0];
  const top2 = leaderboard[1];
  const top3 = leaderboard[2];
  const remaining = leaderboard.slice(3);

  return (
    <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-4xl mx-auto selection:bg-accentDim selection:text-accent pb-28">
      {/* Top Header */}
      <header className="w-full flex items-center justify-between pb-6 border-b border-surfaceBorder">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder flex items-center justify-center text-zinc-300 hover:text-white transition active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-accent fill-accent" />
              <h1 className="font-bold text-base sm:text-lg tracking-tight text-white">
                Papan Peringkat
              </h1>
            </div>
            <p className="text-xs text-muted">Adu Skor & Telinga Dewa Nasional</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowShareModal(true)}
            className="p-2 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white transition"
            title="Bagikan Skor"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <GoogleAuthButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full py-6 flex flex-col gap-6">
        {/* Tab Switcher: All-Time vs Weekly */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center bg-surfaceRaised p-1 rounded-2xl border border-surfaceBorder">
            <button
              onClick={() => setTab("all_time")}
              className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                tab === "all_time"
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-muted hover:text-white"
              }`}
            >
              🌟 Sepanjang Masa
            </button>
            <button
              onClick={() => setTab("weekly")}
              className={`py-2 px-4 rounded-xl text-xs font-semibold transition-all ${
                tab === "weekly"
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-muted hover:text-white"
              }`}
            >
              ⚡ Minggu Ini (Live)
            </button>
          </div>

          {/* Mode Filter Selector */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {[
              { id: "all", label: "Semua Mode" },
              { id: "heardle", label: "Time Slice ⏱️" },
              { id: "tts", label: "Robot TTS 🤖" },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`py-1.5 px-3 rounded-lg text-xs font-medium border transition-all whitespace-nowrap ${
                  mode === m.id
                    ? "bg-accent/20 border-accent/40 text-accent font-semibold"
                    : "bg-surface border-surfaceBorder text-muted hover:text-white"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 👑 TOP 3 PODIUM */}
        {!isLoading && leaderboard.length >= 1 && (
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-4 pb-2">
            {/* Rank 2 (Silver) */}
            <div className="flex flex-col items-center gap-2">
              {top2 ? (
                <>
                  <div className="relative">
                    {top2.player_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={top2.player_avatar}
                        alt={top2.player_name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-zinc-400 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-zinc-700 border-2 border-zinc-400 flex items-center justify-center text-zinc-200 font-bold text-lg shadow-md">
                        {top2.player_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -top-2 -right-1 bg-zinc-300 text-zinc-950 font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-zinc-400 shadow-sm">
                      2
                    </span>
                  </div>
                  <div className="text-center w-full">
                    <p className="font-bold text-xs sm:text-sm text-white truncate max-w-[90px] sm:max-w-[120px] mx-auto">
                      {top2.player_name}
                    </p>
                    <span className="text-xs sm:text-sm font-mono text-zinc-300 font-bold">
                      {top2.score} pts
                    </span>
                  </div>
                  <div className="w-full bg-zinc-800/80 border border-zinc-700/60 rounded-t-2xl h-20 sm:h-24 flex items-center justify-center text-zinc-400 font-mono font-bold text-xs">
                    🥈 Silver
                  </div>
                </>
              ) : (
                <div className="w-full h-20 border border-dashed border-surfaceBorder rounded-2xl flex items-center justify-center text-[10px] text-mutedDark font-mono">
                  Kosong
                </div>
              )}
            </div>

            {/* Rank 1 (Gold 👑) */}
            <div className="flex flex-col items-center gap-2 -mt-4">
              {top1 ? (
                <>
                  <Crown className="w-7 h-7 text-amber-400 fill-amber-400 animate-bounce" />
                  <div className="relative">
                    {top1.player_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={top1.player_avatar}
                        alt={top1.player_name}
                        className="w-18 h-18 sm:w-20 sm:h-20 rounded-full object-cover border-4 border-amber-400 shadow-xl shadow-amber-500/20"
                      />
                    ) : (
                      <div className="w-18 h-18 sm:w-20 sm:h-20 rounded-full bg-amber-500/20 border-4 border-amber-400 flex items-center justify-center text-amber-300 font-black text-2xl shadow-xl shadow-amber-500/20">
                        {top1.player_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -top-2 -right-1 bg-amber-400 text-zinc-950 font-black text-xs w-6 h-6 rounded-full flex items-center justify-center border-2 border-zinc-950 shadow-md">
                      1
                    </span>
                  </div>
                  <div className="text-center w-full">
                    <p className="font-extrabold text-sm sm:text-base text-white truncate max-w-[100px] sm:max-w-[140px] mx-auto">
                      {top1.player_name}
                    </p>
                    <span className="text-sm sm:text-base font-mono text-accent font-black">
                      {top1.score} pts
                    </span>
                  </div>
                  <div className="w-full bg-amber-500/20 border border-amber-400/50 rounded-t-2xl h-28 sm:h-32 flex flex-col items-center justify-center text-amber-300 font-mono font-bold text-xs sm:text-sm shadow-lg shadow-amber-500/10">
                    <span>👑 Champion</span>
                  </div>
                </>
              ) : null}
            </div>

            {/* Rank 3 (Bronze) */}
            <div className="flex flex-col items-center gap-2">
              {top3 ? (
                <>
                  <div className="relative">
                    {top3.player_avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={top3.player_avatar}
                        alt={top3.player_name}
                        className="w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-amber-700 shadow-md"
                      />
                    ) : (
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-amber-950/40 border-2 border-amber-700 flex items-center justify-center text-amber-500 font-bold text-lg shadow-md">
                        {top3.player_name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="absolute -top-2 -right-1 bg-amber-700 text-white font-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center border border-amber-800 shadow-sm">
                      3
                    </span>
                  </div>
                  <div className="text-center w-full">
                    <p className="font-bold text-xs sm:text-sm text-white truncate max-w-[90px] sm:max-w-[120px] mx-auto">
                      {top3.player_name}
                    </p>
                    <span className="text-xs sm:text-sm font-mono text-amber-500 font-bold">
                      {top3.score} pts
                    </span>
                  </div>
                  <div className="w-full bg-amber-950/30 border border-amber-800/40 rounded-t-2xl h-16 sm:h-20 flex items-center justify-center text-amber-600 font-mono font-bold text-xs">
                    🥉 Bronze
                  </div>
                </>
              ) : (
                <div className="w-full h-16 border border-dashed border-surfaceBorder rounded-2xl flex items-center justify-center text-[10px] text-mutedDark font-mono">
                  Kosong
                </div>
              )}
            </div>
          </div>
        )}

        {/* TOP 50 TABLE LIST */}
        <div className="bg-surface border border-surfaceBorder rounded-2xl overflow-hidden shadow-sm">
          <div className="p-3.5 px-4 bg-surfaceRaised/50 border-b border-surfaceBorder flex items-center justify-between text-[11px] font-mono text-muted uppercase">
            <span>Peringkat & Pemain</span>
            <div className="flex items-center gap-6">
              <span>Game</span>
              <span>Skor Poin</span>
            </div>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted font-mono flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-accent" />
              <span>Memuat papan peringkat...</span>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted font-mono flex flex-col items-center gap-2">
              <Trophy className="w-8 h-8 text-mutedDark opacity-50" />
              <span>Belum ada rekor skor tercatat untuk filter ini.</span>
              <p className="text-[11px] text-mutedDark">Jadilah yang pertama main dan raih posisi juara #1!</p>
            </div>
          ) : (
            <div className="divide-y divide-surfaceBorder/60">
              {leaderboard.map((item) => {
                const isMe =
                  user &&
                  (item.player_key === user.id ||
                    item.player_name.toLowerCase() === user.name.toLowerCase());

                return (
                  <div
                    key={`${item.player_key}-${item.rank}`}
                    className={`p-3.5 px-4 flex items-center justify-between transition-colors ${
                      isMe
                        ? "bg-accent/10 border-l-4 border-l-accent"
                        : "hover:bg-surfaceRaised/50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 text-center font-mono font-bold text-xs ${
                          item.rank === 1
                            ? "text-amber-400 font-black text-sm"
                            : item.rank === 2
                            ? "text-zinc-300"
                            : item.rank === 3
                            ? "text-amber-600"
                            : "text-muted"
                        }`}
                      >
                        #{item.rank}
                      </span>

                      {item.player_avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.player_avatar}
                          alt={item.player_name}
                          className="w-8 h-8 rounded-full object-cover border border-surfaceBorder shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surfaceRaised border border-surfaceBorder text-zinc-300 flex items-center justify-center font-bold text-xs shrink-0">
                          {item.player_name.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-1.5">
                          <span>{item.player_name}</span>
                          {isMe && (
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-accent/20 text-accent font-bold">
                              KAMU
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 shrink-0 font-mono">
                      <span className="text-xs text-muted">
                        {item.games_count}x
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-accent min-w-[60px] text-right">
                        {item.score} pts
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* STICKY BOTTOM BAR: PINNED CURRENT USER RANK */}
      {user && (
        <div className="fixed bottom-3 left-4 right-4 max-w-lg mx-auto bg-surface/95 backdrop-blur-md border border-accent/40 rounded-2xl p-3 px-4 flex items-center justify-between shadow-2xl z-40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 text-accent flex items-center justify-center font-bold text-xs">
              {myEntry ? `#${myEntry.rank}` : "—"}
            </div>
            <div>
              <p className="text-xs font-bold text-white flex items-center gap-1">
                <span>{user.name}</span>
                <span className="text-[10px] text-accent font-mono">
                  {myEntry ? `(Peringkat #${myEntry.rank})` : "(Belum Peringkat)"}
                </span>
              </p>
              <p className="text-[10px] text-muted font-mono">
                Total Koleksi: {user.total_score} Pts
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-1.5 bg-accent hover:bg-green-500 text-zinc-950 font-bold py-1.5 px-3 rounded-xl text-xs transition active:scale-95 cursor-pointer shadow-sm"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Bagikan</span>
          </button>
        </div>
      )}

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Bagikan Skor Papan Peringkat"
        score={user?.total_score || myEntry?.score}
        rank={myEntry?.rank}
        modeTitle={tab === "weekly" ? "Tebak Lagu (Minggu Ini)" : "Tebak Lagu Nasional"}
        shareUrl="https://tebak-lagu-live.fly.dev/leaderboard"
      />
    </div>
  );
}
