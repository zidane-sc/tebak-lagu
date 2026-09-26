"use client";

import React, { useState, useEffect } from "react";
import {
  Layers,
  RefreshCw,
  Edit2,
  Disc,
  Music,
  Check,
  X,
  Loader2,
  TrendingUp,
} from "lucide-react";
import { EntitySongsModal } from "./EntitySongsModal";

export const GenresManager: React.FC<{
  onNotification?: (msg: string, type: "success" | "error") => void;
}> = ({ onNotification }) => {
  const [genres, setGenres] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Selected for View Songs
  const [viewGenre, setViewGenre] = useState<string | null>(null);

  // Rename Genre Modal
  const [renameGenre, setRenameGenre] = useState<any | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchGenres = () => {
    setIsLoading(true);
    fetch("/api/admin/entities?type=genres")
      .then((r) => r.json())
      .then((data) => {
        if (data.genres) {
          setGenres(data.genres);
        }
      })
      .catch((err) => console.error("Error fetching genres:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchGenres();
  }, []);

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameGenre || !newCategoryName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename_genre",
          oldCategory: renameGenre.category,
          newCategory: newCategoryName.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Nama kategori genre berhasil diperbarui!", "success");
        setRenameGenre(null);
        fetchGenres();
      } else {
        onNotification?.(data.error || "Gagal mengubah nama genre.", "error");
      }
    } catch (err) {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalCatalog = genres.reduce((acc, g) => acc + g.song_count, 0);

  return (
    <div className="flex flex-col gap-4 my-4 animate-fade-in">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Manajemen Kategori & Genre Musik
            </h3>
            <p className="text-xs text-muted">
              Distribusi 4.619 lagu dalam {genres.length} kategori aktif
            </p>
          </div>
        </div>

        <button
          onClick={fetchGenres}
          className="p-2 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white transition"
          title="Segarkan Data"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent" : ""}`} />
        </button>
      </div>

      {/* Genres Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-muted font-mono flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span>Memuat data genre...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {genres.map((g) => {
            const percentage = totalCatalog > 0 ? Math.round((g.song_count / totalCatalog) * 100) : 0;

            return (
              <div
                key={g.category}
                className="bg-surface hover:bg-surfaceRaised border border-surfaceBorder hover:border-zinc-700 rounded-2xl p-5 flex flex-col justify-between gap-4 shadow-sm transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono text-mutedDark uppercase tracking-wider">
                        KATEGORI GENRE
                      </span>
                      <h4 className="font-bold text-base text-white mt-0.5">{g.category}</h4>
                    </div>

                    <span className="text-xs font-mono font-bold text-accent bg-accentDim px-2.5 py-1 rounded-lg border border-accent/20">
                      {g.song_count.toLocaleString()} Lagu
                    </span>
                  </div>

                  {/* Progress Bar of Catalog */}
                  <div className="w-full bg-zinc-800 rounded-full h-2 mt-3 overflow-hidden">
                    <div
                      className="bg-accent h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.max(4, percentage)}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-muted mt-1 block">
                    {percentage}% dari total seluruh katalog
                  </span>
                </div>

                {/* Difficulty Distribution Pill breakdown */}
                <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px] bg-surfaceRaised/50 p-2.5 rounded-xl border border-surfaceBorder">
                  <div className="flex flex-col items-center text-center">
                    <span className="text-emerald-400 font-bold">{g.easy_count}</span>
                    <span className="text-mutedDark">Mudah</span>
                  </div>
                  <div className="flex flex-col items-center text-center border-x border-surfaceBorder">
                    <span className="text-amber-400 font-bold">{g.medium_count}</span>
                    <span className="text-mutedDark">Sedang</span>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <span className="text-rose-400 font-bold">{g.hard_count}</span>
                    <span className="text-mutedDark">Sulit</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-between gap-2 text-xs">
                  <button
                    onClick={() => setViewGenre(g.category)}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 hover:text-white font-medium flex items-center justify-center gap-1.5 text-xs transition"
                  >
                    <Disc className="w-3.5 h-3.5 text-accent" />
                    <span>Lihat Daftar Lagu</span>
                  </button>

                  <button
                    onClick={() => {
                      setRenameGenre(g);
                      setNewCategoryName(g.category);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-400 hover:text-white text-xs transition"
                    title="Ubah Nama Kategori Genre"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* View Genre Songs Modal */}
      {viewGenre && (
        <EntitySongsModal
          isOpen={Boolean(viewGenre)}
          onClose={() => setViewGenre(null)}
          title={`Genre: ${viewGenre}`}
          subtitle="Daftar lagu dalam kategori genre ini"
          type="genre"
          identifier={viewGenre}
        />
      )}

      {/* Rename Genre Modal */}
      {renameGenre && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm sm:text-base text-white">Ubah Nama Genre</h3>
              <button
                type="button"
                onClick={() => setRenameGenre(null)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Mengubah nama genre ini akan otomatis mengupdate kategori pada seluruh{" "}
              <strong className="text-white">{renameGenre.song_count} lagu</strong> di database.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">
                NAMA BARU KATEGORI / GENRE
              </label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surfaceBorder">
              <button
                type="button"
                onClick={() => setRenameGenre(null)}
                className="py-2 px-3 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs text-muted hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2 px-4 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent/20 cursor-pointer"
              >
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
