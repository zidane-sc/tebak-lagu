"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Music,
  Plus,
  Search,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Edit2,
  Trash2,
  Settings,
  Flame,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Zap,
  Shield,
  Layers,
  Lock,
  Unlock,
  Radio,
  ExternalLink,
  Loader2,
  AlertCircle,
  BarChart3,
  TrendingUp,
  Skull,
  Award,
  Users,
  CheckCircle2,
  XCircle,
  Activity,
  Trophy,
} from "lucide-react";
import { CATEGORIES, DIFFICULTIES } from "@/data/songs";

export default function AdminDashboardPage() {
  // Authentication PIN
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  // Active Tab: "catalog" | "analytics" | "voicelab" | "settings"
  const [activeTab, setActiveTab] = useState<"catalog" | "analytics" | "voicelab" | "settings">("catalog");

  // Analytics State
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);

  // Catalog State
  const [songs, setSongs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSongs, setTotalSongs] = useState(0);
  const [filteredTotal, setFilteredTotal] = useState(0);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState("all");

  // Audio Preview in Table
  const [playingSongId, setPlayingSongId] = useState<string | null>(null);
  const tableAudioRef = useRef<HTMLAudioElement | null>(null);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [activeSong, setActiveSong] = useState<any>(null);

  // Add / Edit Form State
  const [formTitle, setFormTitle] = useState("");
  const [formArtist, setFormArtist] = useState("");
  const [formYear, setFormYear] = useState("2024");
  const [formCategory, setFormCategory] = useState("Galau Hits");
  const [formDifficulty, setFormDifficulty] = useState("easy");
  const [formPopularity, setFormPopularity] = useState(90);
  const [formPreviewUrl, setFormPreviewUrl] = useState("");
  const [formAlbumCover, setFormAlbumCover] = useState("");

  // Apple Music Online Search in Add Modal
  const [onlineSearchQuery, setOnlineSearchQuery] = useState("");
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [onlineResults, setOnlineResults] = useState<any[]>([]);

  // Voice Lab State
  const [voiceLabText, setVoiceLabText] = useState("Kutuliskan kenangan tentang caraku menemukan dirimu");
  const [voiceLabProfile, setVoiceLabProfile] = useState<"normal" | "bass" | "fast">("normal");
  const [isVoiceLabPlaying, setIsVoiceLabPlaying] = useState(false);
  const voiceLabAudioRef = useRef<HTMLAudioElement | null>(null);

  // Settings State
  const [gameSettings, setGameSettings] = useState<any>({
    buzzerTimerSeconds: 20,
    playerLivesPerRound: 3,
    clueExtensionIntervalSeconds: 30,
    finalStageSeconds: 90,
    disconnectGracePeriodSeconds: 45,
    defaultRounds: 5,
    defaultDifficulty: "easy",
    defaultAudioProfile: "normal",
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  // Check PIN from storage
  useEffect(() => {
    const savedPin = localStorage.getItem("tebak_lagu_admin_auth");
    if (savedPin === "unlocked") {
      setIsUnlocked(true);
    }
  }, []);

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim().toLowerCase() === "zidane" || pinInput.trim() === "1234" || pinInput.trim() === "admin") {
      setIsUnlocked(true);
      localStorage.setItem("tebak_lagu_admin_auth", "unlocked");
      setPinError(false);
      showToast("Selamat datang di Studio Admin! 👑");
    } else {
      setPinError(true);
    }
  };

  const handleLock = () => {
    setIsUnlocked(false);
    localStorage.removeItem("tebak_lagu_admin_auth");
    setPinInput("");
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch songs
  const fetchSongs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        search: debouncedSearch,
        category: selectedCategory,
        difficulty: selectedDifficulty,
      });

      const res = await fetch(`/api/admin/songs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
        setStats(data.stats);
        setTotalSongs(data.total);
        setFilteredTotal(data.filteredTotal);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.error("Fetch songs error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch settings
  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setGameSettings(data);
      }
    } catch (err) {}
  };

  const fetchAnalytics = async () => {
    setIsLoadingAnalytics(true);
    try {
      const res = await fetch("/api/admin/analytics");
      if (res.ok) {
        const data = await res.json();
        setAnalyticsData(data);
      }
    } catch (err) {
      console.error("Fetch analytics error:", err);
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) {
      fetchSongs();
    }
  }, [isUnlocked, page, debouncedSearch, selectedCategory, selectedDifficulty]);

  useEffect(() => {
    if (isUnlocked && activeTab === "settings") {
      fetchSettings();
    }
    if (isUnlocked && activeTab === "analytics") {
      fetchAnalytics();
    }
  }, [isUnlocked, activeTab]);

  // Audio Preview toggle in Table
  const togglePlayAudio = (song: any) => {
    if (playingSongId === song.id) {
      tableAudioRef.current?.pause();
      setPlayingSongId(null);
      return;
    }

    if (!song.previewUrl && !song.previewFallback) {
      showToast("Lagu ini tidak memiliki preview audio!", "error");
      return;
    }

    if (!tableAudioRef.current) {
      tableAudioRef.current = new Audio();
      tableAudioRef.current.onended = () => setPlayingSongId(null);
    }

    tableAudioRef.current.src = song.previewUrl || song.previewFallback;
    tableAudioRef.current.currentTime = song.startSecond || 0;
    tableAudioRef.current
      .play()
      .then(() => setPlayingSongId(song.id))
      .catch((err) => {
        console.error("Play preview error:", err);
        showToast("Gagal memutar audio preview.", "error");
      });
  };

  // Stop table audio when unmounting
  useEffect(() => {
    return () => {
      tableAudioRef.current?.pause();
      voiceLabAudioRef.current?.pause();
    };
  }, []);

  // Online Search via Apple Music API
  const handleOnlineSearch = async () => {
    if (!onlineSearchQuery.trim()) return;
    setIsSearchingOnline(true);
    try {
      const res = await fetch(`/api/songs/search?q=${encodeURIComponent(onlineSearchQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setOnlineResults(data.results || []);
      }
    } catch (e) {
      showToast("Gagal mencari lagu online", "error");
    } finally {
      setIsSearchingOnline(false);
    }
  };

  const handleSelectOnlineResult = (r: any) => {
    setFormTitle(r.title);
    setFormArtist(r.artist);
    setFormYear(r.year?.toString() || "2024");
    setFormPreviewUrl(r.previewUrl || "");
    setFormAlbumCover(r.artworkUrl || "");
    showToast(`Data lagu "${r.title}" berhasil diisi otomatis! 🎵`);
  };

  // Open Add Modal
  const openAddModal = () => {
    setFormTitle("");
    setFormArtist("");
    setFormYear("2024");
    setFormCategory("Galau Hits");
    setFormDifficulty("easy");
    setFormPopularity(90);
    setFormPreviewUrl("");
    setFormAlbumCover("");
    setOnlineSearchQuery("");
    setOnlineResults([]);
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (song: any) => {
    setActiveSong(song);
    setFormTitle(song.title);
    setFormArtist(song.artist);
    setFormYear(song.year?.toString() || "2020");
    setFormCategory(song.category || "Galau Hits");
    setFormDifficulty(song.difficulty || "easy");
    setFormPopularity(song.popularity || 80);
    setFormPreviewUrl(song.previewUrl || song.previewResolved || "");
    setFormAlbumCover(song.albumCover || "");
    setShowEditModal(true);
  };

  // Open Delete Modal
  const openDeleteModal = (song: any) => {
    setActiveSong(song);
    setShowDeleteModal(true);
  };

  // Submit Add Song
  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formArtist.trim()) {
      showToast("Judul dan Artis wajib diisi!", "error");
      return;
    }

    try {
      const res = await fetch("/api/admin/songs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle,
          artist: formArtist,
          year: formYear,
          category: formCategory,
          difficulty: formDifficulty,
          popularity: formPopularity,
          previewUrl: formPreviewUrl,
          albumCover: formAlbumCover,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Lagu berhasil ditambahkan!");
        setShowAddModal(false);
        fetchSongs();
      } else {
        showToast(data.error || "Gagal menambahkan lagu", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Submit Edit Song
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSong) return;

    try {
      const res = await fetch("/api/admin/songs", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: activeSong.id,
          title: formTitle,
          artist: formArtist,
          year: formYear,
          category: formCategory,
          difficulty: formDifficulty,
          popularity: formPopularity,
          previewUrl: formPreviewUrl,
          albumCover: formAlbumCover,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Perubahan berhasil disimpan!");
        setShowEditModal(false);
        fetchSongs();
      } else {
        showToast(data.error || "Gagal menyimpan perubahan", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Submit Delete Song
  const handleConfirmDelete = async () => {
    if (!activeSong) return;

    try {
      const res = await fetch(`/api/admin/songs?id=${encodeURIComponent(activeSong.id)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (res.ok) {
        showToast(data.message || "Lagu berhasil dihapus.");
        setShowDeleteModal(false);
        if (playingSongId === activeSong.id) {
          tableAudioRef.current?.pause();
          setPlayingSongId(null);
        }
        fetchSongs();
      } else {
        showToast(data.error || "Gagal menghapus lagu", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Voice Lab Playback
  const handleVoiceLabPlay = () => {
    if (!voiceLabAudioRef.current) {
      voiceLabAudioRef.current = new Audio();
      voiceLabAudioRef.current.onended = () => setIsVoiceLabPlaying(false);
    }

    if (isVoiceLabPlaying) {
      voiceLabAudioRef.current.pause();
      setIsVoiceLabPlaying(false);
      return;
    }

    const speed = voiceLabProfile === "fast" ? "1.25" : voiceLabProfile === "bass" ? "0.8" : "1";
    voiceLabAudioRef.current.src = `/api/tts?text=${encodeURIComponent(voiceLabText)}&speed=${speed}`;

    if (voiceLabProfile === "fast") {
      voiceLabAudioRef.current.playbackRate = 1.3;
    } else if (voiceLabProfile === "bass") {
      voiceLabAudioRef.current.playbackRate = 0.85;
    } else {
      voiceLabAudioRef.current.playbackRate = 1.0;
    }

    voiceLabAudioRef.current
      .play()
      .then(() => setIsVoiceLabPlaying(true))
      .catch(() => setIsVoiceLabPlaying(false));
  };

  // Save Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(gameSettings),
      });

      const data = await res.json();
      if (res.ok) {
        showToast("Pengaturan game berhasil disimpan ke server!");
        setSettingsSaveMsg("Tersimpan!");
        setTimeout(() => setSettingsSaveMsg(null), 2500);
      } else {
        showToast(data.error || "Gagal menyimpan pengaturan", "error");
      }
    } catch (e: any) {
      showToast(e.message, "error");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // -------------------------------------------------------------
  // PIN LOCK SCREEN (If not authenticated)
  // -------------------------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-accentDim selection:text-accent">
        <div className="bg-surface border border-surfaceBorder rounded-2xl p-6 sm:p-8 max-w-sm w-full flex flex-col items-center gap-5 text-center shadow-2xl relative">
          <div className="w-14 h-14 rounded-2xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent shadow-sm">
            <Lock className="w-7 h-7" />
          </div>

          <div>
            <span className="text-[10px] font-mono text-mutedDark font-semibold uppercase tracking-widest">
              STUDIO OTORISASI
            </span>
            <h2 className="text-xl font-black text-white mt-1">Tebak Lagu Admin</h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Halaman khusus untuk mengelola ribuan katalog musik, kurasi tingkat kesulitan, dan tuning gameplay.
            </p>
          </div>

          <form onSubmit={handleUnlock} className="w-full flex flex-col gap-3">
            <input
              type="password"
              placeholder="Masukkan Passcode (zidane)"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              className="w-full text-center font-mono text-base bg-surfaceRaised border border-surfaceBorder focus:border-accent rounded-xl py-3 text-white outline-none transition"
              autoFocus
            />

            {pinError && (
              <span className="text-xs text-rose-400 font-mono animate-shake">
                Passcode salah! Gunakan: zidane
              </span>
            )}

            <button
              type="submit"
              className="w-full bg-accent hover:bg-green-500 text-zinc-950 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md shadow-accent/20 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              <span>Buka Studio Admin</span>
            </button>
          </form>

          <Link
            href="/"
            className="text-xs text-muted hover:text-white flex items-center gap-1 font-mono transition"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Kembali ke Game</span>
          </Link>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // MAIN ADMIN DASHBOARD
  // -------------------------------------------------------------
  return (
    <div className="min-h-[100dvh] bg-background text-zinc-100 flex flex-col justify-between p-4 sm:p-6 max-w-6xl mx-auto selection:bg-accentDim selection:text-accent relative">
      {/* Toast Notification */}
      {toastMsg && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl border text-xs font-mono font-semibold flex items-center gap-2 shadow-2xl animate-fade-in ${
            toastMsg.type === "success"
              ? "bg-surfaceRaised border-accent/40 text-accent"
              : "bg-surfaceRaised border-rose-500/40 text-rose-400"
          }`}
        >
          {toastMsg.type === "success" ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-surfaceBorder">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent">
            <Music className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-white tracking-tight">
                Studio Admin · Tebak Lagu
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-accentDim border border-accent/30 text-accent font-bold">
                PROD
              </span>
            </div>
            <p className="text-xs text-muted font-mono">
              Kelola {totalSongs.toLocaleString()} lagu, popularitas, dan pengaturan game
            </p>
          </div>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={openAddModal}
            className="bg-accent hover:bg-green-500 text-zinc-950 font-bold py-2 px-3.5 rounded-xl flex items-center gap-1.5 transition active:scale-95 text-xs shadow-md shadow-accent/20 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Lagu</span>
          </button>

          <Link
            href="/multiplayer"
            className="bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-200 py-2 px-3 rounded-xl flex items-center gap-1.5 transition text-xs font-mono"
          >
            <Zap className="w-3.5 h-3.5 text-accent" />
            <span>Multiplayer</span>
          </Link>

          <Link
            href="/"
            className="bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-200 py-2 px-3 rounded-xl flex items-center gap-1.5 transition text-xs font-mono"
          >
            <span>Solo Game</span>
          </Link>

          <button
            onClick={handleLock}
            className="p-2 rounded-xl text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
            title="Kunci Dashboard"
          >
            <Lock className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Overview Metrics Cards */}
      {stats && (
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-mono text-mutedDark font-semibold">TOTAL KATALOG</span>
            <span className="text-2xl font-black text-white">{stats.total?.toLocaleString()}</span>
            <span className="text-[10px] text-zinc-400 font-mono">Audio CDN Apple Active</span>
          </div>

          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-mono text-emerald-400 font-semibold">🟢 MUDAH (MEGA HITS)</span>
            <span className="text-2xl font-black text-emerald-400">{stats.easy?.toLocaleString()}</span>
            <span className="text-[10px] text-muted font-mono">{Math.round((stats.easy / stats.total) * 100)}% dari seluruh katalog</span>
          </div>

          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-mono text-amber-400 font-semibold">🟡 SEDANG (POPULER)</span>
            <span className="text-2xl font-black text-amber-400">{stats.medium?.toLocaleString()}</span>
            <span className="text-[10px] text-muted font-mono">{Math.round((stats.medium / stats.total) * 100)}% single radio</span>
          </div>

          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
            <span className="text-[11px] font-mono text-rose-400 font-semibold">🔴 SULIT (SEPUH)</span>
            <span className="text-2xl font-black text-rose-400">{stats.hard?.toLocaleString()}</span>
            <span className="text-[10px] text-muted font-mono">{Math.round((stats.hard / stats.total) * 100)}% b-side & deep cuts</span>
          </div>
        </section>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-surfaceBorder pb-3 mt-2">
        <button
          onClick={() => setActiveTab("catalog")}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "catalog"
              ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm"
              : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
          }`}
        >
          <Music className="w-4 h-4" />
          <span>Katalog Musik ({filteredTotal})</span>
        </button>

        <button
          onClick={() => setActiveTab("analytics")}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "analytics"
              ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm"
              : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
          }`}
        >
          <BarChart3 className="w-4 h-4 text-accent" />
          <span>Statistik & Analitik Game</span>
        </button>

        <button
          onClick={() => setActiveTab("voicelab")}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "voicelab"
              ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm"
              : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
          }`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Audio & Voice Lab</span>
        </button>

        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-semibold transition cursor-pointer ${
            activeTab === "settings"
              ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm"
              : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>Pengaturan Game</span>
        </button>
      </div>

      {/* ============================================================= */}
      {/* TAB 1: CATALOG MANAGER */}
      {/* ============================================================= */}
      {activeTab === "catalog" && (
        <section className="flex flex-col gap-4 my-4 flex-1">
          {/* Search & Filter Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-surface border border-surfaceBorder rounded-2xl p-3.5 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-3 text-mutedDark" />
              <input
                type="text"
                placeholder="Cari judul lagu atau nama penyanyi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-mutedDark outline-none focus:border-accent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-2.5 text-muted hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setPage(1);
                }}
                className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-accent"
              >
                <option value="all">Semua Genre</option>
                {CATEGORIES.filter((c) => c !== "Semua Genre").map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              {/* Difficulty Filter */}
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setPage(1);
                }}
                className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2 text-xs font-mono text-zinc-200 outline-none focus:border-accent"
              >
                <option value="all">Semua Kesulitan</option>
                <option value="easy">🟢 Mudah (Mega Hits)</option>
                <option value="medium">🟡 Sedang (Populer)</option>
                <option value="hard">🔴 Sulit (Sepuh)</option>
              </select>

              <button
                onClick={fetchSongs}
                className="p-2 rounded-xl text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
                title="Refresh Data"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin text-accent" : ""}`} />
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-surfaceBorder bg-surfaceRaised/60 font-mono text-mutedDark text-[11px]">
                    <th className="py-3 px-4 w-12 text-center">PLAY</th>
                    <th className="py-3 px-4">JUDUL & ARTIS</th>
                    <th className="py-3 px-4">GENRE</th>
                    <th className="py-3 px-4 text-center">KESULITAN</th>
                    <th className="py-3 px-4 text-center">TAHUN</th>
                    <th className="py-3 px-4 text-right">AKSI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surfaceBorder/60">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted">
                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-accent mb-2" />
                        <span>Memuat data lagu...</span>
                      </td>
                    </tr>
                  ) : songs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted font-mono">
                        Tidak ada lagu yang cocok dengan pencarian.
                      </td>
                    </tr>
                  ) : (
                    songs.map((song) => {
                      const isPlaying = playingSongId === song.id;
                      return (
                        <tr
                          key={song.id}
                          className="hover:bg-surfaceRaised/40 transition group"
                        >
                          {/* Audio Player Action */}
                          <td className="py-2.5 px-4 text-center">
                            <button
                              onClick={() => togglePlayAudio(song)}
                              className={`w-7 h-7 rounded-full flex items-center justify-center transition active:scale-95 cursor-pointer ${
                                isPlaying
                                  ? "bg-accent text-zinc-950 font-bold shadow-md shadow-accent/30 animate-pulse"
                                  : "bg-surfaceRaised border border-surfaceBorder text-zinc-300 hover:text-white hover:border-accent"
                              }`}
                              title={isPlaying ? "Jeda Audio" : "Dengarkan Cuplikan"}
                            >
                              {isPlaying ? (
                                <Pause className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current ml-0.5" />
                              )}
                            </button>
                          </td>

                          {/* Song Info */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-3">
                              {song.albumCover ? (
                                <img
                                  src={song.albumCover}
                                  alt={song.title}
                                  className="w-9 h-9 rounded-lg object-cover border border-surfaceBorder flex-shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-muted flex-shrink-0">
                                  <Music className="w-4 h-4" />
                                </div>
                              )}
                              <div className="flex flex-col min-w-0">
                                <span className="font-bold text-white truncate max-w-xs sm:max-w-sm">
                                  {song.title}
                                </span>
                                <span className="text-[11px] text-muted truncate max-w-xs">
                                  {song.artist}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Category */}
                          <td className="py-2.5 px-4">
                            <span className="font-mono text-[11px] text-zinc-300">
                              {song.category}
                            </span>
                          </td>

                          {/* Difficulty */}
                          <td className="py-2.5 px-4 text-center">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                                song.difficulty === "easy"
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                                  : song.difficulty === "medium"
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                  : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                              }`}
                            >
                              {song.difficulty === "easy"
                                ? "🟢 Mudah"
                                : song.difficulty === "medium"
                                ? "🟡 Sedang"
                                : "🔴 Sulit"}
                            </span>
                          </td>

                          {/* Year */}
                          <td className="py-2.5 px-4 text-center font-mono text-zinc-400">
                            {song.year || "—"}
                          </td>

                          {/* Actions */}
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditModal(song)}
                                className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surfaceRaised transition"
                                title="Edit Lagu"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => openDeleteModal(song)}
                                className="p-1.5 rounded-lg text-muted hover:text-rose-400 hover:bg-rose-500/10 transition"
                                title="Hapus Lagu"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Strip */}
            <div className="flex items-center justify-between p-3.5 border-t border-surfaceBorder bg-surfaceRaised/40 text-xs font-mono">
              <span className="text-muted">
                Menampilkan {(page - 1) * 25 + 1} -{" "}
                {Math.min(page * 25, filteredTotal)} dari {filteredTotal.toLocaleString()} lagu
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-surface border border-surfaceBorder text-muted hover:text-white disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-2 text-zinc-300 font-semibold">
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-surface border border-surfaceBorder text-muted hover:text-white disabled:opacity-40 disabled:pointer-events-none transition"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/* TAB 2: VOICE & AUDIO LAB */}
      {/* ============================================================= */}
      {activeTab === "voicelab" && (
        <section className="flex flex-col gap-4 my-4 max-w-2xl mx-auto w-full">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-6 flex flex-col gap-4 shadow-sm">
            <div>
              <span className="text-[10px] font-mono text-accent font-semibold uppercase tracking-wider">
                AUDIO TESTING GROUND
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">Voice & TTS Profile Lab</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Uji langsung pembacaan suara robot dengan 3 profil audio (Datar, Bass, Cepat).
              </p>
            </div>

            {/* Text Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">
                TEKS LIRIK UNTUK DITES
              </label>
              <textarea
                rows={3}
                value={voiceLabText}
                onChange={(e) => setVoiceLabText(e.target.value)}
                className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-3 text-xs text-white outline-none focus:border-accent transition resize-none"
              />
            </div>

            {/* Profile Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-mono text-mutedDark font-semibold">
                PROFIL SUARA ROBOT
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "normal", label: "Datar 🤖", desc: "Monotone Speed 1.0x" },
                  { id: "bass", label: "Bass Booster 🔊", desc: "Berat Speed 0.85x" },
                  { id: "fast", label: "Cepat ⚡", desc: "Chipmunk Speed 1.3x" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setVoiceLabProfile(p.id as any);
                      if (isVoiceLabPlaying) voiceLabAudioRef.current?.pause();
                      setIsVoiceLabPlaying(false);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-center transition flex flex-col items-center ${
                      voiceLabProfile === p.id
                        ? "bg-zinc-100 text-zinc-950 font-bold shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">{p.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">{p.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Play Button */}
            <button
              onClick={handleVoiceLabPlay}
              className={`w-full py-3.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition active:scale-95 shadow-md cursor-pointer ${
                isVoiceLabPlaying
                  ? "bg-rose-500 hover:bg-rose-600 text-white"
                  : "bg-accent hover:bg-green-500 text-zinc-950 shadow-accent/20"
              }`}
            >
              {isVoiceLabPlaying ? (
                <>
                  <Pause className="w-4 h-4 fill-current" />
                  <span>Hentikan Suara</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Dengarkan Pembacaan Suara Robot</span>
                </>
              )}
            </button>
          </div>
        </section>
      )}

      {/* ============================================================= */}
      {/* TAB 3: GAME SETTINGS */}
      {/* ============================================================= */}
      {activeTab === "settings" && (
        <section className="flex flex-col gap-4 my-4 max-w-2xl mx-auto w-full">
          <form
            onSubmit={handleSaveSettings}
            className="bg-surface border border-surfaceBorder rounded-2xl p-6 flex flex-col gap-5 shadow-sm"
          >
            <div>
              <span className="text-[10px] font-mono text-accent font-semibold uppercase tracking-wider">
                SERVER CONFIGURATION
              </span>
              <h3 className="text-lg font-bold text-white mt-0.5">Tuning Gameplay & Rule Engine</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Sesuaikan durasi timer, batas nyawa, dan aturan perpanjangan lirik di arena multiplayer.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Guess Timer */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  DURASI TEBAKAN BUZZER (DETIK)
                </label>
                <input
                  type="number"
                  min={10}
                  max={45}
                  value={gameSettings.buzzerTimerSeconds || 20}
                  onChange={(e) =>
                    setGameSettings({ ...gameSettings, buzzerTimerSeconds: parseInt(e.target.value, 10) })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Lives */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  JUMLAH NYAWA PER RONDE
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={gameSettings.playerLivesPerRound || 3}
                  onChange={(e) =>
                    setGameSettings({ ...gameSettings, playerLivesPerRound: parseInt(e.target.value, 10) })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Clue Interval */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  INTERVAL PERPANJANG CLUE (DETIK)
                </label>
                <input
                  type="number"
                  min={15}
                  max={60}
                  value={gameSettings.clueExtensionIntervalSeconds || 30}
                  onChange={(e) =>
                    setGameSettings({
                      ...gameSettings,
                      clueExtensionIntervalSeconds: parseInt(e.target.value, 10),
                    })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Final Stage */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  DURASI TAHAP TERAKHIR (DETIK)
                </label>
                <input
                  type="number"
                  min={30}
                  max={120}
                  value={gameSettings.finalStageSeconds || 90}
                  onChange={(e) =>
                    setGameSettings({ ...gameSettings, finalStageSeconds: parseInt(e.target.value, 10) })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Reconnect Grace Period */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  GRACE PERIOD DISCONNECT (DETIK)
                </label>
                <input
                  type="number"
                  min={15}
                  max={90}
                  value={gameSettings.disconnectGracePeriodSeconds || 45}
                  onChange={(e) =>
                    setGameSettings({
                      ...gameSettings,
                      disconnectGracePeriodSeconds: parseInt(e.target.value, 10),
                    })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>

              {/* Default Rounds */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-mono text-mutedDark font-semibold">
                  DEFAULT RONDE MULTIPLAYER
                </label>
                <input
                  type="number"
                  min={3}
                  max={15}
                  value={gameSettings.defaultRounds || 5}
                  onChange={(e) =>
                    setGameSettings({ ...gameSettings, defaultRounds: parseInt(e.target.value, 10) })
                  }
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                />
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-surfaceBorder mt-2">
              <span className="text-xs font-mono text-emerald-400">
                {settingsSaveMsg || "Siap disimpan ke server"}
              </span>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="bg-accent hover:bg-green-500 text-zinc-950 font-bold py-2.5 px-5 rounded-xl flex items-center gap-1.5 transition active:scale-95 text-xs shadow-md shadow-accent/20 cursor-pointer"
              >
                {isSavingSettings ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Check className="w-4 h-4" />
                )}
                <span>Simpan Pengaturan</span>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ============================================================= */}
      {/* TAB 4: GAMEPLAY ANALYTICS & INSIGHTS */}
      {/* ============================================================= */}
      {activeTab === "analytics" && (
        <section className="flex flex-col gap-6 my-4 flex-1 animate-fade-in">
          {/* Header & Refresh */}
          <div className="flex items-center justify-between bg-surface border border-surfaceBorder rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accentDim border border-accent/30 flex items-center justify-center text-accent">
                <BarChart3 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  Statistik & Analitik Game
                </h3>
                <p className="text-xs text-muted">
                  Pantau performa tebakan, lagu paling gampang, lagu paling angker, dan aktivitas komunitas
                </p>
              </div>
            </div>

            <button
              onClick={fetchAnalytics}
              disabled={isLoadingAnalytics}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-xs font-semibold text-muted hover:text-white transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAnalytics ? "animate-spin text-accent" : ""}`} />
              <span>Segarkan</span>
            </button>
          </div>

          {isLoadingAnalytics && !analyticsData ? (
            <div className="p-16 text-center text-xs text-muted font-mono flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-accent" />
              <span>Memuat data analitik game...</span>
            </div>
          ) : !analyticsData ? (
            <div className="p-12 text-center text-xs text-muted font-mono bg-surface border border-surfaceBorder rounded-2xl">
              Gagal memuat data analitik. Coba klik tombol Segarkan di atas.
            </div>
          ) : (
            <>
              {/* 4 Overview Stat Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
                  <span className="text-[11px] font-mono text-muted uppercase">Total Putaran Dimainkan</span>
                  <span className="text-2xl font-black text-white font-mono">
                    {analyticsData.overview?.totalPlays?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] text-mutedDark font-mono">Solo + Multiplayer</span>
                </div>

                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
                  <span className="text-[11px] font-mono text-accent uppercase">Akurasi Tebakan Global</span>
                  <span className="text-2xl font-black text-accent font-mono">
                    {analyticsData.overview?.globalAccuracy || 0}%
                  </span>
                  <span className="text-[10px] text-mutedDark font-mono">
                    {analyticsData.overview?.totalGuesses?.toLocaleString() || 0} Benar · {analyticsData.overview?.totalFails?.toLocaleString() || 0} Gagal
                  </span>
                </div>

                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
                  <span className="text-[11px] font-mono text-sky-400 uppercase">Pemain Terdaftar</span>
                  <span className="text-2xl font-black text-sky-400 font-mono">
                    {analyticsData.overview?.totalUsers?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] text-mutedDark font-mono">
                    {analyticsData.overview?.totalScoreAwarded?.toLocaleString() || 0} Pts didistribusikan
                  </span>
                </div>

                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-1 shadow-sm">
                  <span className="text-[11px] font-mono text-amber-400 uppercase">Rekor Leaderboard</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {analyticsData.overview?.totalMatchesRecorded?.toLocaleString() || 0}
                  </span>
                  <span className="text-[10px] text-mutedDark font-mono">Pertandingan tuntas tercatat</span>
                </div>
              </div>

              {/* 2-Column: Easiest vs Hardest Songs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* 🟢 TOP 10 LAGU PALING GAMPANG */}
                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-surfaceBorder">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-xs sm:text-sm text-white">
                        Lagu Paling Gampang (Akurasi Tinggi)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                      Top 10 Mudah
                    </span>
                  </div>

                  {analyticsData.easiestSongs?.length === 0 ? (
                    <p className="text-xs text-muted font-mono p-4 text-center">
                      Belum ada data lagu dengan tebakan sukses. Mainkan beberapa ronde terlebih dahulu!
                    </p>
                  ) : (
                    <div className="divide-y divide-surfaceBorder/60">
                      {analyticsData.easiestSongs?.map((s: any, idx: number) => (
                        <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-4 font-mono font-bold text-xs text-muted text-center">
                              #{idx + 1}
                            </span>
                            {s.album_cover ? (
                              <img
                                src={s.album_cover}
                                alt={s.title}
                                className="w-8 h-8 rounded-lg object-cover border border-surfaceBorder shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                                <Music className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-white truncate">{s.title}</p>
                              <p className="text-[11px] text-muted truncate">
                                {s.artist} · <span className="font-mono text-[10px]">{s.category}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="text-xs font-bold text-emerald-400 block">
                              {s.accuracy}%
                            </span>
                            <span className="text-[10px] text-muted">
                              {s.times_guessed}/{s.times_played}x tebak
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 💀 TOP 10 LAGU PALING ANGKER / FRUSTRASI */}
                <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between pb-2 border-b border-surfaceBorder">
                    <div className="flex items-center gap-2">
                      <Skull className="w-4 h-4 text-rose-400" />
                      <h4 className="font-bold text-xs sm:text-sm text-white">
                        Lagu Paling Angker (Sering Gagal / Nyerah)
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                      Top 10 Sulit
                    </span>
                  </div>

                  {analyticsData.hardestSongs?.length === 0 ? (
                    <p className="text-xs text-muted font-mono p-4 text-center">
                      Belum ada data lagu dengan kegagalan tebak.
                    </p>
                  ) : (
                    <div className="divide-y divide-surfaceBorder/60">
                      {analyticsData.hardestSongs?.map((s: any, idx: number) => (
                        <div key={s.id} className="py-2.5 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-4 font-mono font-bold text-xs text-muted text-center">
                              #{idx + 1}
                            </span>
                            {s.album_cover ? (
                              <img
                                src={s.album_cover}
                                alt={s.title}
                                className="w-8 h-8 rounded-lg object-cover border border-surfaceBorder shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-zinc-400 shrink-0">
                                <Music className="w-3.5 h-3.5" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="font-semibold text-xs text-white truncate">{s.title}</p>
                              <p className="text-[11px] text-muted truncate">
                                {s.artist} · <span className="font-mono text-[10px]">{s.category}</span>
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-mono">
                            <span className="text-xs font-bold text-rose-400 block">
                              {s.fail_rate}% Gagal
                            </span>
                            <span className="text-[10px] text-muted">
                              {s.times_failed}/{s.times_played}x hangus
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Genre Popularity & Plays Breakdown */}
              <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center gap-2 pb-2 border-b border-surfaceBorder">
                  <Activity className="w-4 h-4 text-accent" />
                  <h4 className="font-bold text-xs sm:text-sm text-white">
                    Sebaran Popularitas Putaran per Kategori Genre
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  {analyticsData.genreStats?.map((g: any) => {
                    const totalAllGenrePlays = analyticsData.overview?.totalPlays || 1;
                    const percent = Math.round((g.total_plays / Math.max(1, totalAllGenrePlays)) * 100);

                    return (
                      <div key={g.category} className="bg-surfaceRaised p-3 rounded-xl border border-surfaceBorder flex flex-col gap-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-white">{g.category}</span>
                          <span className="font-mono text-muted text-[11px]">
                            {g.total_plays}x diputar ({g.song_count} lagu)
                          </span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-accent h-full rounded-full transition-all duration-500"
                            style={{ width: `${Math.max(4, percent)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Live Recent Matches Feed */}
              <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-surfaceBorder">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <h4 className="font-bold text-xs sm:text-sm text-white">
                      Aktivitas Pertandingan Terkini (Live Feed)
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono text-muted">
                    {analyticsData.recentMatches?.length || 0} Pertandingan Terakhir
                  </span>
                </div>

                {analyticsData.recentMatches?.length === 0 ? (
                  <p className="text-xs text-muted font-mono p-4 text-center">
                    Belum ada pertandingan tercatat.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-surfaceBorder text-muted text-[10px] font-mono uppercase">
                          <th className="py-2 px-3">Pemain</th>
                          <th className="py-2 px-3">Mode</th>
                          <th className="py-2 px-3">Genre</th>
                          <th className="py-2 px-3">Kesulitan</th>
                          <th className="py-2 px-3 text-right">Skor</th>
                          <th className="py-2 px-3 text-right">Waktu</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surfaceBorder/60 font-mono">
                        {analyticsData.recentMatches?.map((m: any) => (
                          <tr key={m.id} className="hover:bg-surfaceRaised/40 transition">
                            <td className="py-2.5 px-3 font-semibold text-white flex items-center gap-2">
                              {m.player_avatar ? (
                                <img src={m.player_avatar} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-surfaceRaised text-zinc-300 flex items-center justify-center text-[10px]">
                                  {m.player_name?.charAt(0) || "P"}
                                </div>
                              )}
                              <span>{m.player_name}</span>
                            </td>
                            <td className="py-2.5 px-3 text-zinc-300 uppercase text-[10px]">
                              {m.mode}
                            </td>
                            <td className="py-2.5 px-3 text-muted text-[11px]">
                              {m.category}
                            </td>
                            <td className="py-2.5 px-3 text-[11px]">
                              <span className={m.difficulty === "easy" ? "text-emerald-400" : m.difficulty === "medium" ? "text-amber-400" : "text-rose-400"}>
                                {m.difficulty}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-bold text-accent">
                              {m.score} pts
                            </td>
                            <td className="py-2.5 px-3 text-right text-mutedDark text-[10px]">
                              {new Date(m.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* ============================================================= */}
      {/* MODAL: TAMBAH LAGU BARU (WITH APPLE ONLINE LOOKUP) */}
      {/* ============================================================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent">
                  <Plus className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Tambah Lagu ke Katalog</h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Online Search Helper */}
            <div className="bg-surfaceRaised/80 border border-surfaceBorder rounded-xl p-3 flex flex-col gap-2">
              <span className="text-[11px] font-mono text-accent font-semibold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Pencarian Otomatis Apple Music (Auto-Fill)</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ketik judul / artis (misal: Denny Caknan Cundamani)..."
                  value={onlineSearchQuery}
                  onChange={(e) => setOnlineSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleOnlineSearch()}
                  className="flex-1 bg-surface border border-surfaceBorder rounded-lg px-3 py-1.5 text-xs text-white outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={handleOnlineSearch}
                  disabled={isSearchingOnline}
                  className="bg-zinc-100 hover:bg-white text-zinc-950 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1"
                >
                  {isSearchingOnline ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                  <span>Cari</span>
                </button>
              </div>

              {/* Online Results List */}
              {onlineResults.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-1 max-h-40 overflow-y-auto pr-1">
                  {onlineResults.map((r, i) => (
                    <div
                      key={i}
                      onClick={() => handleSelectOnlineResult(r)}
                      className="p-2 rounded-lg bg-surface hover:bg-zinc-800 border border-surfaceBorder hover:border-accent/40 flex items-center justify-between gap-2 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        {r.artworkUrl && (
                          <img src={r.artworkUrl} alt={r.title} className="w-7 h-7 rounded object-cover" />
                        )}
                        <div className="truncate text-[11px]">
                          <span className="font-bold text-white mr-1.5">{r.title}</span>
                          <span className="text-muted">{r.artist}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-accent font-semibold flex-shrink-0">
                        Pilih ➔
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleSaveAdd} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">JUDUL LAGU</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">NAMA ARTIS / BAND</label>
                  <input
                    type="text"
                    required
                    value={formArtist}
                    onChange={(e) => setFormArtist(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">GENRE</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  >
                    {CATEGORIES.filter((c) => c !== "Semua Genre").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">KESULITAN</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  >
                    <option value="easy">🟢 Mudah (Mega)</option>
                    <option value="medium">🟡 Sedang (Populer)</option>
                    <option value="hard">🔴 Sulit (Sepuh)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">TAHUN RILIS</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-mutedDark font-semibold">AUDIO PREVIEW URL (MP3/AAC)</label>
                <input
                  type="text"
                  placeholder="https://audio-ssl.itunes.apple.com/..."
                  value={formPreviewUrl}
                  onChange={(e) => setFormPreviewUrl(e.target.value)}
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs shadow-md shadow-accent/20 transition cursor-pointer"
                >
                  Simpan ke Katalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: EDIT LAGU */}
      {/* ============================================================= */}
      {showEditModal && activeSong && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 sm:p-6 max-w-lg w-full flex flex-col gap-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-accent">
                  <Edit2 className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">Edit Lagu</h3>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">JUDUL LAGU</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">NAMA ARTIS / BAND</label>
                  <input
                    type="text"
                    required
                    value={formArtist}
                    onChange={(e) => setFormArtist(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">GENRE</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  >
                    {CATEGORIES.filter((c) => c !== "Semua Genre").map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">KESULITAN</label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  >
                    <option value="easy">🟢 Mudah (Mega)</option>
                    <option value="medium">🟡 Sedang (Populer)</option>
                    <option value="hard">🔴 Sulit (Sepuh)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-mono text-mutedDark font-semibold">TAHUN RILIS</label>
                  <input
                    type="number"
                    value={formYear}
                    onChange={(e) => setFormYear(e.target.value)}
                    className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-mono text-mutedDark font-semibold">AUDIO PREVIEW URL</label>
                <input
                  type="text"
                  value={formPreviewUrl}
                  onChange={(e) => setFormPreviewUrl(e.target.value)}
                  className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 text-xs text-white outline-none focus:border-accent font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-green-500 text-zinc-950 font-bold text-xs shadow-md shadow-accent/20 transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================= */}
      {/* MODAL: DELETE CONFIRMATION */}
      {/* ============================================================= */}
      {showDeleteModal && activeSong && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 max-w-sm w-full flex flex-col items-center gap-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Hapus Lagu?</h4>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Yakin ingin menghapus lagu{" "}
                <strong className="text-white font-semibold">
                  "{activeSong.title}" - {activeSong.artist}
                </strong>{" "}
                dari katalog? Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full mt-1">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white shadow-md shadow-rose-600/30 transition cursor-pointer"
              >
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full pt-6 border-t border-surfaceBorder flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-mutedDark font-mono mt-6">
        <p>Tebak Lagu Studio · Catalog & Gameplay Authority Engine</p>
        <div className="flex items-center gap-2">
          <span>HP 1000 Server</span>
          <span>•</span>
          <span>Port 3000</span>
        </div>
      </footer>
    </div>
  );
}
