"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
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
  X,
  Play,
  Settings,
} from "lucide-react";
import { CATEGORIES } from "@/data/songs";

const GAME_MODES = [
  {
    id: "heardle",
    index: "01",
    title: "Time Slice (Heardle)",
    tagline: "Detik Bertahap 5s ➔ 30s",
    description:
      "Tebak lagu dari cuplikan audio bertahap: 5 detik, 9 detik, 18 detik, hingga 30 detik penuh. Uji kecepatan pendengaranmu!",
    icon: Timer,
    badge: "Audio Attack",
  },
  {
    id: "tts",
    index: "02",
    title: "Robot Speech (TTS)",
    tagline: "Blind Lirik Puisi Datar",
    description:
      "Tebak lagu dari penggalan bait lirik yang dibacakan kaku oleh robot pintar (Indo & English). Tanpa melodi, murni kata-kata!",
    icon: Volume2,
    badge: "TTS Engine",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("Semua Genre");

  // Single Player Mode Configuration Modal State
  const [configModalMode, setConfigModalMode] = useState<any>(null);
  const [modalCategory, setModalCategory] = useState("Semua Genre");
  const [modalDifficulty, setModalDifficulty] = useState("easy");
  const [modalAudioProfile, setModalAudioProfile] = useState("normal");
  const [modalRounds, setModalRounds] = useState(5);

  useEffect(() => {
    try {
      const sc = parseInt(localStorage.getItem("tebak_lagu_score") || "0", 10);
      setScore(sc);
    } catch {}
  }, []);

  const handleStartGame = () => {
    if (!configModalMode) return;
    try {
      sessionStorage.setItem(
        "tebak_lagu_single_config",
        JSON.stringify({
          category: modalCategory,
          difficulty: modalDifficulty,
          audioProfile: modalAudioProfile,
          maxRounds: modalRounds,
        })
      );
    } catch {}
    router.push(`/play/${configModalMode.id}`);
  };

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

        {/* Global Player Stats & Google Login */}
        <div className="flex items-center gap-3">
          <GoogleAuthButton />
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

            return (
              <button
                type="button"
                key={mode.id}
                onClick={() => {
                  setConfigModalMode(mode);
                  setModalCategory(selectedCategory);
                }}
                className="group relative bg-surface hover:bg-surfaceRaised border border-surfaceBorder hover:border-surfaceBorderHover rounded-2xl p-5 transition-all duration-200 flex flex-col justify-between gap-4 text-left cursor-pointer"
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
                    Atur & Mainkan ({selectedCategory})
                  </span>
                  <div className="flex items-center gap-1 font-medium group-hover:translate-x-0.5 transition-transform text-zinc-400 group-hover:text-accent">
                    <span>Atur Game</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>

      {/* Pre-Game Configuration Modal (Single Player) */}
      {configModalMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent">
                  {React.createElement(configModalMode.icon, { className: "w-5 h-5" })}
                </div>
                <div>
                  <h3 className="text-base font-bold text-white leading-tight">
                    {configModalMode.title}
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {configModalMode.tagline}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfigModalMode(null)}
                className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Pilih Genre */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>1. PILIH GENRE</span>
                <span className="text-accent font-bold">{modalCategory}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Semua Genre", label: "Semua Genre 🔀" },
                  { id: "Galau Hits", label: "Galau Hits 💔" },
                  { id: "Nostalgia 2000s", label: "Nostalgia 2000s 🎸" },
                  { id: "Anthem Tongkrongan", label: "Tongkrongan 🍻" },
                  { id: "Pop Jawa & Koplo", label: "Jawa & Koplo 💃" },
                  { id: "Western Hits", label: "Western Hits 🌎" },
                ].map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setModalCategory(c.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold text-left transition ${
                      modalCategory === c.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tingkat Kesulitan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>2. TINGKAT KESULITAN</span>
                <span className="text-accent font-bold">
                  {modalDifficulty === "easy"
                    ? "Mudah (Mega Hits) 🟢"
                    : modalDifficulty === "medium"
                    ? "Sedang (Populer) 🟡"
                    : modalDifficulty === "hard"
                    ? "Sulit (Sepuh) 🔴"
                    : "Campur (Semua) 🔀"}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "easy", label: "Mudah (Mega Hits) 🟢", desc: "Lagu viral & hits sejuta umat" },
                  { id: "medium", label: "Sedang (Populer) 🟡", desc: "Hits radio & single album" },
                  { id: "hard", label: "Sulit (Sepuh) 🔴", desc: "Deep cuts & b-side buat sepuh" },
                  { id: "all", label: "Campur (Semua) 🔀", desc: "Koleksi lengkap acak" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setModalDifficulty(d.id)}
                    className={`py-2 px-2.5 rounded-xl text-left transition flex flex-col ${
                      modalDifficulty === d.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">{d.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tipe Suara / Audio Profile */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>3. TIPE SUARA / AUDIO PROFILE</span>
                <span className="text-accent font-bold">
                  {modalAudioProfile === "normal"
                    ? "Datar / Robotik 🤖"
                    : modalAudioProfile === "bass"
                    ? "Bass Booster 🔊"
                    : "Cepat / Chipmunk ⚡"}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "normal", label: "Datar 🤖", desc: "Monotone" },
                  { id: "bass", label: "Bass 🔊", desc: "Berat & Low" },
                  { id: "fast", label: "Cepat ⚡", desc: "Chipmunk" },
                ].map((ap) => (
                  <button
                    key={ap.id}
                    type="button"
                    onClick={() => setModalAudioProfile(ap.id)}
                    className={`py-2 px-2 rounded-xl text-center transition flex flex-col items-center ${
                      modalAudioProfile === ap.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">{ap.label}</span>
                    <span className="text-[9px] opacity-75 font-mono">{ap.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 4. Jumlah Ronde */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>4. JUMLAH RONDE</span>
                <span className="text-accent font-bold">{modalRounds} Ronde</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[3, 5, 10, 15].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setModalRounds(r)}
                    className={`py-2 px-2 rounded-xl text-center transition text-xs font-semibold ${
                      modalRounds === r
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {r} Ronde
                  </button>
                ))}
              </div>
            </div>

            {/* Action CTA Button */}
            <button
              onClick={handleStartGame}
              className="w-full mt-2 bg-accent hover:bg-green-500 text-zinc-950 font-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md shadow-accent/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai Main Sekarang ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* Minimal Editorial Footer */}
      <footer className="w-full pt-6 border-t border-surfaceBorder flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-mutedDark font-mono">
        <p>Tebak Lagu · Audio Trivia Engine</p>
        <div className="flex items-center gap-3">
          <Link href="/admin" className="hover:text-accent flex items-center gap-1 transition-colors text-zinc-400">
            <Settings className="w-3.5 h-3.5" />
            <span>Studio Admin</span>
          </Link>
          <span>•</span>
          <p>Komunitas Pecinta Musik 🎧</p>
        </div>
      </footer>
    </div>
  );
}
