import rawSongs from "./songs.json";

export interface Song {
  id: string;
  title: string;
  artist: string;
  year: number;
  category: "Galau Hits" | "Nostalgia 2000s" | "Anthem Tongkrongan" | "Pop Jawa & Koplo" | "Western Hits" | string;
  startSecond?: number;
  youtubeId?: string;
  albumCover?: string;
  lyricsClues: string[];
  hummingMelody: Array<{ note: number; duration: number }>;
  searchQuery: string;
  previewUrl?: string;
  previewFallback?: string;
  previewResolved?: string;
  difficulty?: "easy" | "medium" | "hard";
  popularity?: number;
}

export const CATEGORIES = [
  "Semua Genre",
  "Galau Hits",
  "Nostalgia 2000s",
  "Anthem Tongkrongan",
  "Pop Jawa & Koplo",
  "Western Hits",
] as const;

export const DIFFICULTIES = [
  { id: "easy", label: "Mudah (Mega Hits) 🟢", desc: "Lagu viral & hits sejuta umat" },
  { id: "medium", label: "Sedang (Populer) 🟡", desc: "Hits radio & single album" },
  { id: "hard", label: "Sulit (Sepuh Musik) 🔴", desc: "Deep cuts & b-side buat sepuh" },
  { id: "all", label: "Campur (Semua) 🔀", desc: "Koleksi lengkap acak" },
] as const;

export const SONGS_CATALOG: Song[] = rawSongs as Song[];
