"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  Save,
  LogOut,
  Music4,
  Target,
  Trophy,
  Award,
  Gamepad2,
  Camera,
  Sparkles,
  Check,
  X,
  Upload,
  RotateCcw,
  Zap,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";

interface Stats {
  user: {
    name: string;
    bio: string;
    favorite_artist: string;
    avatar?: string;
    total_score: number;
    games_played: number;
    wins: number;
  };
  summary: {
    totalScore: number;
    gamesPlayed: number;
    wins: number;
    winRate: number;
    gamesLogged: number;
    bestScore: number;
  };
  byMode: Record<string, { games: number; best: number; total: number }>;
  bestEntry: { score: number; mode: string; category: string; difficulty: string; at: string } | null;
  recent: { score: number; mode: string; difficulty: string; at: string }[];
}

const MODE_LABEL: Record<string, string> = {
  heardle: "Time Slice (Heardle)",
  tts: "Robot Speech (TTS)",
};

// Preset music avatar collection (DiceBear & cool styles)
const AVATAR_PRESETS = [
  { id: "dj", name: "DJ Vinyl", url: "https://api.dicebear.com/7.x/bottts/svg?seed=DJVinyl&backgroundColor=121215" },
  { id: "rock", name: "Gitaris Rock", url: "https://api.dicebear.com/7.x/bottts/svg?seed=RockStar&backgroundColor=121215" },
  { id: "synth", name: "Synth Maestro", url: "https://api.dicebear.com/7.x/bottts/svg?seed=SynthWave&backgroundColor=121215" },
  { id: "diva", name: "Pop Star", url: "https://api.dicebear.com/7.x/bottts/svg?seed=PopDiva&backgroundColor=121215" },
  { id: "robot", name: "Cyber Beat", url: "https://api.dicebear.com/7.x/bottts/svg?seed=CyberBeat&backgroundColor=121215" },
  { id: "king", name: "Juara Nada", url: "https://api.dicebear.com/7.x/bottts/svg?seed=MusicKing&backgroundColor=121215" },
  { id: "retro", name: "Retro Cassette", url: "https://api.dicebear.com/7.x/bottts/svg?seed=RetroCassette&backgroundColor=121215" },
  { id: "jazz", name: "Jazz Master", url: "https://api.dicebear.com/7.x/bottts/svg?seed=JazzCat&backgroundColor=121215" },
];

function getPlayerRank(score: number): { title: string; color: string; bg: string } {
  if (score >= 7000) return { title: "👑 Dewa Trivia Musik", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30" };
  if (score >= 3500) return { title: "🔥 Telinga Emas", color: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/30" };
  if (score >= 1500) return { title: "⚡ Pemburu Nada", color: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/30" };
  if (score >= 500) return { title: "🎧 Penikmat Lagu", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30" };
  return { title: "🎵 Pendengar Santai", color: "text-zinc-400", bg: "bg-zinc-800/40 border-zinc-700/50" };
}

export default function ProfilePage() {
  const { user, isLoggedIn, isLoading, logout, saveProfile } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(false);

  // Edit fields
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [favorite, setFavorite] = useState("");
  const [currentAvatar, setCurrentAvatar] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Avatar Modal State
  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoggedIn || !user) return;
    setName(user.name || "");
    setBio(user.bio || "");
    setFavorite(user.favorite_artist || "");
    setCurrentAvatar(user.avatar || "");
    setAvatarPreview(user.avatar || "");

    setStatsLoading(true);
    fetch("/api/auth/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data) => {
        setStats(data);
        setStatsError(false);
      })
      .catch(() => setStatsError(true))
      .finally(() => setStatsLoading(false));
  }, [isLoggedIn, user]);

  // Client-side image resize via HTML5 canvas to keep size tiny (< 40KB)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Harap pilih file gambar (JPG, PNG, atau WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const size = 160;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Cover crop centered
        const minDim = Math.min(img.width, img.height);
        const sx = (img.width - minDim) / 2;
        const sy = (img.height - minDim) / 2;

        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
        const dataUrl = canvas.toDataURL("image/webp", 0.85);
        setAvatarPreview(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleApplyAvatar = async () => {
    setCurrentAvatar(avatarPreview);
    setShowAvatarModal(false);
    // Auto-save avatar change to DB
    await saveProfile({
      name: name.trim() || user?.name,
      bio,
      favoriteArtist: favorite,
      avatar: avatarPreview,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveTextProfile = async () => {
    if (!name.trim()) {
      setErrorMsg("Nama tampilan tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setErrorMsg(null);

    const ok = await saveProfile({
      name: name.trim(),
      bio: bio.trim(),
      favoriteArtist: favorite.trim(),
      avatar: currentAvatar,
    });

    setSaving(false);
    if (ok) {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } else {
      setErrorMsg("Gagal menyimpan profil. Coba lagi.");
    }
  };

  // ==============================================================
  // LOADING STATE
  // ==============================================================
  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-[#0c0c0f] text-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-mono text-zinc-400">Memuat profil…</p>
        </div>
      </div>
    );
  }

  // ==============================================================
  // LOGGED OUT PROMPT
  // ==============================================================
  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-[100dvh] bg-[#0c0c0f] text-zinc-100 flex flex-col justify-between p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
        <header className="w-full flex items-center justify-between pb-6 border-b border-zinc-800/80">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-mono transition"
          >
            <ChevronLeft className="w-4 h-4" /> Menu Utama
          </Link>
          <span className="text-xs font-mono font-bold text-accent">TEBAK LAGU</span>
        </header>

        <main className="my-auto py-12 flex flex-col items-center text-center gap-6 max-w-md mx-auto">
          <div className="w-20 h-20 rounded-3xl bg-accent/10 border border-accent/30 text-accent flex items-center justify-center shadow-2xl shadow-accent/20">
            <Music4 className="w-10 h-10" />
          </div>

          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">Profil &amp; Statistik Pemain</h1>
            <p className="text-xs text-zinc-400 leading-relaxed mt-2">
              Masuk dengan akun Google untuk membuka profil lengkap, melacak rekor skor, mengubah avatar kustom, dan bersaing di Papan Peringkat!
            </p>
          </div>

          <div className="w-full bg-zinc-900/80 border border-zinc-800 rounded-3xl p-5 flex flex-col gap-3 text-left text-xs text-zinc-300">
            <div className="flex items-center gap-3">
              <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Simpan skor permanen di Leaderboard Nasional</span>
            </div>
            <div className="flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-accent shrink-0" />
              <span>Kustomisasi foto avatar &amp; biodata musik</span>
            </div>
            <div className="flex items-center gap-3">
              <Target className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Statistik akurasi tebakan &amp; performa per mode</span>
            </div>
          </div>

          <div className="pt-2">
            <GoogleAuthButton />
          </div>
        </main>

        <footer className="w-full text-center text-[11px] font-mono text-zinc-500 pt-6 pb-20 border-t border-zinc-800/60">
          Tebak Lagu · Audio Trivia Platform
        </footer>
      </div>
    );
  }

  // ==============================================================
  // LOGGED IN DASHBOARD
  // ==============================================================
  const rank = getPlayerRank(user.total_score);

  return (
    <div className="min-h-[100dvh] bg-[#0c0c0f] text-zinc-100 flex flex-col items-center px-4 py-6 sm:py-8 max-w-3xl w-full mx-auto">
      {/* Top Navbar */}
      <header className="w-full flex items-center justify-between pb-5 border-b border-zinc-800/80 mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white text-xs font-mono transition"
        >
          <ChevronLeft className="w-4 h-4" /> Menu Utama
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/leaderboard"
            className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-amber-400 text-xs font-mono transition bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-full"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-400" />
            <span>Leaderboard</span>
          </Link>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1 text-xs font-mono text-zinc-400 hover:text-rose-400 transition"
            title="Keluar Akun"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Profile Header Card */}
      <div className="w-full bg-[#121216] border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row items-center sm:items-start gap-6 relative shadow-2xl overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />

        {/* Interactive Avatar with Camera Upload Badge */}
        <div className="relative group shrink-0">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-zinc-900 border-2 border-zinc-700/80 overflow-hidden shadow-xl flex items-center justify-center">
            {currentAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={currentAvatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-accent/20 text-accent flex items-center justify-center font-black text-3xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Edit Avatar Overlay Button */}
          <button
            type="button"
            onClick={() => {
              setAvatarPreview(currentAvatar);
              setShowAvatarModal(true);
            }}
            className="absolute -bottom-2 -right-2 p-2.5 rounded-2xl bg-accent hover:bg-emerald-400 text-zinc-950 font-bold shadow-lg shadow-accent/25 transition active:scale-90 cursor-pointer"
            title="Ganti Foto Avatar"
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Identity & Badges */}
        <div className="flex-1 text-center sm:text-left min-w-0">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5 mb-1.5">
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight truncate">
              {user.name}
            </h1>
            <span
              className={`text-[11px] font-mono font-bold px-3 py-0.5 rounded-full border ${rank.bg} ${rank.color}`}
            >
              {rank.title}
            </span>
          </div>

          <p className="text-xs font-mono text-zinc-400">{user.email}</p>

          {user.bio ? (
            <p className="text-xs text-zinc-300 italic mt-2.5 max-w-lg leading-relaxed bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
              &ldquo;{user.bio}&rdquo;
            </p>
          ) : (
            <p className="text-xs text-zinc-500 italic mt-2">Belum ada bio. Tulis gaya musikmu di bawah!</p>
          )}

          {user.favorite_artist && (
            <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-mono text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full">
              <Zap className="w-3 h-3" />
              <span>Artis Favorit: {user.favorite_artist}</span>
            </div>
          )}
        </div>
      </div>

      {/* Primary Key Stats Grid */}
      <div className="w-full mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Total Skor</span>
            <Trophy className="w-4 h-4 text-accent" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {stats?.summary?.totalScore ?? user.total_score}
          </p>
          <span className="text-[10px] font-mono text-accent mt-0.5">Poin Akumulasi</span>
        </div>

        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Game</span>
            <Gamepad2 className="w-4 h-4 text-sky-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {stats?.summary?.gamesPlayed ?? user.games_played}
          </p>
          <span className="text-[10px] font-mono text-zinc-400 mt-0.5">Pertandingan</span>
        </div>

        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Menang</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {stats?.summary?.wins ?? user.wins}
          </p>
          <span className="text-[10px] font-mono text-amber-400 mt-0.5">Kemenangan</span>
        </div>

        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-4 sm:p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-[10px] font-mono uppercase tracking-wider font-semibold">Win Rate</span>
            <Target className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono mt-2">
            {stats?.summary?.winRate ?? 0}%
          </p>
          <span className="text-[10px] font-mono text-purple-400 mt-0.5">Rasio Sukses</span>
        </div>
      </div>

      {/* Mode Breakdown & Best Performance */}
      <div className="w-full mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Mode Performance Cards */}
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Music4 className="w-4 h-4 text-accent" /> Performa Mode Game
          </h2>

          <div className="space-y-3">
            {["heardle", "tts"].map((modeKey) => {
              const m = stats?.byMode?.[modeKey] || { games: 0, best: 0, total: 0 };
              return (
                <div key={modeKey} className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{MODE_LABEL[modeKey]}</span>
                    <span className="text-xs font-mono text-accent font-bold">{m.total} pts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 mt-2 pt-2 border-t border-zinc-800/80">
                    <span>{m.games} kali main</span>
                    <span>Rekor: {m.best} pts</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Best Entry & Form */}
        <div className="bg-[#121216] border border-zinc-800 rounded-3xl p-5 sm:p-6 flex flex-col gap-4">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Rekor Tertinggi
          </h2>

          {stats?.bestEntry ? (
            <div className="bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/30 rounded-2xl p-4 flex flex-col gap-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold">
                Skor Terbaik Sekali Ronde
              </span>
              <p className="text-3xl font-black text-white font-mono">
                {stats.bestEntry.score} <span className="text-sm font-normal text-zinc-400">poin</span>
              </p>
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-300 mt-1">
                <span>{MODE_LABEL[stats.bestEntry.mode] ?? stats.bestEntry.mode}</span>
                <span>•</span>
                <span className="capitalize">{stats.bestEntry.difficulty}</span>
              </div>
            </div>
          ) : (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 text-center text-xs text-zinc-400 font-mono">
              Belum ada rekor tercatat. Mainkan satu game untuk mencatat rekor!
            </div>
          )}

          {/* Form Terakhir (5 match bar chart) */}
          {stats?.recent && stats.recent.length > 0 && (
            <div className="pt-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-2">
                Riwayat 5 Match Terakhir
              </span>
              <div className="flex items-end gap-2 h-14 bg-zinc-900/60 p-2.5 rounded-2xl border border-zinc-800/80">
                {stats.recent
                  .slice()
                  .reverse()
                  .map((r, i) => {
                    const maxScore = Math.max(...stats.recent.map((x) => x.score), 1);
                    const barHeight = Math.max(8, (r.score / maxScore) * 36);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <div
                          className="w-full rounded-md bg-accent/80 hover:bg-accent transition"
                          style={{ height: `${barHeight}px` }}
                          title={`${r.score} poin (${r.mode} - ${r.difficulty})`}
                        />
                        <span className="text-[9px] font-mono text-zinc-400">{r.score}</span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="w-full mt-6 bg-[#121216] border border-zinc-800 rounded-3xl p-6 sm:p-7 space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
          <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-400 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" /> Edit Profil Pemain
          </h2>
          <span className="text-[11px] font-mono text-zinc-500">Kustomisasi identitas musikmu</span>
        </div>

        {/* Input Nama */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-mono text-zinc-400 font-semibold">Nama Tampilan</label>
            <span className="text-[10px] font-mono text-zinc-500">{name.length}/40</span>
          </div>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="Ketik nama tampilanmu..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent transition font-medium"
          />
        </div>

        {/* Input Artis Favorit */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-mono text-zinc-400 font-semibold">Penyanyi / Band Favorit</label>
            <span className="text-[10px] font-mono text-zinc-500">{favorite.length}/60</span>
          </div>
          <input
            type="text"
            value={favorite}
            onChange={(e) => setFavorite(e.target.value)}
            maxLength={60}
            placeholder="misal: Sheila On 7, Dewa 19, Tulus, Taylor Swift"
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-4 py-3 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent transition font-medium"
          />
        </div>

        {/* Input Bio */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label className="text-[11px] font-mono text-zinc-400 font-semibold">Biodata Singkat</label>
            <span className="text-[10px] font-mono text-zinc-500">{bio.length}/200</span>
          </div>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ceritakan seleramu, genre favorit, atau motto musik..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-4 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent transition font-medium resize-none leading-relaxed"
          />
        </div>

        {errorMsg && (
          <div className="bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs p-3 rounded-2xl">
            {errorMsg}
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveTextProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 bg-accent hover:bg-emerald-400 disabled:opacity-50 text-zinc-950 font-bold text-sm rounded-2xl px-6 py-3 transition active:scale-95 shadow-lg shadow-accent/20 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? "Menyimpan…" : "Simpan Perubahan"}</span>
            </button>

            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-accent font-semibold animate-fade-in">
                <Check className="w-4 h-4" /> Profil tersimpan!
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-500 hover:text-rose-400 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar Akun</span>
          </button>
        </div>
      </div>

      {/* ==============================================================
          AVATAR PICKER MODAL
         ============================================================== */}
      {showAvatarModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div
            className="relative w-full max-w-md bg-[#121216] border border-zinc-800 rounded-3xl p-6 sm:p-7 shadow-2xl flex flex-col gap-5 animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-accent" />
                <h3 className="font-bold text-white text-base">Ganti Foto Profil</h3>
              </div>
              <button
                onClick={() => setShowAvatarModal(false)}
                className="p-1.5 rounded-full text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Current Selected Preview */}
            <div className="flex flex-col items-center gap-2">
              <div className="w-20 h-20 rounded-3xl bg-zinc-900 border-2 border-accent overflow-hidden shadow-lg flex items-center justify-center">
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Music4 className="w-8 h-8 text-accent" />
                )}
              </div>
              <span className="text-[11px] font-mono text-zinc-400">Pratinjau Avatar Terpilih</span>
            </div>

            {/* Upload File Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer"
              >
                <Upload className="w-4 h-4 text-accent" />
                <span>Upload Foto dari Perangkat (JPG/PNG/WebP)</span>
              </button>
            </div>

            {/* Presets Grid */}
            <div>
              <span className="text-[11px] font-mono text-zinc-400 font-semibold block mb-2">
                Atau Pilih Avatar Musik Keren:
              </span>
              <div className="grid grid-cols-4 gap-2.5">
                {AVATAR_PRESETS.map((preset) => {
                  const isSelected = avatarPreview === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setAvatarPreview(preset.url)}
                      className={`p-1.5 rounded-2xl border-2 transition active:scale-95 flex flex-col items-center gap-1 cursor-pointer ${
                        isSelected
                          ? "border-accent bg-accent/15"
                          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-zinc-950">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] font-mono text-zinc-300 truncate w-full text-center">
                        {preset.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/80">
              <button
                type="button"
                onClick={handleApplyAvatar}
                className="flex-1 py-3 rounded-2xl bg-accent hover:bg-emerald-400 text-zinc-950 font-bold text-xs transition active:scale-95 shadow-md shadow-accent/20 cursor-pointer"
              >
                Terapkan Avatar Ini
              </button>
              <button
                type="button"
                onClick={() => setShowAvatarModal(false)}
                className="px-4 py-3 rounded-2xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold border border-zinc-800 transition cursor-pointer"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-8 pb-20 text-center text-[11px] font-mono text-zinc-500 flex items-center gap-2 justify-center">
        <TrendingUp className="w-3.5 h-3.5 text-accent" />
        <span>Skor &amp; statistik tersimpan otomatis setiap selesai bermain</span>
      </footer>
    </div>
  );
}
