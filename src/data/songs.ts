import rawSongs from "./songs.json";

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: "Galau Hits" | "Nostalgia 2000s" | "Anthem Tongkrongan" | "Pop Jawa & Koplo" | "Western Hits" | string;
  startSecond?: number;
  youtubeId?: string;
  youtubeStartSecond?: number;
  youtubeStatus?: string;
  hasYoutube?: boolean;
  albumCover?: string;
  lyricsClues: string[];
  hummingMelody: Array<{ note: number; duration: number }>;
  searchQuery: string;
  previewUrl?: string;
  previewFallback?: string;
  previewResolved?: string;
  difficulty?: "easy" | "medium" | "hard";
  popularity?: number;
  lang?: "id" | "en";
}

// Legacy export name for backward compatibility (backend still uses "category" column)
export const CATEGORIES = [
  "Semua Playlist",
  "Galau Hits",
  "Nostalgia 2000s",
  "Anthem Tongkrongan",
  "Pop Jawa & Koplo",
  "Western Hits",
] as const;

// Alias for clearer semantics in UI
export const PLAYLISTS = CATEGORIES;

export const DIFFICULTIES = [
  { id: "easy", label: "Mudah (Mega Hits) 🟢", desc: "Lagu viral & hits sejuta umat" },
  { id: "medium", label: "Sedang (Populer) 🟡", desc: "Semua lagu Mudah + Populer" },
  { id: "hard", label: "Sulit (Sepuh Musik) 🔴", desc: "Seluruh katalog — Mudah, Sedang & Sulit" },
  { id: "all", label: "Campur (Semua) 🔀", desc: "Koleksi lengkap acak" },
] as const;

export const SONGS_CATALOG: Song[] = rawSongs as Song[];
