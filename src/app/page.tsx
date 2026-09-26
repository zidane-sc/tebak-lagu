"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { SocialShareModal } from "@/components/SocialShareModal";
import { AudioWaveformVisualizer } from "@/components/AudioWaveformVisualizer";
import { VinylPlayer } from "@/components/VinylPlayer";
import { sfx } from "@/lib/sound-fx";
import {
  Mic,
  Music,
  Timer,
  Volume2,
  Trophy,
  ArrowRight,
  ArrowUpRight,
  Disc3,
  Zap,
  X,
  Play,
  Settings,
  Share2,
  Sparkles,
  Flame,
  Radio,
  Gamepad2,
  Users,
} from "lucide-react";
import { CATEGORIES } from "@/data/songs";

const GAME_MODES = [
  {
    id: "heardle",
    index: "01",
    title: "Time Slice (Heardle)",
    tagline: "Audio Attack 5s ➔ 30s",
    description:
      "Tebak lagu dari potongan audio bertahap: 5 detik, 9 detik, 18 detik, hingga 30 detik. Uji kecepatan pendengaranmu!",
    icon: Timer,
    badge: "⏱️ POTONGAN AUDIO",
    color: "emerald",
    bgGradient: "from-emerald-500/15 via-surface to-cyan-500/5",
    borderColor: "border-emerald-500/30 hover:border-emerald-400/60",
    glowClass: "hover:shadow-emerald-500/20",
    accentText: "text-emerald-400",
    btnBg: "bg-emerald-400 hover:bg-emerald-300 text-zinc-950",
  },
  {
    id: "tts",
    index: "02",
    title: "Robot Speech (TTS)",
    tagline: "Blind Lirik Puisi Datar",
    description:
      "Dengarkan robot pintar membacakan bait lirik kaku tanpa melodi (Indo & English). Murni tes memori kata-kata!",
    icon: Volume2,
    badge: "🤖 BLIND AUDIO TEST",
    color: "purple",
    bgGradient: "from-purple-500/15 via-surface to-fuchsia-500/5",
    borderColor: "border-purple-500/30 hover:border-purple-400/60",
    glowClass: "hover:shadow-purple-500/20",
    accentText: "text-purple-400",
    btnBg: "bg-purple-400 hover:bg-purple-300 text-zinc-950",
  },
];

export default function HomePage() {
  const router = useRouter();
  const [score, setScore] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);

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
    <div className="min-h-[100dvh] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-4xl mx-auto selection:bg-accentDim selection:text-accent relative">
      {/* Top Floating Glass Header */}
      <header className="w-full flex items-center justify-between p-3 sm:p-4 rounded-2xl glass-panel shadow-lg shadow-black/20 z-10">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-zinc-950 border border-emerald-500/50 overflow-hidden flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="Tebak Lagu" className="w-full h-full object-cover" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight neon-shimmer">
                TEBAK LAGU
              </span>
              <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent font-bold shrink-0">
                LIVE
              </span>
            </div>
            <p className="text-[11px] text-muted leading-none mt-0.5">Jukebox Audio Trivia</p>
          </div>
        </div>

        {/* Global Player Stats & Google Login */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowShareModal(true)}
            className="w-10 h-10 rounded-xl bg-surfaceRaised/80 hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white flex items-center justify-center transition active:scale-95 cursor-pointer shadow-sm shrink-0"
            title="Bagikan ke Teman (WA, IG, TikTok)"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <GoogleAuthButton />
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full my-auto py-5 sm:py-8 flex flex-col gap-5 sm:gap-7 z-10">
        {/* Eye-Catching Hero Section with Animated Turntable & Audio Waveform */}
        <div className="flex flex-col items-center text-center gap-3 pt-1">
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-emerald-500/15 via-purple-500/15 to-amber-500/15 border border-white/10 text-zinc-300 text-[11px] sm:text-xs font-mono font-medium shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-accent shrink-0 animate-pulse" />
            <span>4.619+ Lagu Hits & Kolaborasi Indonesia/Barat</span>
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white max-w-2xl leading-[1.18]">
            Adu Telinga Dewa, <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Tebak Lagu Tercepat!
            </span>
          </h1>

          {/* Interactive Glowing Vinyl Turntable Centerpiece */}
          <div className="my-1 relative flex items-center justify-center">
            <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/20 via-purple-500/20 to-amber-500/20 rounded-full blur-2xl -z-10" />
            <VinylPlayer isPlaying={true} label="Tebak Lagu Live" size="sm" />
          </div>

          <p className="text-xs sm:text-sm text-zinc-400 max-w-lg leading-relaxed px-1">
            Kenali musik lewat potongan audio detik bertahap, bait puisi robotik datar, dan adu cepat tombol buzzer real-time bareng teman!
          </p>

          {/* Micro Equalizer Preview Deck */}
          <div className="w-full max-w-[280px] sm:max-w-xs bg-surfaceRaised/50 border border-surfaceBorder rounded-2xl p-2 px-3 sm:px-4 flex items-center justify-between shadow-inner">
            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1.5 shrink-0">
              <Radio className="w-3 h-3 text-accent animate-pulse" />
              <span>FREKUENSI AUDIO</span>
            </span>
            <AudioWaveformVisualizer isPlaying={true} variant="cyberpunk" barCount={16} height={20} />
          </div>
        </div>

        {/* 🌟 HERO CARD: MULTIPLAYER LIVE BUZZER (VIP GOLD CARD) */}
        <Link
          href="/multiplayer"
          className="group relative bg-gradient-to-r from-amber-500/15 via-surface to-orange-500/10 hover:from-amber-500/25 hover:via-surfaceRaised hover:to-orange-500/20 border-2 border-amber-500/40 hover:border-amber-400 rounded-3xl p-5 transition-all duration-300 flex flex-col gap-4 shadow-xl shadow-amber-500/10 glow-amber cursor-pointer active:scale-[0.99] overflow-hidden"
        >
          <div className="flex items-center gap-3.5">
            {/* 3D Buzzer Arcade Icon */}
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 border border-amber-300/60 flex items-center justify-center text-zinc-950 shadow-lg shadow-amber-500/30 shrink-0 group-hover:scale-105 transition-transform">
              <Zap className="w-6 h-6 sm:w-7 sm:h-7 fill-current" />
            </div>

            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-mono font-black px-2.5 py-0.5 rounded-full bg-amber-400 text-zinc-950 uppercase tracking-wider shadow-sm shrink-0">
                  LIVE BUZZER
                </span>
                <span className="text-xs font-mono text-amber-300/90 font-semibold">
                  Mabar 2-8 Orang 👥
                </span>
              </div>
              <h3 className="text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-amber-300 transition-colors">
                Ruangan Tanding Real-Time
              </h3>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed">
            Pencet tombol buzzer fisik, ledek teman dengan SFX meme soundboard, dan adu podium juara!
          </p>

          <div className="w-full pt-1">
            <span className="w-full py-3 px-5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-zinc-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/30 transition group-hover:translate-x-1">
              <span>Masuk Room Mabar</span>
              <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </Link>

        {/* SOLO GAME MODES (JUICY ARCADE CARDS: STACKED ON MOBILE, 2-COL ON DESKTOP) */}
        <div className="flex flex-col md:grid md:grid-cols-2 gap-4">
          {GAME_MODES.map((mode) => {
            const Icon = mode.icon;

            return (
              <button
                type="button"
                key={mode.id}
                onClick={() => setConfigModalMode(mode)}
                className={`group relative bg-gradient-to-br ${mode.bgGradient} border ${mode.borderColor} rounded-3xl p-5 transition-all duration-300 flex flex-col justify-between gap-4 text-left cursor-pointer shadow-lg hover:shadow-2xl ${mode.glowClass} active:scale-[0.99] overflow-hidden`}
              >
                {/* Header */}
                <div className="flex flex-col gap-2.5 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] text-mutedDark font-bold uppercase tracking-wider">
                      SOLO MODE {mode.index}
                    </span>
                    <span className={`text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 ${mode.accentText} shrink-0`}>
                      {mode.badge}
                    </span>
                  </div>

                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-surfaceRaised/90 border border-white/10 flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-md shrink-0">
                      <Icon className={`w-6 h-6 ${mode.accentText}`} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-white tracking-tight group-hover:text-accent transition-colors">
                        {mode.title}
                      </h3>
                      <p className="text-xs font-semibold text-zinc-300">
                        {mode.tagline}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body Description */}
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {mode.description}
                </p>

                {/* Action CTA */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs w-full gap-2">
                  <span className="font-mono text-[11px] text-zinc-400 truncate">
                    Atur Kategori & Ronde
                  </span>
                  <div className="flex items-center gap-1.5 font-bold text-white group-hover:translate-x-1 transition-transform shrink-0">
                    <span>Mainkan</span>
                    <ArrowRight className={`w-4 h-4 ${mode.accentText}`} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Community & Leaderboard Quick Link */}
        <Link
          href="/leaderboard"
          className="w-full bg-surface/70 hover:bg-surfaceRaised border border-surfaceBorder hover:border-amber-400/40 rounded-2xl p-4 transition-all flex items-center justify-between gap-3 shadow-sm group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-400 shrink-0">
              <Trophy className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-white tracking-tight">
                  Papan Peringkat Nasional
                </h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold shrink-0">
                  TOP SKOR
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5 leading-relaxed">
                Lihat pemain juara dengan telinga dewa dan rekor mingguan!
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs font-semibold text-muted group-hover:text-amber-400 font-mono pr-1 transition-colors shrink-0">
            <ArrowUpRight className="w-5 h-5" />
          </div>
        </Link>
      </main>

      {/* Pre-Game Configuration Modal (Single Player) */}
      {configModalMode && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-3xl p-5 sm:p-6 max-w-md w-full flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent shadow-sm">
                  {React.createElement(configModalMode.icon, { className: "w-5 h-5" })}
                </div>
                <div>
                  <h3 className="text-base font-black text-white leading-tight">
                    {configModalMode.title}
                  </h3>
                  <span className="text-xs text-muted font-mono">
                    {configModalMode.tagline}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setConfigModalMode(null)}
                className="w-8 h-8 rounded-full text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder flex items-center justify-center transition"
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
                  "Semua Genre",
                  "Galau Hits",
                  "Nostalgia 2000s",
                  "Anthem Tongkrongan",
                  "Pop Jawa & Koplo",
                  "Western Hits",
                ].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setModalCategory(cat)}
                    className={`py-2 px-2.5 rounded-xl text-left transition text-xs font-semibold truncate ${
                      modalCategory === cat
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. Tingkat Kesulitan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>2. TINGKAT KESULITAN</span>
                <span className="text-emerald-400 font-bold uppercase font-mono text-[10px]">
                  {modalDifficulty === "easy"
                    ? "🟢 Mudah (Mega Hits)"
                    : modalDifficulty === "medium"
                    ? "🟡 Sedang (Populer)"
                    : modalDifficulty === "hard"
                    ? "🔴 Sulit (Sepuh)"
                    : "🔀 Campur"}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "easy", label: "🟢 Mudah" },
                  { id: "medium", label: "🟡 Sedang" },
                  { id: "hard", label: "🔴 Sulit" },
                ].map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setModalDifficulty(d.id)}
                    className={`py-2 px-2 rounded-xl text-center transition text-xs font-semibold ${
                      modalDifficulty === d.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Tipe Suara (Hanya untuk TTS) */}
            {configModalMode.id === "tts" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                  <span>3. TIPE SUARA ROBOT</span>
                  <span className="text-accent font-bold">
                    {modalAudioProfile === "normal"
                      ? "Datar"
                      : modalAudioProfile === "bass"
                      ? "Bass Booster"
                      : "Cepat"}
                  </span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "normal", label: "🤖 Datar" },
                    { id: "bass", label: "🔊 Bass" },
                    { id: "fast", label: "⚡ Cepat" },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setModalAudioProfile(p.id)}
                      className={`py-2 px-2 rounded-xl text-center transition text-xs font-semibold ${
                        modalAudioProfile === p.id
                          ? "bg-zinc-100 text-zinc-950 shadow-sm"
                          : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Jumlah Ronde */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>{configModalMode.id === "tts" ? "4. JUMLAH RONDE" : "3. JUMLAH RONDE"}</span>
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
              className="w-full mt-2 bg-accent hover:bg-green-500 text-zinc-950 font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-xl shadow-accent/25 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Mulai Main Sekarang ➔</span>
            </button>
          </div>
        </div>
      )}

      {/* Minimal Editorial Footer */}
      <footer className="w-full pt-6 pb-4 border-t border-surfaceBorder/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-mutedDark font-mono z-10 text-center sm:text-left">
        <p>Tebak Lagu · Audio Trivia Engine</p>
        <div className="flex items-center justify-center gap-2.5 sm:gap-3 flex-wrap">
          <Link href="/leaderboard" className="hover:text-amber-400 flex items-center gap-1 transition-colors text-zinc-400 py-1 px-1.5">
            <Trophy className="w-3.5 h-3.5" />
            <span>Papan Peringkat</span>
          </Link>
          <span>•</span>
          <Link href="/admin" className="hover:text-accent flex items-center gap-1 transition-colors text-zinc-400 py-1 px-1.5">
            <Settings className="w-3.5 h-3.5" />
            <span>Studio Admin</span>
          </Link>
          <span>•</span>
          <p className="text-zinc-500 py-1">Komunitas Musik 🎧</p>
        </div>
      </footer>

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Ajak Teman Main Tebak Lagu"
        score={score}
        modeTitle="Adu Telinga Dewa"
        shareUrl="https://tebak-lagu-live.fly.dev/"
      />
    </div>
  );
}
