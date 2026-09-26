"use client";

import React, { useState, useEffect } from "react";
import {
  Disc3,
  Search,
  RefreshCw,
  Edit2,
  Disc,
  Music,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
  X,
  ExternalLink,
} from "lucide-react";
import { EntitySongsModal } from "./EntitySongsModal";

export const AlbumsManager: React.FC<{
  onNotification?: (msg: string, type: "success" | "error") => void;
}> = ({ onNotification }) => {
  const [albums, setAlbums] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Selected for View Tracks Modal
  const [viewAlbum, setViewAlbum] = useState<{ album: string; artist: string } | null>(null);

  // Edit Album Modal
  const [editAlbum, setEditAlbum] = useState<any | null>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [newCover, setNewCover] = useState("");
  const [newYear, setNewYear] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchAlbums = () => {
    setIsLoading(true);
    const q = new URLSearchParams({
      type: "albums",
      page: page.toString(),
      limit: "24",
      search: debouncedSearch,
    });

    fetch(`/api/admin/entities?${q.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.albums) {
          setAlbums(data.albums);
          setTotal(data.total);
          setTotalPages(data.totalPages);
        }
      })
      .catch((err) => console.error("Error fetching albums:", err))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    fetchAlbums();
  }, [page, debouncedSearch]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editAlbum || !newAlbumName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/admin/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_album",
          artist: editAlbum.artist,
          oldAlbumName: editAlbum.album_name,
          newAlbumName: newAlbumName.trim(),
          newCover: newCover.trim() || undefined,
          newYear: newYear.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onNotification?.(data.message || "Data album berhasil diperbarui!", "success");
        setEditAlbum(null);
        fetchAlbums();
      } else {
        onNotification?.(data.error || "Gagal memperbarui album.", "error");
      }
    } catch (err) {
      onNotification?.("Terjadi kesalahan jaringan.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 my-4 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400">
            <Disc3 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm sm:text-base text-white">
              Manajemen Album & Single Musik
            </h3>
            <p className="text-xs text-muted">
              Total {total.toLocaleString()} rilisan album / kompilasi terdaftar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-3 text-mutedDark" />
            <input
              type="text"
              placeholder="Cari judul album atau artis..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-mutedDark outline-none focus:border-accent font-sans transition"
            />
          </div>

          <button
            onClick={fetchAlbums}
            className="p-2 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-muted hover:text-white transition"
            title="Segarkan Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent" : ""}`} />
          </button>
        </div>
      </div>

      {/* Albums Grid */}
      {isLoading ? (
        <div className="p-16 text-center text-xs text-muted font-mono flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
          <span>Memuat data album...</span>
        </div>
      ) : albums.length === 0 ? (
        <div className="p-12 text-center text-xs text-muted font-mono bg-surface border border-surfaceBorder rounded-2xl">
          Tidak ada album yang cocok dengan pencarian &quot;{search}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {albums.map((item, idx) => (
            <div
              key={`${item.artist}-${item.album_name}-${idx}`}
              className="bg-surface hover:bg-surfaceRaised border border-surfaceBorder hover:border-zinc-700 rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm transition group"
            >
              <div className="flex items-start gap-3">
                {item.album_cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.album_cover}
                    alt={item.album_name}
                    className="w-14 h-14 rounded-xl object-cover border border-surfaceBorder shrink-0 shadow-sm"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                    <Disc className="w-6 h-6" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-white truncate group-hover:text-accent transition-colors">
                    {item.album_name}
                  </h4>
                  <p className="text-xs text-muted truncate mt-0.5">{item.artist}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted font-mono mt-1">
                    <span className="text-accent font-bold">{item.track_count} Trek</span>
                    {item.year && <span>• {item.year}</span>}
                  </div>
                </div>
              </div>

              {/* Genre Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.categories.slice(0, 2).map((cat: string) => (
                  <span
                    key={cat}
                    className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-surfaceRaised border border-surfaceBorder text-zinc-300"
                  >
                    {cat}
                  </span>
                ))}
              </div>

              {/* Actions */}
              <div className="pt-2 border-t border-surfaceBorder/60 flex items-center justify-between gap-2 text-xs">
                <button
                  onClick={() => setViewAlbum({ album: item.album_name, artist: item.artist })}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 hover:text-white font-medium flex items-center justify-center gap-1.5 text-xs transition"
                >
                  <Disc className="w-3.5 h-3.5 text-accent" />
                  <span>Lihat Trek Lagu</span>
                </button>

                <button
                  onClick={() => {
                    setEditAlbum(item);
                    setNewAlbumName(
                      item.album_name === "Single / Belum Ada Album" ? "" : item.album_name
                    );
                    setNewCover(item.album_cover || "");
                    setNewYear(item.year ? String(item.year) : "");
                  }}
                  className="py-1.5 px-2.5 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-400 hover:text-white text-xs transition"
                  title="Edit Album & Cover Art"
                >
                  <Edit2 className="w-3.5 h-3.5" />
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

      {/* View Tracks Modal */}
      {viewAlbum && (
        <EntitySongsModal
          isOpen={Boolean(viewAlbum)}
          onClose={() => setViewAlbum(null)}
          title={`Album: ${viewAlbum.album}`}
          subtitle={`Rilisan oleh ${viewAlbum.artist}`}
          type="album"
          identifier={viewAlbum.album}
          secondaryIdentifier={viewAlbum.artist}
        />
      )}

      {/* Edit Album Modal */}
      {editAlbum && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleEditSubmit}
            className="w-full max-w-md bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col gap-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm sm:text-base text-white">Edit Album Musik</h3>
              <button
                type="button"
                onClick={() => setEditAlbum(null)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted leading-relaxed">
              Memperbarui album ini akan otomatis mengupdate{" "}
              <strong className="text-white">{editAlbum.track_count} lagu</strong> milik &quot;
              {editAlbum.artist}&quot; di database.
            </p>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">JUDUL ALBUM</label>
              <input
                type="text"
                required
                placeholder="misal: Sheila On 7, 30 Días, dsb."
                value={newAlbumName}
                onChange={(e) => setNewAlbumName(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-sans"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">
                URL COVER ALBUM (ARTWORK)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={newCover}
                onChange={(e) => setNewCover(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">TAHUN RILIS</label>
              <input
                type="number"
                placeholder="misal: 2024"
                value={newYear}
                onChange={(e) => setNewYear(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surfaceBorder">
              <button
                type="button"
                onClick={() => setEditAlbum(null)}
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
