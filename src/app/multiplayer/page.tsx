"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Users,
  ChevronLeft,
  Flame,
  Trophy,
  Copy,
  Check,
  Play,
  RotateCcw,
  Sparkles,
  Zap,
  Volume2,
  Timer,
  Share2,
  Crown,
  VolumeX,
  Radio,
} from "lucide-react";
import { GuessInput } from "@/components/GuessInput";
import { VinylPlayer } from "@/components/VinylPlayer";
import { HummingSynth } from "@/lib/audio-synth";
import { sfx } from "@/lib/sound-fx";
import confetti from "canvas-confetti";

const AVATARS = ["👑", "🎧", "🎤", "🎸", "🎹", "🥁", "🎷", "⚡", "🕶️", "🚀"];
const REACTION_EMOJIS = ["🔥", "😂", "😱", "👏", "👑", "💀"];

interface FloatingReaction {
  id: string;
  emoji: string;
  playerName: string;
  x: number;
}

export default function MultiplayerPage() {
  // Connection states
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Player info
  const [playerName, setPlayerName] = useState("");
  const [avatar, setAvatar] = useState("👑");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [view, setView] = useState<"menu" | "create" | "join" | "room" | "game">("menu");

  // Room config (Create)
  const [selectedMode, setSelectedMode] = useState("heardle");
  const [selectedCategory, setSelectedCategory] = useState("Semua Genre");
  const [maxRounds, setMaxRounds] = useState(5);

  // Live Room State
  const [room, setRoom] = useState<any>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>("");
  const [copied, setCopied] = useState(false);

  // In-Game Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [buzzCountdown, setBuzzCountdown] = useState<number>(0);
  const [maxAllowedSeconds, setMaxAllowedSeconds] = useState<number>(20);
  const [screenFlash, setScreenFlash] = useState<"buzz" | "correct" | "wrong" | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buzzTimerRef = useRef<NodeJS.Timeout | null>(null);
  const synthRef = useRef<HummingSynth | null>(null);

  useEffect(() => {
    synthRef.current = new HummingSynth();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  // Load saved name
  useEffect(() => {
    try {
      const saved = localStorage.getItem("tebak_lagu_multi_name");
      if (saved) setPlayerName(saved);
      else setPlayerName("Zidane");
    } catch {}
  }, []);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
  };

  // Initialize WebSocket connection
  useEffect(() => {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const socket = new WebSocket(`${proto}//${host}/ws`);

    socket.onopen = () => {
      setIsConnected(true);
      setErrorMsg(null);
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "room_created" || data.type === "room_joined") {
          sfx.playClick();
          setMyPlayerId(data.playerId);
          setRoom(data.room);
          setView("room");
        } else if (data.type === "room_updated" || data.type === "player_joined" || data.type === "player_left") {
          sfx.playClick();
          setRoom(data.room);
        } else if (data.type === "round_started") {
          sfx.playGong();
          setRoom(data.room);
          setView("game");
          setIsPlayingAudio(false);
          setBuzzCountdown(0);
        } else if (data.type === "player_buzzed") {
          sfx.playBuzzer();
          setScreenFlash("buzz");
          setTimeout(() => setScreenFlash(null), 300);

          setRoom(data.room);
          const allowed = data.secondsAllowed || 20;
          setMaxAllowedSeconds(allowed);
          setBuzzCountdown(allowed);

          // Audio & Synth stops on buzz
          if (audioRef.current) audioRef.current.pause();
          if (synthRef.current) synthRef.current.stop();
          setIsPlayingAudio(false);

          if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
          buzzTimerRef.current = setInterval(() => {
            setBuzzCountdown((prev) => {
              if (prev <= 1) {
                if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
                return 0;
              }
              if (prev <= 4) {
                sfx.playTick(true);
              } else {
                sfx.playTick(false);
              }
              return prev - 1;
            });
          }, 1000);
        } else if (data.type === "buzz_resumed") {
          setRoom(data.room);
          setBuzzCountdown(0);
          if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
        } else if (data.type === "guess_result") {
          setRoom(data.room);
          setBuzzCountdown(0);
          if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);

          if (data.isCorrect) {
            sfx.playCorrect();
            setScreenFlash("correct");
            setTimeout(() => setScreenFlash(null), 400);

            confetti({
              particleCount: 65,
              spread: 70,
              origin: { y: 0.6 },
              colors: ["#22c55e", "#eab308", "#38bdf8", "#fafafa"],
            });
          } else {
            sfx.playWrong();
            setScreenFlash("wrong");
            setTimeout(() => setScreenFlash(null), 350);
          }
        } else if (data.type === "round_revealed") {
          setRoom(data.room);
          setBuzzCountdown(0);
          if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
        } else if (data.type === "game_over") {
          sfx.playCorrect();
          setRoom(data.room);
          confetti({
            particleCount: 120,
            spread: 90,
            origin: { y: 0.5 },
          });
        } else if (data.type === "player_reaction") {
          sfx.playPop();
          const reactionId = Math.random().toString(36).substring(2, 9);
          const xPos = Math.floor(Math.random() * 60) + 20; // 20% to 80% width
          setFloatingReactions((prev) => [
            ...prev,
            { id: reactionId, emoji: data.emoji, playerName: data.playerName, x: xPos },
          ]);
          setTimeout(() => {
            setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
          }, 1800);
        } else if (data.type === "error") {
          sfx.playWrong();
          setErrorMsg(data.message);
        }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    setWs(socket);

    return () => {
      socket.close();
    };
  }, []);

  const savePlayerName = (name: string) => {
    setPlayerName(name);
    try {
      localStorage.setItem("tebak_lagu_multi_name", name);
    } catch {}
  };

  const handleCreateRoom = () => {
    if (!ws || !playerName.trim()) return;
    sfx.playClick();
    savePlayerName(playerName.trim());
    ws.send(
      JSON.stringify({
        type: "create_room",
        playerName: playerName.trim(),
        avatar,
        mode: selectedMode,
        category: selectedCategory,
        maxRounds,
      })
    );
  };

  const handleJoinRoom = () => {
    if (!ws || !playerName.trim() || !roomCodeInput.trim()) return;
    sfx.playClick();
    savePlayerName(playerName.trim());
    ws.send(
      JSON.stringify({
        type: "join_room",
        roomCode: roomCodeInput.trim().toUpperCase(),
        playerName: playerName.trim(),
        avatar,
      })
    );
  };

  const handleToggleReady = () => {
    if (!ws || !room) return;
    sfx.playClick();
    ws.send(JSON.stringify({ type: "toggle_ready" }));
  };

  const handleStartGame = () => {
    if (!ws || !room) return;
    sfx.playGong();
    ws.send(JSON.stringify({ type: "start_game" }));
  };

  const handleBuzz = () => {
    if (!ws || !room || room.status !== "playing") return;
    ws.send(JSON.stringify({ type: "buzz" }));
  };

  const handleGuess = (title: string, artist: string) => {
    if (!ws || !room || room.status !== "buzzed") return;
    ws.send(
      JSON.stringify({
        type: "submit_guess",
        title,
        artist,
      })
    );
  };

  const handleNextRound = () => {
    if (!ws || !room) return;
    sfx.playClick();
    ws.send(JSON.stringify({ type: "next_round" }));
  };

  const sendReaction = (emoji: string) => {
    if (!ws || !room) return;
    ws.send(
      JSON.stringify({
        type: "reaction",
        emoji,
      })
    );
  };

  const copyRoomCode = () => {
    if (!room) return;
    sfx.playClick();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAudioPlay = () => {
    // 1. Humming Mode Synthesizer
    if (room?.mode === "humming") {
      if (!synthRef.current) return;
      if (isPlayingAudio) {
        synthRef.current.stop();
        setIsPlayingAudio(false);
      } else {
        sfx.playClick();
        setIsPlayingAudio(true);
        synthRef.current.playMelody(
          room?.currentSongClue?.hummingMelody || [],
          undefined,
          () => setIsPlayingAudio(false)
        );
      }
      return;
    }

    // 2. Audio file playback (TTS / Heardle / Instrumental)
    if (!audioRef.current) return;
    if (isPlayingAudio) {
      audioRef.current.pause();
      setIsPlayingAudio(false);
    } else {
      sfx.playClick();
      if (room?.mode === "tts") {
        const firstClue = room.currentSongClue?.lyricsClues?.[0] || "";
        audioRef.current.src = `/api/tts?text=${encodeURIComponent(firstClue)}`;
      } else {
        audioRef.current.src = room?.currentSongClue?.previewUrl || "";
        audioRef.current.currentTime = room?.currentSongClue?.startSecond || 0;
      }

      audioRef.current
        .play()
        .then(() => setIsPlayingAudio(true))
        .catch(() => setIsPlayingAudio(false));
    }
  };

  const myPlayer = room?.players?.find((p: any) => p.id === myPlayerId);
  const isHost = myPlayer?.isHost;
  const isMyTurnToGuess = room?.buzzedPlayer?.id === myPlayerId;

  // Sorted players for leaderboard
  const sortedPlayers = room?.players ? [...room.players].sort((a: any, b: any) => b.score - a.score) : [];

  return (
    <div
      className={`min-h-[100dvh] bg-background text-zinc-100 flex flex-col justify-between p-4 max-w-lg mx-auto select-none relative transition-colors duration-200 ${
        screenFlash === "buzz"
          ? "ring-8 ring-amber-500/50 bg-amber-950/20"
          : screenFlash === "correct"
          ? "ring-8 ring-emerald-500/50 bg-emerald-950/20"
          : screenFlash === "wrong"
          ? "ring-8 ring-red-500/50 bg-red-950/20"
          : ""
      }`}
    >
      {/* Floating Emoji Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
        {floatingReactions.map((r) => (
          <div
            key={r.id}
            style={{ left: `${r.x}%` }}
            className="absolute bottom-24 flex flex-col items-center animate-reaction"
          >
            <span className="text-4xl filter drop-shadow-md">{r.emoji}</span>
            <span className="text-[10px] font-mono font-semibold text-zinc-300 bg-black/60 px-1.5 py-0.5 rounded-full mt-1">
              {r.playerName}
            </span>
          </div>
        ))}
      </div>

      {/* Top Header */}
      <header className="w-full flex items-center justify-between pb-3.5 border-b border-surfaceBorder z-10">
        <Link
          href="/"
          onClick={() => sfx.playClick()}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition py-1.5 px-2.5 rounded-lg hover:bg-surfaceRaised active:scale-95"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Solo Mode</span>
        </Link>

        <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-200 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-full shadow-sm">
          <Zap className="w-3.5 h-3.5 text-accent fill-accent" />
          <span className="font-bold">LIVE BUZZER</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-1.5 rounded-lg text-muted hover:text-white bg-surfaceRaised border border-surfaceBorder transition"
            title={soundEnabled ? "Mute SFX" : "Unmute SFX"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-accent" /> : <VolumeX className="w-3.5 h-3.5 text-zinc-500" />}
          </button>

          <div className="flex items-center gap-1 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-accent shadow-sm shadow-accent/50" : "bg-red-500 animate-pulse"
              }`}
            />
            <span className="text-mutedDark">{isConnected ? "Online" : "Connecting"}</span>
          </div>
        </div>
      </header>

      {/* Error alert */}
      {errorMsg && (
        <div className="w-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl text-center mt-2 animate-shake">
          {errorMsg}
        </div>
      )}

      {/* ======================================================== */}
      {/* 1. MENU VIEW */}
      {/* ======================================================== */}
      {view === "menu" && (
        <main className="my-auto flex flex-col gap-6 py-4">
          <div className="text-center flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-accent/20 to-emerald-500/10 border border-accent/30 flex items-center justify-center text-accent shadow-lg shadow-accent/10">
              <Zap className="w-8 h-8 fill-accent" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
              Multiplayer Room
            </h2>
            <p className="text-xs text-muted max-w-xs mx-auto">
              Adu cepat pencet Buzzer real-time bareng teman atau pasangan! Siapa cepat dia dapat poin.
            </p>
          </div>

          {/* Profile Name & Avatar */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <label className="text-[11px] font-mono text-mutedDark font-semibold">
              NICKNAME & AVATAR PEMAIN
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={playerName}
                onChange={(e) => savePlayerName(e.target.value)}
                placeholder="Ketik namamu..."
                className="flex-1 bg-surfaceRaised border border-surfaceBorder rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
              />
            </div>

            {/* Avatar Picker */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              {AVATARS.map((av) => (
                <button
                  key={av}
                  onClick={() => {
                    sfx.playClick();
                    setAvatar(av);
                  }}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all shrink-0 ${
                    avatar === av
                      ? "bg-zinc-100 text-zinc-950 scale-105 shadow-sm font-bold"
                      : "bg-surfaceRaised hover:bg-zinc-800 text-white border border-surfaceBorder"
                  }`}
                >
                  {av}
                </button>
              ))}
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                sfx.playClick();
                setView("create");
              }}
              disabled={!isConnected || !playerName.trim()}
              className="w-full bg-accent hover:bg-green-500 disabled:opacity-40 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-accent/20 text-sm cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-zinc-950" />
              <span>Buat Room Baru (Host)</span>
            </button>

            <button
              onClick={() => {
                sfx.playClick();
                setView("join");
              }}
              disabled={!isConnected || !playerName.trim()}
              className="w-full bg-surface hover:bg-surfaceRaised disabled:opacity-40 text-zinc-200 border border-surfaceBorder font-semibold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm cursor-pointer"
            >
              <Users className="w-4 h-4 text-muted" />
              <span>Gabung Room dengan Kode</span>
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* 2. CREATE ROOM VIEW */}
      {/* ======================================================== */}
      {view === "create" && (
        <main className="my-auto flex flex-col gap-5 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                sfx.playClick();
                setView("menu");
              }}
              className="text-xs text-muted hover:text-white flex items-center gap-1 py-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <span className="text-xs font-mono font-semibold text-zinc-200">Pengaturan Room</span>
          </div>

          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            {/* Mode Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold">
                MODE TEBAKAN
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "heardle", label: "Time Slice ⏱️" },
                  { id: "tts", label: "Robot Speech 🤖" },
                  { id: "humming", label: "Melody Synth 🎵" },
                  { id: "instrumental", label: "Minus-One 🎸" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedMode(m.id);
                    }}
                    className={`py-2.5 px-3 rounded-xl text-xs font-semibold text-left transition ${
                      selectedMode === m.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Genre / Kategori Picker */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>PILIH GENRE / KATEGORI</span>
                <span className="text-accent">{selectedCategory}</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "Semua Genre", label: "Semua Genre 🔀" },
                  { id: "Galau Hits", label: "Galau Hits 💔" },
                  { id: "Nostalgia 2000s", label: "Nostalgia 2000s 🎸" },
                  { id: "Anthem Tongkrongan", label: "Tongkrongan 🍻" },
                  { id: "Pop Jawa & Koplo", label: "Jawa & Koplo 💃" },
                  { id: "Western Hits", label: "Western Hits 🌎" },
                ].map((c) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedCategory(c.id);
                    }}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold text-left transition ${
                      selectedCategory === c.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rounds count */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold">
                JUMLAH RONDE
              </label>
              <div className="flex items-center gap-2">
                {[3, 5, 10].map((r) => (
                  <button
                    key={r}
                    onClick={() => {
                      sfx.playClick();
                      setMaxRounds(r);
                    }}
                    className={`flex-1 py-2 rounded-xl text-xs font-mono font-semibold transition ${
                      maxRounds === r
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    {r} Ronde
                  </button>
                ))}
              </div>
            </div>

            {/* Submit create */}
            <button
              onClick={handleCreateRoom}
              className="w-full mt-2 bg-accent hover:bg-green-500 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md shadow-accent/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Buka Room Sekarang</span>
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* 3. JOIN ROOM VIEW */}
      {/* ======================================================== */}
      {view === "join" && (
        <main className="my-auto flex flex-col gap-5 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                sfx.playClick();
                setView("menu");
              }}
              className="text-xs text-muted hover:text-white flex items-center gap-1 py-1"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali</span>
            </button>
            <span className="text-xs font-mono font-semibold text-zinc-200">Gabung Room</span>
          </div>

          <div className="bg-surface border border-surfaceBorder rounded-2xl p-6 flex flex-col gap-4 text-center shadow-sm">
            <label className="text-xs text-muted font-medium">
              Masukkan 4 digit kode room dari Host:
            </label>
            <input
              type="text"
              maxLength={4}
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              placeholder="KODE"
              className="w-full text-center font-mono text-3xl font-extrabold tracking-widest bg-surfaceRaised border border-surfaceBorder rounded-2xl py-4 text-white uppercase outline-none focus:border-accent"
            />

            <button
              onClick={handleJoinRoom}
              disabled={roomCodeInput.length < 3}
              className="w-full bg-accent hover:bg-green-500 disabled:opacity-40 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md shadow-accent/20 cursor-pointer"
            >
              <span>Masuk ke Ruangan ➔</span>
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* 4. WAITING LOBBY VIEW */}
      {/* ======================================================== */}
      {view === "room" && room && (
        <main className="my-auto flex flex-col gap-5 py-4">
          {/* Room Code Showcase Banner */}
          <div className="bg-surfaceRaised border border-surfaceBorder rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-mono text-mutedDark block font-semibold">
                KODE ROOM PRIVAT
              </span>
              <span className="text-3xl font-mono font-black tracking-widest text-white">
                {room.code}
              </span>
            </div>

            <button
              onClick={copyRoomCode}
              className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-surface border border-surfaceBorder hover:bg-zinc-800 text-xs font-mono transition active:scale-95 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-accent" />
                  <span className="text-accent font-semibold">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-muted" />
                  <span>Salin Kode</span>
                </>
              )}
            </button>
          </div>

          {/* Players in Room */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-mutedDark font-semibold">
              <span>PEMAIN TERGABUNG ({room.players.length}/8)</span>
              <div className="flex items-center gap-1.5">
                <span className="text-accent font-semibold">🎯 {room.category || "Semua Genre"}</span>
                <span>•</span>
                <span>{room.maxRounds} Ronde</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {room.players.map((p: any) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between bg-surfaceRaised/80 border border-surfaceBorder rounded-xl p-2.5 px-3 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl filter drop-shadow-sm">{p.avatar}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white">
                          {p.name}
                        </span>
                        {p.isHost && (
                          <span className="text-[9px] font-mono bg-accentDim text-accent px-1.5 py-0.5 rounded border border-accent/30 font-bold flex items-center gap-0.5">
                            <Crown className="w-2.5 h-2.5" />
                            <span>HOST</span>
                          </span>
                        )}
                        {p.id === myPlayerId && (
                          <span className="text-[9px] font-mono text-mutedDark">
                            (Kamu)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full font-semibold ${
                      p.isReady
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {p.isReady ? "Siap ✓" : "Menunggu..."}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lobby Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={room.players.length < 1}
                className="w-full bg-accent hover:bg-green-500 disabled:opacity-40 text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-accent/20 text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Mulai Permainan ({room.players.length} Pemain)</span>
              </button>
            ) : (
              <button
                onClick={handleToggleReady}
                className={`w-full font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm cursor-pointer ${
                  myPlayer?.isReady
                    ? "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    : "bg-zinc-100 hover:bg-white text-zinc-950 shadow-sm"
                }`}
              >
                {myPlayer?.isReady ? "Batalkan Siap" : "Saya Siap Bertanding! 🚀"}
              </button>
            )}
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* 5. MULTIPLAYER ARENA (THE BUZZER SHOWDOWN!) */}
      {/* ======================================================== */}
      {view === "game" && room && (
        <main className="my-auto flex flex-col gap-4 py-2 w-full">
          {/* Round Header & Leaderboard Bar */}
          <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-3 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className="font-mono text-muted font-bold">
                Ronde {room.currentRound} / {room.maxRounds}
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface border border-surfaceBorder text-accent font-semibold">
                🎯 {room.category || "Semua Genre"}
              </span>
            </div>

            {/* Score Strip with Rank badges and Lives */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {sortedPlayers.map((p: any, idx: number) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-[11px] border transition ${
                    p.id === myPlayerId
                      ? "bg-zinc-800 border-accent/40 text-white font-bold"
                      : "bg-surface border-surfaceBorder text-muted"
                  }`}
                >
                  {idx === 0 && <Crown className="w-3 h-3 text-amber-400" />}
                  <span>{p.avatar}</span>
                  <span className="font-semibold text-zinc-200">{p.score}</span>
                  <span className="text-[10px] text-red-400 ml-0.5">
                    {p.lives !== undefined ? (p.lives > 0 ? "❤️".repeat(p.lives) : "💀") : "❤️❤️❤️"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Central Vinyl Player & Clue Card */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col items-center gap-2 text-center shadow-sm relative overflow-hidden">
            {/* Spinning Vinyl Record Deck */}
            <VinylPlayer
              isPlaying={isPlayingAudio}
              coverUrl={room.status === "revealed" ? room.revealedSong?.albumCover : undefined}
              label={isPlayingAudio ? "Memutar Audio Clue" : "Audio Clue Siap"}
              size="sm"
            />

            {/* Clue Prompt */}
            <button
              onClick={toggleAudioPlay}
              className="mt-1 flex items-center gap-2 bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-200 px-4 py-2 rounded-xl text-xs font-semibold shadow-sm transition active:scale-95 cursor-pointer"
            >
              {isPlayingAudio ? (
                <>
                  <Volume2 className="w-4 h-4 text-accent animate-pulse" />
                  <span>Hentikan Audio</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current text-accent" />
                  <span>Dengarkan Clue ({room.mode.toUpperCase()})</span>
                </>
              )}
            </button>

            {/* Hidden native audio element */}
            <audio ref={audioRef} onEnded={() => setIsPlayingAudio(false)} preload="auto" />
          </div>

          {/* ======================================================== */}
          {/* THE GIANT 3D ARCADE BUZZER (Playing State) */}
          {/* ======================================================== */}
          {room.status === "playing" && (
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              {/* My Lives Indicator */}
              <div className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder px-3.5 py-1.5 rounded-full text-xs font-mono font-bold shadow-sm">
                <span className="text-muted">Sisa Nyawa Ronde Ini:</span>
                <span className="text-red-400 font-bold">
                  {(myPlayer?.lives ?? 3) > 0 ? "❤️".repeat(myPlayer?.lives ?? 3) : "💀"}
                </span>
                <span className="text-zinc-400">({myPlayer?.lives ?? 3}/3)</span>
              </div>

              <button
                onClick={handleBuzz}
                disabled={(myPlayer?.lives ?? 3) <= 0}
                className={`w-44 h-44 rounded-full text-white font-black text-3xl tracking-wider flex flex-col items-center justify-center select-none transition-all ${
                  (myPlayer?.lives ?? 3) > 0
                    ? "btn-buzzer-3d cursor-pointer active:scale-95"
                    : "bg-zinc-800 border-4 border-zinc-700 opacity-40 cursor-not-allowed text-zinc-500 shadow-none"
                }`}
              >
                <span>{(myPlayer?.lives ?? 3) > 0 ? "BUZZ!" : "HABIS!"}</span>
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-90 mt-1">
                  {(myPlayer?.lives ?? 3) > 0 ? "TEKAN JIKA TAHU" : "NYAWA (0/3)"}
                </span>
              </button>
              <p className="text-xs text-muted font-mono text-center mt-1">
                {(myPlayer?.lives ?? 3) > 0
                  ? "Pencet tombol buzzer di atas begitu kamu tahu lagunya! (Maks 3x salah per ronde)"
                  : "Nyawamu di ronde ini sudah habis! Menunggu ronde selanjutnya..."}
              </p>
            </div>
          )}

          {/* ======================================================== */}
          {/* BUZZED STATE: TENSION COUNTDOWN & GUESS */}
          {/* ======================================================== */}
          {room.status === "buzzed" && (
            <div className="flex flex-col items-center gap-3 py-2 w-full animate-fade-in">
              {/* Urgent Countdown Drain Bar */}
              <div className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-3 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span
                    className={
                      isMyTurnToGuess ? "text-amber-400 animate-pulse" : "text-zinc-200"
                    }
                  >
                    {isMyTurnToGuess
                      ? "🚨 GILIRANMU MENJAWAB!"
                      : `⏳ ${room.buzzedPlayer?.name} mengunci Buzzer...`}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono ${
                      buzzCountdown <= 5 ? "bg-red-500/20 text-red-400 animate-pulse" : "bg-zinc-800 text-zinc-300"
                    }`}
                  >
                    {buzzCountdown}s
                  </span>
                </div>

                {/* Progress Drain Line */}
                <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-1000 ${
                      buzzCountdown <= 5 ? "bg-red-500" : "bg-amber-400"
                    }`}
                    style={{ width: `${(buzzCountdown / (maxAllowedSeconds || 20)) * 100}%` }}
                  />
                </div>
              </div>

              {isMyTurnToGuess ? (
                <div className="w-full mt-1">
                  <GuessInput
                    onGuess={handleGuess}
                    onSkip={() => {}}
                    disabled={false}
                    guesses={[]}
                    maxGuesses={1}
                  />
                </div>
              ) : (
                <div className="bg-surfaceRaised border border-surfaceBorder rounded-2xl p-6 text-center w-full">
                  <p className="text-sm font-bold text-white">
                    Menunggu tebakan {room.buzzedPlayer?.name}...
                  </p>
                  <p className="text-xs text-muted mt-1">
                    Bila jawabannya salah, buzzer akan terbuka kembali untukmu!
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* REVEALED / ROUND OVER */}
          {/* ======================================================== */}
          {room.status === "revealed" && (
            <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 flex flex-col items-center gap-3 text-center shadow-sm animate-fade-in">
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                RONDE SELESAI
              </span>
              <h3 className="text-xl font-extrabold text-white">
                {room.revealedSong?.title}
              </h3>
              <p className="text-xs text-muted font-medium">{room.revealedSong?.artist}</p>

              {isHost && (
                <button
                  onClick={handleNextRound}
                  className="w-full mt-2 bg-zinc-100 hover:bg-white text-zinc-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md cursor-pointer"
                >
                  <span>
                    {room.currentRound >= room.maxRounds
                      ? "Lihat Podium Juara 🏆"
                      : "Ronde Berikutnya ➔"}
                  </span>
                </button>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* FINAL PODIUM (GAME OVER) */}
          {/* ======================================================== */}
          {room.status === "game_over" && (
            <div className="bg-surface border border-surfaceBorder rounded-2xl p-6 flex flex-col items-center gap-4 text-center shadow-2xl animate-fade-in">
              <div className="w-12 h-12 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-400">
                <Trophy className="w-6 h-6" />
              </div>

              <div>
                <span className="text-[11px] font-mono text-mutedDark font-semibold">
                  PERTANDINGAN SELESAI
                </span>
                <h3 className="text-2xl font-black text-white mt-0.5">
                  Podium Juara!
                </h3>
              </div>

              {/* Top 3 Podium Blocks */}
              <div className="flex items-end justify-center gap-2 w-full pt-4">
                {/* 2nd Place */}
                {sortedPlayers[1] && (
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xl">{sortedPlayers[1].avatar}</span>
                    <span className="text-xs font-semibold truncate max-w-[80px]">
                      {sortedPlayers[1].name}
                    </span>
                    <span className="text-[10px] font-mono text-muted">{sortedPlayers[1].score} pts</span>
                    <div className="w-full h-16 bg-zinc-800 border-t-2 border-zinc-500 rounded-t-lg flex items-center justify-center font-bold text-zinc-400 text-sm mt-1">
                      🥈 2
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {sortedPlayers[0] && (
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-3xl filter drop-shadow-md">{sortedPlayers[0].avatar}</span>
                    <span className="text-xs font-bold text-white truncate max-w-[90px]">
                      {sortedPlayers[0].name}
                    </span>
                    <span className="text-[11px] font-mono font-bold text-amber-400">{sortedPlayers[0].score} pts</span>
                    <div className="w-full h-24 bg-amber-500/20 border-t-4 border-amber-400 rounded-t-lg flex items-center justify-center font-black text-amber-300 text-lg mt-1 shadow-lg shadow-amber-500/10">
                      👑 1
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {sortedPlayers[2] && (
                  <div className="flex-1 flex flex-col items-center">
                    <span className="text-xl">{sortedPlayers[2].avatar}</span>
                    <span className="text-xs font-semibold truncate max-w-[80px]">
                      {sortedPlayers[2].name}
                    </span>
                    <span className="text-[10px] font-mono text-muted">{sortedPlayers[2].score} pts</span>
                    <div className="w-full h-12 bg-amber-950/40 border-t-2 border-amber-700 rounded-t-lg flex items-center justify-center font-bold text-amber-600 text-xs mt-1">
                      🥉 3
                    </div>
                  </div>
                )}
              </div>

              {isHost ? (
                <button
                  onClick={handleStartGame}
                  className="w-full mt-2 bg-accent hover:bg-green-500 text-zinc-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Main Lagi dengan Teman</span>
                </button>
              ) : (
                <p className="text-xs text-muted font-mono mt-2">
                  Menunggu Host memulai game baru...
                </p>
              )}
            </div>
          )}

          {/* Quick Emoji Reaction Floating Bar */}
          <div className="flex items-center justify-center gap-2 py-1 bg-surfaceRaised/60 border border-surfaceBorder rounded-2xl px-3 mt-1">
            <span className="text-[10px] font-mono text-mutedDark">Reaksi:</span>
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => sendReaction(emoji)}
                className="text-lg p-1 hover:scale-125 active:scale-90 transition-transform cursor-pointer"
                title={`Kirim ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="w-full text-center py-2 text-[11px] text-mutedDark font-mono z-10">
        Tebak Lagu Multiplayer · Real-Time WebSockets
      </footer>
    </div>
  );
}
