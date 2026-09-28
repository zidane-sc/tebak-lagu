"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Edit2,
  Tag,
  Disc,
  Music,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  Layers,
  Sparkles,
  Eye,
  EyeOff,
  Trash2,
} from "lucide-react";
import { EntitySongsModal } from "./EntitySongsModal";
import { CATEGORIES } from "@/data/songs";

export const ArtistsManager: React.FC<{
  onNotification?: (msg: string, type: "success" | "error") => void;
}> = ({ onNotification }) => {
  const [artists, setArtists] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [minSongsFilter, setMinSongsFilter] = useState<number>(0);

  // Selected for View Songs Modal
  const [viewArtist, setViewArtist] = useState<string | null>(null);

  // Rename Modal
  const [renameArtist, setRenameArtist] = useState<any | null>(null);
  const [newName, setNewName] = useState("");
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Reassign Playlist Modal
  const [reassignArtist, setReassignArtist] = useState<any | null>(null);

  // Delete artist songs modal
  const [deleteArtistTarget, setDeleteArtistTarget] = useState<any | null>(null);
  const [deleteMode, setDeleteMode] = useState<"disable" | "purge">("disable");
  const [isDeleting, setIsDeleting] = useState(false);
  const [newGenre, setNewGenre] = useState<string>("Galau Hits");
  const [isSubmittingReassign, setIsSubmittingReassign] = useState(false);

  // Sync / Seeder Multi-Artist State
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncMultiArtists = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_artists" }),
      });
      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Seeding & Sinkronisasi Multi-Artis berhasil!", "success");
        fetchArtists();
      } else {
        onNotification?.(data.error || "Gagal sinkronisasi artis.", "error");
      }
    } catch (err) {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchArtists = () => {
    setIsLoading(true);
    const q = new URLSearchParams({
      type: "artists",
      page: page.toString(),
      limit: "24",
      search: debouncedSearch,
    });
    if (selectedCategory && selectedCategory !== "all") {
      q.set("category", selectedCategory);
    }
    if (minSongsFilter > 0) {
      q.set("min_songs", minSongsFilter.toString());
    }

    fetch(`/api/admin/entities?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.artists) {
          setArtists(data.artists);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .catch((err) => console.error("Error fetching artists:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchArtists();
  }, [page, debouncedSearch, selectedCategory, minSongsFilter]);

  const handleToggleArtistStatus = async (item: any) => {
    const newStatus = item.is_active === false;
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_artist_status",
          artistId: item.id || item.artist,
          is_active: newStatus,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Status penyanyi berhasil diperbarui!", "success");
        setArtists((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, is_active: newStatus } : a))
        );
      } else {
        onNotification?.(data.error || "Gagal mengubah status artis.", "error");
      }
    } catch {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    }
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameArtist || !newName.trim()) return;

    setIsSubmittingRename(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "rename_artist",
          oldName: renameArtist.artist,
          newName: newName.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Nama artis berhasil diperbarui!", "success");
        setRenameArtist(null);
        fetchArtists();
      } else {
        onNotification?.(data.error || "Gagal mengubah nama artis.", "error");
      }
    } catch (err) {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleDeleteArtistSongs = async () => {
    if (!deleteArtistTarget) return;

    setIsDeleting(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_artist_songs",
          artist: deleteArtistTarget.artist,
          mode: deleteMode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Lagu artis berhasil diproses!", "success");
        setDeleteArtistTarget(null);
        fetchArtists();
      } else {
        onNotification?.(data.error || "Gagal memproses lagu artis.", "error");
      }
    } catch {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reassignArtist || !newGenre) return;

    setIsSubmittingReassign(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign_artist_genre",
          artist: reassignArtist.artist,
          newCategory: newGenre,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Playlist artis berhasil diubah!", "success");
        setReassignArtist(null);
        fetchArtists();
      } else {
        onNotification?.(data.error || "Gagal mengubah playlist artis.", "error");
      }
    } catch (err) {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSubmittingReassign(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 my-4 animate-fade-in">
      {/* Header and Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Manajemen Penyanyi & Artis
            </h3>
            <p className="text-xs text-muted">
              Total {total.toLocaleString()} penyanyi terdaftar di database
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Playlist Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-2.5 py-2 text-xs text-white outline-none focus:border-accent font-sans transition cursor-pointer"
          >
            <option value="all">Semua Playlist</option>
            {CATEGORIES.filter((c) => c !== "Semua Playlist").map((catName) => (
              <option key={catName} value={catName}>
                {catName}
              </option>
            ))}
          </select>

          {/* Min Songs Filter Toggle */}
          <button
            onClick={() => {
              setMinSongsFilter(minSongsFilter > 0 ? 0 : 2);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition border cursor-pointer whitespace-nowrap ${
              minSongsFilter > 0
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                : "bg-surfaceRaised border-surfaceBorder text-muted hover:text-white"
            }`}
            title="Filter hanya artis utama (minimal 2 lagu)"
          >
            <span>{minSongsFilter > 0 ? "⭐ Artis Utama (≥2 Lagu)" : "👥 Semua Artis"}</span>
          </button>

          <div className="relative flex-1 sm:w-52">
            <Search className="w-4 h-4 absolute left-3 top-3 text-mutedDark" />
            <input
              type="text"
              placeholder="Cari nama artis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-mutedDark outline-none focus:border-accent font-sans transition"
            />
          </div>

          <button
            onClick={handleSyncMultiArtists}
            disabled={isSyncing}
            className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer whitespace-nowrap"
            title="Ekstrak & Sinkronkan relasi multi-penyanyi dari katalog lagu"
          >
            {isSyncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isSyncing ? "Menyinkronkan..." : "Sinkronkan"}</span>
          </button>

          <button
            onClick={fetchArtists}
            className="p-2 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white transition"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </div>

      {/* Artists Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-muted font-mono flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span>Memuat daftar artis...</span>
        </div>
      ) : artists.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted font-mono bg-surface border border-surfaceBorder rounded-2xl">
          Tidak ada artis yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {artists.map((item) => (
            <div
              key={item.artist}
              className={`bg-surface hover:bg-surfaceRaised border rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group ${
                item.is_active === false
                  ? "border-rose-500/30 opacity-70 bg-rose-950/10"
                  : "border-surfaceBorder hover:border-zinc-700"
              }`}
            >
              <div className="flex items-start gap-3">
                {item.sample_cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.sample_cover}
                    alt={item.artist}
                    className="w-12 h-12 rounded-xl object-cover border border-surfaceBorder shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                    <Music className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h4 className={`font-bold text-sm truncate transition-colors ${
                      item.is_active === false ? "text-zinc-400 line-through" : "text-white group-hover:text-accent"
                    }`}>
                      {item.artist}
                    </h4>
                    {item.is_active === false && (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold shrink-0">
                        NONAKTIF
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted font-mono mt-0.5">
                    <span className="text-accent font-bold">{item.song_count} Lagu</span>
                    {item.min_year && (
                      <span>
                        • {item.min_year}
                        {item.max_year && item.max_year !== item.min_year ? ` - ${item.max_year}` : ""}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Playlist Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.categories.slice(0, 3).map((cat: string) => (
                  <span
                    key={cat}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surfaceRaised border border-surfaceBorder text-zinc-300"
                  >
                    {cat}
                  </span>
                ))}
                {item.categories.length > 3 && (
                  <span className="text-[10px] font-mono text-mutedDark">
                    +{item.categories.length - 3}
                  </span>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-between gap-1.5 text-xs">
                <button
                  onClick={() => setViewArtist(item.artist)}
                  className="flex-1 py-1.5 px-2 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 hover:text-white font-medium flex items-center justify-center gap-1 text-[11px] transition"
                >
                  <Disc className="w-3 h-3 text-accent" />
                  <span>Lihat Lagu</span>
                </button>

                <button
                  onClick={() => handleToggleArtistStatus(item)}
                  className={`py-1.5 px-2 rounded-lg border text-[11px] transition ${
                    item.is_active === false
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
                      : "bg-surfaceRaised border-surfaceBorder text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                  }`}
                  title={item.is_active === false ? "Aktifkan Penyanyi di Kuis" : "Nonaktifkan Penyanyi dari Kuis"}
                >
                  {item.is_active === false ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>

                <button
                  onClick={() => {
                    setRenameArtist(item);
                    setNewName(item.artist);
                  }}
                  className="py-1.5 px-2 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-400 hover:text-white text-[11px] transition"
                  title="Ganti Nama Artis"
                >
                  <Edit2 className="w-3 h-3" />
                </button>

                <button
                  onClick={() => {
                    setReassignArtist(item);
                    setNewGenre(item.categories[0] || "Galau Hits");
                  }}
                  className="py-1.5 px-2 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-400 hover:text-white text-[11px] transition"
                  title="Pindahkan Seluruh Lagu ke Playlist Lain"
                >
                  <Tag className="w-3 h-3" />
                </button>

                <button
                  onClick={() => {
                    setDeleteArtistTarget(item);
                    setDeleteMode("disable");
                  }}
                  className="py-1.5 px-2 rounded-lg bg-surfaceRaised hover:bg-rose-500/15 border border-surfaceBorder hover:border-rose-500/40 text-zinc-400 hover:text-rose-400 text-[11px] transition"
                  title="Hapus / Nonaktifkan Semua Lagu Artis Ini"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-surface border border-surfaceBorder rounded-2xl p-3 px-4 font-mono text-xs text-muted">
          <span>
            Halaman {page} dari {totalPages}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder disabled:opacity-40 disabled:cursor-not-allowed text-zinc-200"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* View Artist Songs Modal */}
      {viewArtist && (
        <EntitySongsModal
          isOpen={Boolean(viewArtist)}
          onClose={() => setViewArtist(null)}
          title={`Diskografi: ${viewArtist}`}
          subtitle="Daftar lagu resmi penyanyi ini di database"
          type="artist"
          identifier={viewArtist}
        />
      )}

      {/* Rename Artist Modal */}
      {renameArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleRenameSubmit}
            className="w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm sm:text-base text-white">Ganti Nama Penyanyi</h3>
              <button
                type="button"
                onClick={() => setRenameArtist(null)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Mengubah nama penyanyi ini akan otomatis memperbarui seluruh{" "}
              <strong className="text-white">{renameArtist.song_count} lagu</strong> milik &quot;
              {renameArtist.artist}&quot; di database.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">
                NAMA BARU PENYANYI / BAND
              </label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-sans"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surfaceBorder">
              <button
                type="button"
                onClick={() => setRenameArtist(null)}
                className="py-2 px-3 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs text-muted hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingRename}
                className="py-2 px-4 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent/20 cursor-pointer"
              >
                {isSubmittingRename ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reassign Playlist Modal */}
      {reassignArtist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleReassignSubmit}
            className="w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm sm:text-base text-white">Pindahkan Playlist Artis</h3>
              <button
                type="button"
                onClick={() => setReassignArtist(null)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Pindahkan seluruh <strong className="text-white">{reassignArtist.song_count} lagu</strong> milik &quot;
              {reassignArtist.artist}&quot; ke playlist yang dipilih:
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">PILIH GENRE TUJUAN</label>
              <select
                value={newGenre}
                onChange={(e) => setNewGenre(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-sans"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surfaceBorder">
              <button
                type="button"
                onClick={() => setReassignArtist(null)}
                className="py-2 px-3 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs text-muted hover:text-white"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingReassign}
                className="py-2 px-4 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-accent/20 cursor-pointer"
              >
                {isSubmittingReassign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Pindahkan Semua Lagu</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Artist Songs Modal */}
      {deleteArtistTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm sm:text-base text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                Hapus Lagu &quot;{deleteArtistTarget.artist}&quot;
              </h3>
              <button
                type="button"
                onClick={() => setDeleteArtistTarget(null)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Ada <strong className="text-white">{deleteArtistTarget.song_count} lagu</strong> milik
              artis ini di katalog. Pilih tindakan:
            </p>

            <div className="flex flex-col gap-2">
              {/* Safe option */}
              <button
                type="button"
                onClick={() => setDeleteMode("disable")}
                className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                  deleteMode === "disable"
                    ? "bg-amber-500/10 border-amber-500/50"
                    : "bg-surfaceRaised border-surfaceBorder hover:border-amber-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <EyeOff className={`w-4 h-4 ${deleteMode === "disable" ? "text-amber-400" : "text-mutedDark"}`} />
                  <span className="text-xs font-bold text-white">Nonaktifkan (Disarankan)</span>
                </div>
                <p className="text-[11px] text-muted mt-1 ml-6">
                  Lagu dikeluarkan dari kuis tapi data tetap tersimpan. Bisa diaktifkan kapan saja.
                </p>
              </button>

              {/* Purge option */}
              <button
                type="button"
                onClick={() => setDeleteMode("purge")}
                className={`text-left p-3 rounded-xl border transition cursor-pointer ${
                  deleteMode === "purge"
                    ? "bg-rose-500/10 border-rose-500/50"
                    : "bg-surfaceRaised border-surfaceBorder hover:border-rose-500/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trash2 className={`w-4 h-4 ${deleteMode === "purge" ? "text-rose-400" : "text-mutedDark"}`} />
                  <span className="text-xs font-bold text-white">Hapus Permanen</span>
                </div>
                <p className="text-[11px] text-muted mt-1 ml-6">
                  Data lagu dihapus selamanya dari database. TIDAK BISA dibatalkan.
                </p>
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surfaceBorder">
              <button
                type="button"
                onClick={() => setDeleteArtistTarget(null)}
                className="py-2 px-3 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs text-muted hover:text-white cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleDeleteArtistSongs}
                disabled={isDeleting}
                className={`py-2 px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition cursor-pointer disabled:opacity-50 ${
                  deleteMode === "purge"
                    ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/25"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-amber-500/20"
                }`}
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>{deleteMode === "purge" ? "Hapus Permanen" : "Nonaktifkan"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
