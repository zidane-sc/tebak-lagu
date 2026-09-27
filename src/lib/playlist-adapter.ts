/**
 * Playlist Adapter Layer
 * 
 * Provides semantic mapping from legacy "category" column to new "playlist" terminology.
 * Zero database migration required — pure application-layer abstraction.
 * 
 * Usage:
 * - Frontend uses "playlist" terminology
 * - Backend queries still use "category" column
 * - This adapter translates between the two
 */

export type PlaylistId = string;

export interface Playlist {
  id: PlaylistId;
  name: string;
  description: string;
  createdBy: 'system' | string;
  isPublic: boolean;
  songCount?: number;
}

/**
 * System Playlists (mapped from existing categories)
 */
export const SYSTEM_PLAYLISTS: Record<string, Playlist> = {
  'galau-hits': {
    id: 'galau-hits',
    name: 'Galau Hits',
    description: 'Lagu patah hati, slow, emosional',
    createdBy: 'system',
    isPublic: true,
  },
  'nostalgia-2000s': {
    id: 'nostalgia-2000s',
    name: 'Nostalgia 2000s',
    description: 'Throwback era 2000-2010an',
    createdBy: 'system',
    isPublic: true,
  },
  'anthem-tongkrongan': {
    id: 'anthem-tongkrongan',
    name: 'Anthem Tongkrongan',
    description: 'Lagu nongkrong, party, upbeat',
    createdBy: 'system',
    isPublic: true,
  },
  'pop-jawa-koplo': {
    id: 'pop-jawa-koplo',
    name: 'Pop Jawa & Koplo',
    description: 'Campursari, dangdut koplo, Jawa modern',
    createdBy: 'system',
    isPublic: true,
  },
  'western-hits': {
    id: 'western-hits',
    name: 'Western Hits',
    description: 'Lagu Barat mainstream',
    createdBy: 'system',
    isPublic: true,
  },
};

/**
 * Map playlist ID to legacy category value (for DB queries)
 */
export function playlistToCategory(playlistId: string): string {
  const mapping: Record<string, string> = {
    'galau-hits': 'Galau Hits',
    'nostalgia-2000s': 'Nostalgia 2000s',
    'anthem-tongkrongan': 'Anthem Tongkrongan',
    'pop-jawa-koplo': 'Pop Jawa & Koplo',
    'western-hits': 'Western Hits',
    'all': 'all',
    'semua-playlist': 'Semua Genre',
  };
  return mapping[playlistId] || playlistId;
}

/**
 * Map legacy category value to playlist ID
 */
export function categoryToPlaylist(category: string): string {
  const mapping: Record<string, string> = {
    'Galau Hits': 'galau-hits',
    'Nostalgia 2000s': 'nostalgia-2000s',
    'Anthem Tongkrongan': 'anthem-tongkrongan',
    'Pop Jawa & Koplo': 'pop-jawa-koplo',
    'Western Hits': 'western-hits',
    'all': 'all',
    'Semua Genre': 'semua-playlist',
  };
  return mapping[category] || category.toLowerCase().replace(/\s+/g, '-');
}

/**
 * Get all system playlists
 */
export function getSystemPlaylists(): Playlist[] {
  return Object.values(SYSTEM_PLAYLISTS);
}

/**
 * Get playlist by ID
 */
export function getPlaylistById(id: string): Playlist | null {
  return SYSTEM_PLAYLISTS[id] || null;
}

/**
 * Get playlist by legacy category name
 */
export function getPlaylistByCategory(category: string): Playlist | null {
  const playlistId = categoryToPlaylist(category);
  return SYSTEM_PLAYLISTS[playlistId] || null;
}
