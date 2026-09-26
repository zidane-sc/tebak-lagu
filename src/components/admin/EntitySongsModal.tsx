"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  X,
  Music,
  Play,
  Pause,
  Disc,
  Clock,
  Radio,
  Flame,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";

interface EntitySongsModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  type: "artist" | "album" | "genre";
  identifier: string; // artist name, album name, or genre name
  secondaryIdentifier?: string; // artist name if type is album
}

export const EntitySongsModal: React.FC<EntitySongsModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  type,
  identifier,
  secondaryIdentifier,
}) => {
  const [songs, setSongs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen || !identifier) return;

    setIsLoading(true);
    let url = "";

    if (type === "artist") {
      url = `/api/admin/entities?type=songs_by_artist&artist=${encodeURIComponent(identifier)}`;
    } else if (type === "album") {
      url = `/api/admin/entities?type=songs_by_album&artist=${encodeURIComponent(
        secondaryIdentifier || ""
      )}&album=${encodeURIComponent(identifier)}`;
    } else if (type === "genre") {
      url = `/api/admin/songs?category=${encodeURIComponent(identifier)}&limit=100`;
    }

    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.songs) {
          setSongs(data.songs);
        } else if (data.data) {
          setSongs(data.data);
        }
      })
      .catch((err) => console.error("Error fetching entity songs:", err))
      .finally(() => setIsLoading(false));

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingSongId(null);
    };
  }, [isOpen, type, identifier, secondaryIdentifier]);

  const togglePlay = (song: any) => {
    if (playingSongId === song.id) {
      audioRef.current?.pause();
      setPlayingSongId(null);
      return;
    }

    const previewUrl = song.preview_url || song.previewUrl || song.previewFallback;
    if (!previewUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.onended = () => setPlayingSongId(null);
    }

    audioRef.current.src = previewUrl;
    audioRef.current.currentTime = song.startSecond || 0;
    audioRef.current
      .play()
      .then(() => setPlayingSongId(song.id))
      .catch(() => setPlayingSongId(null));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-surface border border-surfaceBorder rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-surfaceBorder flex items-center justify-between bg-surfaceRaised/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accentDim border border-accent/30 flex items-center justify-center text-accent">
              <Disc className="w-5 h-5 animate-spin [animation-duration:10s]" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-white">{title}</h3>
              <p className="text-xs text-muted font-mono">{subtitle}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder flex items-center justify-center text-muted hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted font-mono flex items-center justify-center gap-2">
              <Clock className="w-4 h-4 animate-spin text-accent" />
              <span>Memuat daftar lagu...</span>
            </div>
          ) : songs.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted font-mono">
              Tidak ada lagu yang ditemukan untuk entitas ini.
            </div>
          ) : (
            <div className="divide-y divide-surfaceBorder/60 border border-surfaceBorder rounded-xl overflow-hidden bg-surfaceRaised/20">
              <div className="p-2.5 px-3 bg-surfaceRaised/60 flex items-center justify-between text-[10px] font-mono text-muted uppercase">
                <span>Daftar Lagu ({songs.length})</span>
                <span>Metadata</span>
              </div>

              {songs.map((song, idx) => {
                const isPlaying = playingSongId === song.id;
                const cover = song.album_cover || song.albumCover;
                const titleText = song.title;
                const artistText = song.artist;
                const preview = song.preview_url || song.previewUrl;

                return (
                  <div
                    key={song.id || idx}
                    className={`p-3 px-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isPlaying ? "bg-accent/10" : "hover:bg-surfaceRaised/40"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => togglePlay(song)}
                        disabled={!preview}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition shrink-0 ${
                          !preview
                            ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                            : isPlaying
                            ? "bg-accent text-zinc-950 font-bold shadow-md shadow-accent/30"
                            : "bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 hover:text-white"
                        }`}
                      >
                        {isPlaying ? (
                          <Pause className="w-3.5 h-3.5 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                        )}
                      </button>

                      {cover ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cover}
                          alt=""
                          className="w-9 h-9 rounded-lg object-cover border border-surfaceBorder shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                          <Music className="w-4 h-4" />
                        </div>
                      )}

                      <div className="min-w-0">
                        <p className="font-semibold text-xs sm:text-sm text-white truncate">
                          {titleText}
                        </p>
                        <p className="text-[11px] text-muted truncate">
                          {artistText} {song.year ? `(${song.year})` : ""}{" "}
                          {song.album ? `• ${song.album}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                          song.difficulty === "easy"
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : song.difficulty === "medium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        }`}
                      >
                        {song.difficulty || "easy"}
                      </span>

                      <span className="text-zinc-400 text-[10px] hidden sm:inline">
                        {song.category}
                      </span>

                      {song.deezer_rank > 0 && (
                        <span className="text-purple-400 text-[10px] hidden md:inline">
                          Rank {(song.deezer_rank / 1000).toFixed(0)}k
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-surfaceBorder flex items-center justify-between text-xs text-muted font-mono bg-surfaceRaised/30">
          <span>Total {songs.length} Lagu</span>
          <button
            onClick={onClose}
            className="py-1.5 px-3 rounded-lg bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 hover:text-white transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
