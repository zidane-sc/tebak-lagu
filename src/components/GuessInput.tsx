"use client";

import React, { useState, useEffect, useRef } from "react";
import { Search, Send, SkipForward, X, Loader2, Music } from "lucide-react";
import { Song } from "@/data/songs";

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

  // 1. Snappy live search with database API + local cache
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(() => {
      fetch(`/api/songs/search?q=${encodeURIComponent(trimmed)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.results) {
            setSuggestions(data.results);
            setIsOpen(data.results.length > 0);
          }
        })
        .catch(() => {})
        .finally(() => setIsSearching(false));
    }, 60);

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

  const submitDirectGuess = () => {
    const trimmed = query.trim();
    if (!trimmed || disabled) return;

    if (selectedIndex >= 0 && suggestions[selectedIndex]) {
      handleSelect(suggestions[selectedIndex]);
      return;
    }

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
    <div className="w-full max-w-md mx-auto flex flex-col gap-2">
      {/* Past Guesses Pill Strip - only renders when guesses exist */}
      {guesses.length > 0 && (
        <div className="flex flex-wrap gap-1.5 justify-center max-h-16 overflow-y-auto px-1">
          {guesses.map((g, i) => (
            <span
              key={i}
              className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1 transition-all shadow-sm ${
                g.isCorrect
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 font-bold"
                  : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
              }`}
            >
              {g.isCorrect ? "✓" : "✕"} {g.text}
            </span>
          ))}
        </div>
      )}

      {/* Input Form with Autocomplete */}
      <div className="relative w-full">
        <div className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder rounded-xl p-1 px-2.5 focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30 transition-all shadow-sm min-h-[44px]">
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 text-accent animate-spin shrink-0 ml-0.5" />
          ) : (
            <Search className="w-3.5 h-3.5 text-mutedDark shrink-0 ml-0.5" />
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
                : `Ketik judul atau artis... (${guesses.length}/${maxGuesses})`
            }
            className="w-full bg-transparent text-white placeholder-zinc-500 text-xs sm:text-sm outline-none py-2 px-1"
          />

          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 hover:bg-zinc-800 rounded-full text-muted transition shrink-0"
              title="Hapus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={submitDirectGuess}
            disabled={disabled || !query.trim()}
            className="bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 transition shadow shrink-0 active:scale-95 cursor-pointer"
          >
            <Send className="w-3 h-3" />
            <span>Tebak</span>
          </button>
        </div>

        {/* Dropdown Suggestions */}
        {isOpen && suggestions.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute left-0 right-0 top-full mt-1.5 bg-surfaceRaised/95 backdrop-blur-md border border-surfaceBorder rounded-xl overflow-hidden shadow-2xl z-50 divide-y divide-zinc-800/60 max-h-52 overflow-y-auto"
          >
            {suggestions.map((item, idx) => (
              <div
                key={`${item.id || item.title}-${idx}`}
                onClick={() => handleSelect(item)}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`p-2 px-2.5 cursor-pointer flex items-center justify-between text-xs transition-colors active:bg-zinc-800 ${
                  idx === selectedIndex
                    ? "bg-zinc-800/90 text-white"
                    : "text-zinc-200 hover:bg-zinc-800/40"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 pr-2">
                  {item.albumCover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.albumCover}
                      alt={item.title}
                      className="w-7 h-7 rounded object-cover border border-surfaceBorder shrink-0"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded bg-surface border border-surfaceBorder flex items-center justify-center text-mutedDark shrink-0">
                      <Music className="w-3.5 h-3.5" />
                    </div>
                  )}
                  <div className="min-w-0 flex flex-col">
                    <p className="font-bold text-white truncate text-xs">{item.title}</p>
                    <p className="text-muted text-[10px] truncate">{item.artist}</p>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-accent font-bold shrink-0">
                  Pilih ↵
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Helper Bar */}
      <div className="flex justify-between items-center px-1">
        <span className="text-[10px] text-mutedDark font-mono">
          Tersisa {maxGuesses - guesses.length} tebakan
        </span>

        <button
          onClick={onSkip}
          disabled={disabled || guesses.length >= maxGuesses}
          className="text-[11px] text-muted hover:text-amber-400 flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-surfaceRaised transition active:scale-95 cursor-pointer"
        >
          <SkipForward className="w-3 h-3" />
          <span>Lewati (+1 Clue)</span>
        </button>
      </div>
    </div>
  );
};
