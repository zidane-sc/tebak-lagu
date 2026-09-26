"use client";

import React, { useState, useEffect } from "react";
import { Search, Check, X, Music, Users, Sparkles, Loader2 } from "lucide-react";

interface Artist {
  id: string;
  name: string;
  image?: string;
  category?: string;
  songCount: number;
}

interface ArtistSelectorProps {
  selectedArtists: string[];
  onChange: (artists: string[]) => void;
  maxSelection?: number;
}

export const ArtistSelector: React.FC<ArtistSelectorProps> = ({
  selectedArtists,
  onChange,
  maxSelection = 15,
}) => {
  const [artists, setArtists] = useState<Artist[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"all" | "indo" | "west">("all");

  useEffect(() => {
    setIsLoading(true);
    fetch("/api/artists")
      .then((r) => r.json())
      .then((data) => {
        if (data.artists) {
          setArtists(data.artists);
        }
      })
      .catch((err) => console.error("Error loading artists:", err))
      .finally(() => setIsLoading(false));
  }, []);

  const toggleArtist = (artistId: string) => {
    if (selectedArtists.includes(artistId)) {
      onChange(selectedArtists.filter((id) => id !== artistId));
    } else {
      if (selectedArtists.length >= maxSelection) return;
      onChange([...selectedArtists, artistId]);
    }
  };

  const clearAll = () => onChange([]);

  const filteredArtists = artists.filter((a) => {
    const matchesSearch =
      !search.trim() || a.name.toLowerCase().includes(search.toLowerCase().trim());
    if (!matchesSearch) return false;

    if (activeTab === "indo") {
      return a.category !== "Western Hits";
    }
    if (activeTab === "west") {
      return a.category === "Western Hits";
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-2.5 w-full">
      {/* Search Input & Quick Filter */}
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Cari artis (Dewa 19, Tulus, Taylor Swift...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-zinc-500 outline-none focus:border-accent transition font-sans"
          />
        </div>

        {/* Tab Filter Mini */}
        <div className="flex items-center gap-1 bg-surfaceRaised p-0.5 rounded-xl border border-surfaceBorder shrink-0">
          {[
            { id: "all", label: "Semua" },
            { id: "indo", label: "🇮🇩 Indo" },
            { id: "west", label: "🌐 Barat" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id as any)}
              className={`px-2 py-1 rounded-lg text-[10px] font-semibold transition ${
                activeTab === t.id
                  ? "bg-zinc-100 text-zinc-950 shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selected Tags Pill Strip */}
      {selectedArtists.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-accentDim/30 border border-accent/20">
          <span className="text-[10px] font-mono text-accent font-bold uppercase tracking-wider mr-1">
            Terpilih ({selectedArtists.length}):
          </span>
          {selectedArtists.map((id) => {
            const found = artists.find((a) => a.id === id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-zinc-900 border border-emerald-500/40 text-emerald-300 shadow-sm"
              >
                <span>{found ? found.name : id}</span>
                <button
                  type="button"
                  onClick={() => toggleArtist(id)}
                  className="hover:text-rose-400 transition"
                  title="Hapus"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
          <button
            type="button"
            onClick={clearAll}
            className="text-[10px] font-mono text-rose-400 hover:text-rose-300 ml-auto underline"
          >
            Hapus Semua
          </button>
        </div>
      )}

      {/* Artists Scrollable Selection Grid */}
      <div className="max-h-48 overflow-y-auto pr-1 grid grid-cols-2 sm:grid-cols-3 gap-1.5 border border-surfaceBorder rounded-2xl p-2 bg-surfaceRaised/40">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-xs text-muted font-mono flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-accent" />
            <span>Memuat penyanyi top...</span>
          </div>
        ) : filteredArtists.length === 0 ? (
          <div className="col-span-full p-6 text-center text-xs text-muted font-mono">
            Tidak ada penyanyi yang cocok.
          </div>
        ) : (
          filteredArtists.map((a) => {
            const isSelected = selectedArtists.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggleArtist(a.id)}
                className={`p-1.5 px-2 rounded-xl border text-left flex items-center gap-2 transition active:scale-98 ${
                  isSelected
                    ? "bg-emerald-500/15 border-emerald-500 text-white shadow-sm"
                    : "bg-surfaceRaised border-surfaceBorder text-zinc-300 hover:text-white hover:border-zinc-700"
                }`}
              >
                {a.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.image}
                    alt={a.name}
                    className="w-7 h-7 rounded-lg object-cover border border-surfaceBorder shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-surface border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                    <Music className="w-3.5 h-3.5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-xs truncate leading-tight">{a.name}</p>
                  <p className="text-[10px] text-mutedDark font-mono leading-none mt-0.5 truncate">
                    {a.songCount} lagu
                  </p>
                </div>
                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
