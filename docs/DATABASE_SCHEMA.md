# Tebak Lagu — Database Schema & Data Dictionary

Dokumentasi resmi arsitektur basis data SQLite / LibSQL untuk aplikasi **Tebak Lagu (Audio Trivia Engine & Real-Time Multiplayer)**.

* **Engine:** SQLite 3 / LibSQL Client
* **Lokasi Database Lokal:** `/data/workspace/tebak-lagu/data/tebak_lagu.db`
* **Lokasi Cloud Persistence:** Fly.io Persistent Volume NVMe (`tebak_lagu_data`) di `/app/data/tebak_lagu.db`
* **Journal Mode:** Write-Ahead Logging (`WAL`)
* **Pencarian Real-Time:** Full-Text Search 5 (`FTS5`) Virtual Table dengan BM25 Ranking
* **Terakhir Diperbarui:** 27 September 2026

---

## ⚡ 0. Konfigurasi Concurrency & WAL (Write-Ahead Logging)

Setiap inisialisasi koneksi LibSQL/SQLite secara otomatis menjalankan pragma performa tinggi:

```sql
PRAGMA journal_mode = WAL;        -- Pembaca tidak memblokir penulis; penulis tidak memblokir pembaca.
PRAGMA busy_timeout = 5000;       -- Tunggu hingga 5 detik jika ada transaksi bersamaan (mencegah "database locked").
PRAGMA synchronous = NORMAL;      -- Mengurangi I/O disk secara dramatis pada WAL mode dengan integritas data tetap aman.
```

---

## 🗺️ Entity Relationship Diagram (High-Level)

```
       ┌──────────────────────┐
       │        users         │ (Soft Delete: is_active, deleted_at)
       └──────────┬───────────┘
                  │ 1:N (opsional)
                  ▼
       ┌──────────────────────┐
       │     leaderboard      │ (Tetap utuh walau user di-soft delete)
       └──────────────────────┘

       ┌──────────────────────┐               ┌──────────────────────┐
       │        songs         │◀─────────────▶│       artists        │
       └──────────┬───────────┘  N:M (Junction│└──────────┬───────────┘
                  │               song_artists            │
                  ├───────────────────┐                   ▼
                  ▼                   ▼           (Filter & Multi-Select)
       ┌──────────────────────┐  ┌───────────┐
       │     app_settings     │  │ songs_fts │ (FTS5 Auto-Sync Triggers)
       └──────────────────────┘  └───────────┘
```

---

## 🗄️ 1. Tabel `songs` (Katalog Utama Lagu)

Menyimpan seluruh metadata lagu, preview audio, lirik 4 bait untuk Robot TTS, melodi humming, dan status aktif permainan.

### DDL Schema:
```sql
CREATE TABLE songs (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  artist         TEXT NOT NULL,
  year           INTEGER,
  category       TEXT NOT NULL,
  difficulty     TEXT NOT NULL,
  popularity     INTEGER DEFAULT 50,
  deezer_rank    INTEGER DEFAULT 0,
  bpm            REAL DEFAULT 0,
  preview_url    TEXT,
  album_cover    TEXT,
  album          TEXT,
  lyrics_clues   TEXT,
  humming_melody TEXT,
  search_query   TEXT,
  start_second   INTEGER DEFAULT 0,
  is_active      INTEGER DEFAULT 1,
  times_played   INTEGER DEFAULT 0,
  times_guessed  INTEGER DEFAULT 0,
  times_failed   INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_songs_category ON songs(category);
CREATE INDEX idx_songs_difficulty ON songs(difficulty);
CREATE INDEX idx_songs_artist ON songs(artist);
```

### Kamus Kolom (`songs`):
| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `id` | TEXT | NO | - | Primary Key unik (misal: `itunes-532180261` atau slug `dewa-kangen`). |
| `title` | TEXT | NO | - | Judul lagu resmi (misal: `Kangen`). |
| `artist` | TEXT | NO | - | String nama penampil/penyanyi lengkap (misal: `Dewa 19 & Happy Asmara`). |
| `year` | INTEGER | YES | NULL | Tahun rilis resmi lagu. |
| `category` | TEXT | NO | - | Genre kuis: `Galau Hits`, `Nostalgia 2000s`, `Anthem Tongkrongan`, `Pop Jawa & Koplo`, `Western Hits`. |
| `difficulty` | TEXT | NO | - | Tingkat kesulitan: `easy` (Mega Hits), `medium` (Populer), `hard` (Deep Cuts). |
| `popularity` | INTEGER | YES | 50 | Skor popularitas relatif (0–100). |
| `deezer_rank` | INTEGER | YES | 0 | Peringkat streaming global Deezer (indikator kepopuleran). |
| `bpm` | REAL | YES | 0 | Tempo beat lagu per menit. |
| `preview_url` | TEXT | YES | NULL | URL CDN audio cuplikan 30 detik (Apple Music / Deezer). |
| `album_cover` | TEXT | YES | NULL | URL resolusi tinggi (HD) artwork cover album/single. |
| `album` | TEXT | YES | NULL | Nama album resmi lagu. |
| `lyrics_clues` | TEXT | YES | NULL | JSON Array berisi tepat 4 bait lirik terverifikasi (`json_array_length >= 4`). Bebas spoiler judul di Bait 1. |
| `humming_melody` | TEXT | YES | NULL | JSON Array nada melodi MIDI sintetis (frekuensi & durasi) untuk mode Humming. |
| `search_query` | TEXT | YES | NULL | String indeks pencarian in-game yang memuat judul dan semua kolaborator penyanyi. |
| `start_second` | INTEGER | YES | 0 | Offset detik audio untuk melewati jeda hening/intro panjang. |
| `is_active` | INTEGER | YES | 1 | Flag keaktifan kuis: `1` = Masuk rotasi game, `0` = Dinonaktifkan (di-disable admin). |
| `times_played` | INTEGER | YES | 0 | Akumulasi berapa kali lagu ini terpilih di ronde kuis. |
| `times_guessed` | INTEGER | YES | 0 | Akumulasi berapa kali ditebak dengan benar oleh pemain. |
| `times_failed` | INTEGER | YES | 0 | Akumulasi berapa kali pemain gagal menebak lagu ini. |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Waktu pencatatan lagu ke database. |

---

## 🔍 2. Virtual Table `songs_fts` (Full-Text Search 5)

Virtual table SQLite FTS5 untuk pencarian judul dan artis secara instan (< 1 ms) saat pemain mengetik di kolom tebakan in-game (`GuessInput`). Menggunakan tokenizer `unicode61` dengan pembersihan aksen dan perangkingan relevansi `bm25()`.

### DDL Schema:
```sql
CREATE VIRTUAL TABLE songs_fts USING fts5(
  id UNINDEXED,
  title,
  artist,
  search_query,
  tokenize = 'unicode61 remove_diacritics 2'
);
```

### Auto-Sync Triggers:
Triggers otomatis menjaga `songs_fts` selalu sinkron 100% setiap ada perubahan pada tabel `songs`:
```sql
CREATE TRIGGER songs_ai AFTER INSERT ON songs BEGIN
  INSERT INTO songs_fts(id, title, artist, search_query)
  VALUES (new.id, new.title, new.artist, COALESCE(new.search_query, new.title || ' ' || new.artist));
END;

CREATE TRIGGER songs_ad AFTER DELETE ON songs BEGIN
  DELETE FROM songs_fts WHERE id = old.id;
END;

CREATE TRIGGER songs_au AFTER UPDATE ON songs BEGIN
  DELETE FROM songs_fts WHERE id = old.id;
  INSERT INTO songs_fts(id, title, artist, search_query)
  VALUES (new.id, new.title, new.artist, COALESCE(new.search_query, new.title || ' ' || new.artist));
END;
```

---

## 🎤 3. Tabel `artists` (Master Data Penyanyi)

Menyimpan daftar seluruh musisi terkurasi beserta statistik katalog lagu dan status aktifnya.

### DDL Schema:
```sql
CREATE TABLE artists (
  id          TEXT PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  image       TEXT,
  category    TEXT,
  song_count  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Kamus Kolom (`artists`):
| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `id` | TEXT | NO | - | Primary Key slug unik (misal: `dewa-19`, `sheila-on-7`, `tulus`). |
| `name` | TEXT | NO | - | Nama resmi musisi/band (Unique constraint). |
| `image` | TEXT | YES | NULL | URL foto artis / cover album terbaik dengan rank tertinggi. |
| `category` | TEXT | YES | NULL | Kategori/genre primer musisi. |
| `song_count` | INTEGER | YES | 0 | Total jumlah lagu aktif yang dimiliki artis di database. |
| `is_active` | INTEGER | YES | 1 | Status aktif: `1` = Aktif, `0` = Dinonaktifkan (semua lagunya diblokir dari kuis). |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Timestamp penambahan artis. |

---

## 🔗 4. Tabel `song_artists` (Relasi Multi-Artis / Kolaborasi)

Junction table penghubung relasi banyak-ke-banyak (*many-to-many*) antara lagu dan penyanyi. Menjamin lagu kolaborasi atau duet dapat dicari dan difilter berdasarkan nama masing-masing musisi.

### DDL Schema:
```sql
CREATE TABLE song_artists (
  song_id     TEXT NOT NULL,
  artist_id   TEXT NOT NULL,
  artist_name TEXT NOT NULL,
  role        TEXT DEFAULT 'primary',
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (song_id, artist_id)
);

CREATE INDEX idx_song_artists_song ON song_artists(song_id);
CREATE INDEX idx_song_artists_artist ON song_artists(artist_id);
CREATE INDEX idx_song_artists_name ON song_artists(artist_name);
```

### Kamus Kolom (`song_artists`):
| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `song_id` | TEXT | NO | - | Foreign Key mengarah ke `songs.id`. |
| `artist_id` | TEXT | NO | - | Foreign Key mengarah ke `artists.id`. |
| `artist_name` | TEXT | NO | - | Denormalisasi nama artis untuk percepatan query. |
| `role` | TEXT | YES | `'primary'` | Peran artis: `'primary'` (utama), `'duet'`, `'featured'` (fitur). |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Timestamp relasi dibuat. |

---

## ⚙️ 5. Tabel `app_settings` (Konfigurasi Dinamis Game)

Menyimpan tuning konfigurasi mesin kuis dan gameplay yang dapat disesuaikan lewat Studio Admin (`/admin`) secara real-time tanpa perlu deployment ulang kode.

### DDL Schema:
```sql
CREATE TABLE app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

### Konfigurasi Kunci yang Didukung:
| Key | Format Value | Nilai Standar | Keterangan |
| :--- | :--- | :--- | :--- |
| `buzzerTimerSeconds` | Number (JSON) | `15` | Waktu hitung mundur bagi pemain yang menekan buzzer. |
| `playerLivesPerRound` | Number (JSON) | `3` | Jumlah nyawa tebakan per pemain per ronde. |
| `clueExtensionIntervalSeconds` | Number (JSON) | `10` | Durasi jeda antar pembukaan bait lirik (Tahap 1–4). |
| `heardleDurations` | Array (JSON) | `[5, 9, 18, 30]` | Kurva pembukaan detik audio pada mode Heardle. |
| `disabled_genres` | Array (JSON) | `[]` | Daftar nama genre yang dinonaktifkan dari kuis kustom. |
| `defaultRounds` | Number (JSON) | `5` | Jumlah ronde standar permainan. |

---

## 🏆 6. Tabel `leaderboard` (Papan Peringkat Skor)

Mencatat riwayat skor dan rekor kemenangan pemain di seluruh mode permainan. Tetap aman dari foreign key constraint error ketika user dihapus/di-soft delete.

### DDL Schema:
```sql
CREATE TABLE leaderboard (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  player_name   TEXT NOT NULL,
  player_avatar TEXT,
  mode          TEXT NOT NULL,
  category      TEXT NOT NULL,
  difficulty    TEXT NOT NULL,
  score         INTEGER NOT NULL,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_leaderboard_score ON leaderboard(score DESC);
CREATE INDEX idx_leaderboard_mode ON leaderboard(mode);
```

### Kamus Kolom (`leaderboard`):
| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `id` | TEXT | NO | - | Primary Key UUID riwayat permainan. |
| `user_id` | TEXT | YES | NULL | ID akun pemain jika login via Google. |
| `player_name` | TEXT | NO | - | Nama display pemain saat game berlangsung. |
| `player_avatar` | TEXT | YES | NULL | Emoji avatar pemain (misal: 👑, 🦁, ⚡). |
| `mode` | TEXT | NO | - | Mode kuis: `heardle`, `tts`, `humming`, `multiplayer`. |
| `category` | TEXT | NO | - | Genre lagu yang dimainkan pada sesi tersebut. |
| `difficulty` | TEXT | NO | - | Tingkat kesulitan sesi game. |
| `score` | INTEGER | NO | - | Total skor akhir perolehan pemain. |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Waktu pencatatan skor. |

---

## 👤 7. Tabel `users` (Manajemen Akun Pemain & Soft Delete)

Menyimpan profil pemain yang login menggunakan Google OAuth dengan dukungan penghapusan akun berbasis **Soft Delete** (`is_active` dan `deleted_at`).

### DDL Schema:
```sql
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  name         TEXT NOT NULL,
  avatar       TEXT,
  total_score  INTEGER DEFAULT 0,
  games_played INTEGER DEFAULT 0,
  wins         INTEGER DEFAULT 0,
  is_active    INTEGER DEFAULT 1,
  deleted_at   DATETIME DEFAULT NULL,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Kamus Kolom (`users`):
| Nama Kolom | Tipe Data | Nullable | Default | Deskripsi |
| :--- | :--- | :---: | :---: | :--- |
| `id` | TEXT | NO | - | ID subjek unik Google OAuth atau UUID user. |
| `email` | TEXT | NO | - | Alamat email resmi pemain (Unique constraint). |
| `name` | TEXT | NO | - | Nama lengkap profil. |
| `avatar` | TEXT | YES | NULL | URL foto avatar Google profil. |
| `total_score` | INTEGER | YES | 0 | Akumulasi skor seumur hidup dari seluruh game. |
| `games_played` | INTEGER | YES | 0 | Jumlah sesi permainan yang telah diselesaikan. |
| `wins` | INTEGER | YES | 0 | Total kemenangan juara 1 (khusus multiplayer). |
| `is_active` | INTEGER | YES | 1 | Status akun: `1` = Aktif, `0` = Dihapus (Soft delete). |
| `deleted_at` | DATETIME | YES | NULL | Timestamp waktu pemain meminta penghapusan akun. |
| `created_at` | DATETIME | YES | CURRENT_TIMESTAMP | Tanggal pertama kali mendaftar / login. |
| `updated_at` | DATETIME | YES | CURRENT_TIMESTAMP | Tanggal update terakhir. |

---

## 📌 Rencana Kolom Tambahan (YouTube Audio Engine):
Saat integrasi YouTube Full Audio Engine diaktifkan nanti:
```sql
ALTER TABLE songs ADD COLUMN youtube_id TEXT;
```
* `youtube_id`: Menyimpan 11 karakter ID video YouTube resmi (misal: `sjjhLDPT5_g` untuk Dewa 19 - Kangen).
