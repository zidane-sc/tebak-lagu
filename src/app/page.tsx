"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Mic,
  Music,
  Timer,
  Volume2,
  Flame,
  Trophy,
  ArrowUpRight,
  Disc3,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import { CATEGORIES } from "@/data/songs";

const GAME_MODES = [
  {
    id: "tts",
    index: "01",
    title: "Robot Speech",
    tagline: "Lirik Datar Tanpa Nada",
    description:
      "Tebak lagu dari penggalan lirik yang dibacakan kaku tanpa melodi. Menguji kepekaan terhadap susunan kata.",
    icon: Volume2,
    badge: "TTS Engine",
  },
  {
    id: "humming",
    index: "02",
    title: "Vocal Melody",
    tagline: "Alunan Nada Sintetis",
    description:
      "Hanya ada notasi melodi vokal yang disintesis tanpa vokal penyanyi asli. Menguji kepekaan telinga musikal.",
    icon: Mic,
    badge: "Synthesizer",
  },
  {
    id: "instrumental",
    index: "03",
    title: "Minus-One",
    tagline: "Instrumen & Aransemen",
    description:
      "Aransemen musik asli tanpa vokal penyanyi. Rasakan tebakan melodi murni ala kuis trivia berpacu musik.",
    icon: Music,
    badge: "Backing Track",
  },
  {
    id: "heardle",
    index: "04",
    title: "Time Slice",
    tagline: "Detik Bertahap (Heardle)",
    description:
      "Dengarkan 0.5 detik cuplikan audio acak. Durasi terbuka bertahap (1.5s, 3s, 6s) tiap kali salah menebak.",
    icon: Timer,
    badge: "Time Attack",
  },
];

export default function HomePage() {
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua Genre");

  useEffect(() => {
    try {
      const s = parseInt(localStorage.getItem("tebak_lagu_streak") || "0", 10);
      const sc = parseInt(localStorage.getItem("tebak_lagu_score") || "0", 10);
      setStreak(s);
      setScore(sc);
    } catch {}
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-4xl mx-auto selection:bg-accentDim selection:text-accent">
      {/* Top Navigation Bar */}
      <header className="w-full flex items-center justify-between pb-6 border-b border-surfaceBorder">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-200">
            <Disc3 className="w-4 h-4 text-accent animate-spin [animation-duration:8s]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm sm:text-base tracking-tight text-white">
                Tebak Lagu
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surfaceRaised border border-surfaceBorder text-muted">
                v4.0
              </span>
            </div>
            <p className="text-xs text-muted">Audio Trivia & Blind Test</p>
          </div>
        </div>

        {/* Global Player Stats (Monospace Minimalism) */}
        <div className="flex items-center gap-2 font-mono text-xs">
          <div
            className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1.5 rounded-lg text-amber-400 font-semibold"
            title="Winning Streak"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-400" />
            <span>{streak} Streak</span>
          </div>

          <div
            className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1.5 rounded-lg text-zinc-200 font-semibold"
            title="Total Score"
          >
            <Trophy className="w-3.5 h-3.5 text-zinc-400" />
            <span>{score} Pts</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full my-auto py-8 flex flex-col gap-6">
        {/* Title & Tagline */}
        <div className="flex flex-col gap-1.5">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            Pilih Mode Tebakan
          </h2>
          <p className="text-xs sm:text-sm text-muted max-w-xl">
            Uji ketajaman telinga mengenali musik melalui lirik robot datar, melodi sintetis, maupun potongan audio sepersekian detik.
          </p>
        </div>

        {/* Multiplayer Banner */}
        <Link
          href="/multiplayer"
          className="w-full bg-surface hover:bg-surfaceRaised border border-surfaceBorder hover:border-accent/40 rounded-2xl p-4 transition-all flex items-center justify-between gap-3 shadow-sm group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-surfaceRaised group-hover:bg-accentDim border border-surfaceBorder group-hover:border-accent/30 flex items-center justify-center text-zinc-300 group-hover:text-accent transition-colors">
              <Zap className="w-5 h-5 group-hover:fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white tracking-tight">
                  Multiplayer Room
                </h3>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold">
                  LIVE BUZZER
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Ajak teman atau pasangan tanding tebak lagu real-time dengan sistem buzzer!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted group-hover:text-white font-mono pr-1 transition-colors">
            <span>Masuk</span>
            <ArrowUpRight className="w-4 h-4 text-mutedDark group-hover:text-accent" />
          </div>
        </Link>

        {/* Genre Pill Filter (Horizontal Scrolling on Mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar -mx-1 px-1">
          <span className="text-xs text-mutedDark font-mono flex items-center gap-1 mr-1 shrink-0">
            <SlidersHorizontal className="w-3 h-3" />
            <span>Genre:</span>
          </span>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? "bg-zinc-100 text-zinc-950 font-semibold shadow-sm"
                  : "bg-surfaceRaised hover:bg-zinc-800 text-muted hover:text-white border border-surfaceBorder"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Mode Cards Grid (Clean Minimalist Engineering Aesthetic) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {GAME_MODES.map((mode) => {
            const Icon = mode.icon;
            const queryParam =
              selectedCategory !== "Semua Genre"
                ? `?category=${encodeURIComponent(selectedCategory)}`
                : "";

            return (
              <Link
                key={mode.id}
                href={`/play/${mode.id}${queryParam}`}
                className="group relative bg-surface hover:bg-surfaceRaised border border-surfaceBorder hover:border-surfaceBorderHover rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between gap-4"
              >
                {/* Card Header: Mode Index + Tag */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-surfaceRaised group-hover:bg-zinc-800 border border-surfaceBorder flex items-center justify-center text-zinc-300 group-hover:text-accent transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-mono text-[11px] text-mutedDark block leading-none">
                        MODE {mode.index}
                      </span>
                      <h3 className="text-base font-semibold text-white tracking-tight mt-0.5">
                        {mode.title}
                      </h3>
                    </div>
                  </div>

                  <span className="text-[10px] font-mono font-medium text-muted bg-surfaceRaised border border-surfaceBorder px-2 py-0.5 rounded-md">
                    {mode.badge}
                  </span>
                </div>

                {/* Subtitle & Description */}
                <div>
                  <p className="text-xs font-medium text-zinc-300 mb-1">
                    {mode.tagline}
                  </p>
                  <p className="text-xs text-muted leading-relaxed line-clamp-2">
                    {mode.description}
                  </p>
                </div>

                {/* Card Footer: Action */}
                <div className="pt-3 border-t border-surfaceBorder/60 flex items-center justify-between text-xs text-muted group-hover:text-white transition-colors">
                  <span className="font-mono text-[11px]">
                    Mainkan ({selectedCategory})
                  </span>
                  <div className="flex items-center gap-1 font-medium group-hover:translate-x-0.5 transition-transform text-zinc-400 group-hover:text-accent">
                    <span>Mulai</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>

      {/* Minimal Editorial Footer */}
      <footer className="w-full pt-6 border-t border-surfaceBorder flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-mutedDark font-mono">
        <p>Tebak Lagu · Audio Trivia Engine</p>
        <p>Built for Zidane Sc · Production Ready</p>
      </footer>
    </div>
  );
}
