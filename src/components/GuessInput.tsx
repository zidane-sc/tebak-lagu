"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Send, SkipForward, X, Loader2 } from "lucide-react";
import { Song, SONGS_CATALOG } from "@/data/songs";

interface GuessInputProps {
  onGuess: (title: string, artist: string) => void;
  onSkip: () => void;
  disabled?: boolean;
  guesses: Array<{ text: string; isCorrect: boolean }>;
  maxGuesses?: number;
}

export const GuessInput: React.FC<GuessInputProps> = ({
  onGuess,
  onSkip,
  disabled = false,
  guesses,
  maxGuesses = 5,
}) => {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Instant local search (0ms) + background global search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const q = trimmed.toLowerCase();
    // Instant ranked match: Exact title > starts with title > word in title > artist match > popularity
    const ranked = SONGS_CATALOG.filter(
      (s) =>
        s.title.toLowerCase().includes(q) || s.artist.toLowerCase().includes(q)
    );

    ranked.sort((a, b) => {
      const aTitle = a.title.toLowerCase();
      const bTitle = b.title.toLowerCase();
      const aRel =
        aTitle === q
          ? 1000
          : aTitle.startsWith(q)
          ? 500
          : aTitle.includes(" " + q)
          ? 300
          : a.artist.toLowerCase() === q
          ? 200
          : a.artist.toLowerCase().startsWith(q)
          ? 100
          : 10;
      const bRel =
        bTitle === q
          ? 1000
          : bTitle.startsWith(q)
          ? 500
          : bTitle.includes(" " + q)
          ? 300
          : b.artist.toLowerCase() === q
          ? 200
          : b.artist.toLowerCase().startsWith(q)
          ? 100
          : 10;

      if (bRel !== aRel) return bRel - aRel;
      return (b.popularity || 50) - (a.popularity || 50);
    });

    const localMatches = ranked.slice(0, 8);
    setSuggestions(localMatches);
    setIsOpen(localMatches.length > 0);

    // Debounced background search for global directory (non-blocking)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(() => {
      fetch(`/api/songs/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.results && data.results.length > 0) {
            setSuggestions(data.results);
            setIsOpen(true);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 150);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (song: { title: string; artist: string }) => {
    onGuess(song.title, song.artist);
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
  };

  // Instant guess submission (0ms delay!)
  const submitDirectGuess = () => {
    const trimmed = query.trim();
    if (!trimmed || disabled) return;

    // If an item is explicitly highlighted with arrow keys, select it
    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelect(suggestions[selectedIndex]);
      return;
    }

    // Otherwise directly submit what the user typed without waiting!
    onGuess(trimmed, "");
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitDirectGuess();
      return;
    }

    if (!isOpen || suggestions.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : suggestions.length - 1
      );
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto flex flex-col gap-3">
      {/* Past Guesses Pill Strip */}
      <div className="flex flex-wrap gap-2 justify-center min-h-[32px]">
        {guesses.map((g, i) => (
          <span
            key={i}
            className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 transition-all shadow-sm ${
              g.isCorrect
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {g.isCorrect ? "✓" : "✕"} {g.text}
          </span>
        ))}
      </div>

      {/* Input Form with Autocomplete */}
      <div className="relative w-full">
        <div className="flex items-center gap-2 bg-surfaceRaised border border-surfaceBorder rounded-2xl p-1 px-3 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all shadow-sm min-h-[50px]">
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0 ml-1" />
          ) : (
            <Search className="w-4 h-4 text-mutedDark shrink-0 ml-1" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={
              disabled
                ? "Ronde selesai..."
                : `Ketik judul atau penyanyi... (${guesses.length}/${maxGuesses})`
            }
            className="w-full bg-transparent text-white placeholder-zinc-500 text-base outline-none py-2.5 px-1"
          />

          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1.5 hover:bg-zinc-800 rounded-full text-muted transition shrink-0"
              title="Hapus"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={submitDirectGuess}
            disabled={disabled || !query.trim()}
            className="bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm flex items-center gap-1.5 transition shadow shrink-0 active:scale-95 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Tebak</span>
          </button>
        </div>

        {/* Dropdown Suggestions (Clamped Mobile Height with Smooth Scroll) */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-2 bg-surfaceRaised border border-surfaceBorder rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-zinc-800/80 max-h-56 overflow-y-auto"
          >
            {suggestions.map((item, idx) => (
              <div
                key={`${item.title}-${item.artist}-${idx}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-3 cursor-pointer flex items-center justify-between text-xs sm:text-sm transition-colors active:bg-zinc-800 ${
                  idx === selectedIndex
                    ? "bg-zinc-800 text-white"
                    : "text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="font-semibold text-white truncate">{item.title}</p>
                  <p className="text-muted text-xs truncate mt-0.5">
                    {item.artist} ·{" "}
                    <span className="text-[10px] text-mutedDark font-mono">
                      {item.category}
                    </span>
                  </p>
                </div>
                <span className="text-xs text-accent font-mono shrink-0 pl-1">
                  Pilih ↵
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Skip / Hint Button (Touch-Friendly Ergonomics) */}
      <div className="flex justify-between items-center px-1">
        <span className="text-xs text-mutedDark font-mono">
          Tersisa {maxGuesses - guesses.length} kesempatan
        </span>

        <button
          onClick={onSkip}
          disabled={disabled || guesses.length >= maxGuesses}
          className="text-xs text-muted hover:text-amber-400 flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-surfaceRaised transition active:scale-95"
        >
          <SkipForward className="w-3.5 h-3.5" />
          <span>Lewati / Clue Tambahan</span>
        </button>
      </div>
    </div>
  );
};
