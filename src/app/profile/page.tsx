"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Save, LogOut, Music4, Target, Trophy, TrendingUp } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Stats {
  user: {
    name: string;
    bio: string;
    favorite_artist: string;
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
  heardle: "Time Slice",
  tts: "Robot Speech",
};

export default function ProfilePage() {
  const { user, isLoggedIn, isLoading, logout, saveProfile } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [favorite, setFavorite] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    setName(user?.name ?? "");
    setBio(user?.bio ?? "");
    setFavorite(user?.favorite_artist ?? "");

    fetch("/api/auth/stats")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setStats)
      .catch(() => setStatsError(true));
  }, [isLoggedIn, user?.id, user?.name, user?.bio, user?.favorite_artist]);

  useEffect(() => {
    if (!isLoading && !isLoggedIn) router.replace("/");
  }, [isLoading, isLoggedIn, router]);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background text-zinc-100 flex items-center justify-center">
        <p className="text-sm font-mono text-muted">Memuat profil…</p>
      </div>
    );
  }

  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-[100dvh] bg-background text-zinc-100 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <p className="text-sm text-muted">Kamu belum masuk.</p>
          <Link href="/" className="inline-flex items-center gap-1 text-accent text-sm font-mono">
            <ChevronLeft className="w-4 h-4" /> Kembali ke game
          </Link>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setError(null);
    const ok = await saveProfile({
      name: name.trim(),
      bio,
      favoriteArtist: favorite,
    });
    setSaving(false);
    if (ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError("Gagal menyimpan profil.");
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col items-center px-4 py-8 max-w-2xl w-full mx-auto">
      <Link
        href="/"
        className="self-start inline-flex items-center gap-1 text-muted hover:text-white text-sm font-mono transition mb-6"
      >
        <ChevronLeft className="w-4 h-4" /> Kembali
      </Link>

      {/* Identity */}
      <div className="w-full bg-surface border border-surfaceBorder rounded-2xl p-6 flex flex-col items-center gap-3">
        {user.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.avatar}
            alt=""
            className="w-20 h-20 rounded-2xl object-cover border border-surfaceBorder"
          />
        ) : (
          <div className="w-20 h-20 rounded-2xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center">
            <Music4 className="w-8 h-8 text-accent" />
          </div>
        )}
        <div className="text-center">
          <h1 className="text-xl font-black text-white">{user.name}</h1>
          <p className="text-xs font-mono text-mutedDark mt-0.5">{user.email}</p>
        </div>
        {user.favorite_artist && (
          <span className="text-[11px] font-mono text-accent border border-accent/30 bg-accent/10 rounded-full px-3 py-1">
            Fav: {user.favorite_artist}
          </span>
        )}
      </div>

      {/* Statistics */}
      {statsError ? (
        <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-4 text-xs text-muted font-mono">
          Statistik belum bisa dimuat.
        </div>
      ) : stats ? (
        <>
          <div className="w-full mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Total Skor" value={stats.summary.totalScore} />
            <Stat label="Game" value={stats.summary.gamesPlayed} />
            <Stat label="Menang" value={`${stats.summary.wins}`} />
            <Stat label="Win Rate" value={`${stats.summary.winRate}%`} />
          </div>

          <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-5 space-y-4">
            <h2 className="text-xs font-mono uppercase tracking-widest text-mutedDark">
              Per Mode
            </h2>
            {Object.keys(stats.byMode).length === 0 ? (
              <p className="text-xs text-muted">
                Belum ada permainan tercatat. Selesaikan satu ronde untuk muncul di sini.
              </p>
            ) : (
              Object.entries(stats.byMode).map(([mode, v]) => (
                <div key={mode} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-200">{MODE_LABEL[mode] ?? mode}</span>
                  <span className="font-mono text-xs text-muted">
                    {v.games} main · terbaik {v.best}
                  </span>
                </div>
              ))
            )}
          </div>

          {stats.bestEntry && (
            <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-5 flex items-center gap-3">
              <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-widest text-mutedDark">
                  Skor terbaik
                </p>
                <p className="text-lg font-black text-white">
                  {stats.bestEntry.score}
                  <span className="text-xs font-normal text-muted ml-2">
                    {MODE_LABEL[stats.bestEntry.mode] ?? stats.bestEntry.mode} ·{" "}
                    {stats.bestEntry.difficulty}
                  </span>
                </p>
              </div>
            </div>
          )}

          {stats.recent.length > 0 && (
            <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-5 space-y-3">
              <h2 className="text-xs font-mono uppercase tracking-widest text-mutedDark">
                Form Terakhir
              </h2>
              <div className="flex items-end gap-2 h-16">
                {stats.recent
                  .slice()
                  .reverse()
                  .map((r, i) => {
                    const max = Math.max(...stats.recent.map((x) => x.score), 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-accent/70"
                          style={{ height: `${Math.max(6, (r.score / max) * 48)}px` }}
                          title={`${r.score} · ${r.mode} · ${r.difficulty}`}
                        />
                        <span className="text-[9px] font-mono text-mutedDark">
                          {r.score}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-4 text-xs text-muted font-mono">
          Memuat statistik…
        </div>
      )}

      {/* Edit form */}
      <div className="w-full mt-4 bg-surface border border-surfaceBorder rounded-2xl p-5 space-y-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-mutedDark flex items-center gap-2">
          <Target className="w-3.5 h-3.5" /> Edit Profil
        </h2>

        <label className="block">
          <span className="text-[11px] font-mono text-muted">Nama tampilan</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="mt-1 w-full bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-mono text-muted">Artis favorit</span>
          <input
            value={favorite}
            onChange={(e) => setFavorite(e.target.value)}
            maxLength={60}
            placeholder="mis. Dewa 19"
            className="mt-1 w-full bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-accent"
          />
        </label>

        <label className="block">
          <span className="text-[11px] font-mono text-muted">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={200}
            rows={3}
            placeholder="Ceritakan gaya musikmu…"
            className="mt-1 w-full bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-accent resize-none"
          />
        </label>

        {error && <p className="text-xs text-rose-400 font-mono">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 bg-accent hover:bg-green-500 text-zinc-950 font-bold text-sm rounded-xl px-4 py-2.5 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            {saving ? "Menyimpan…" : "Simpan"}
          </button>
          {saved && (
            <span className="text-xs font-mono text-accent">Tersimpan.</span>
          )}
          <button
            onClick={logout}
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-mono text-muted hover:text-white transition"
          >
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </div>
      </div>

      <p className="mt-6 text-[10px] font-mono text-mutedDark text-center flex items-center gap-1.5">
        <TrendingUp className="w-3 h-3" /> Skor tetap tercatat meski kamu keluar.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface border border-surfaceBorder rounded-2xl p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-mutedDark">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
    </div>
  );
}
