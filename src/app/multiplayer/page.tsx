"use client";

import { io, Socket } from "socket.io-client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useYouTubeEngine } from "@/lib/youtube-engine";
import {
  Users,
  Smile,
  ChevronRight,
  ChevronLeft,
  Flame,
  Trophy,
  Copy,
  X,
  Check,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  Zap,
  Volume2,
  Timer,
  Share2,
  Crown,
  VolumeX,
  Radio,
  LogOut,
  Loader2,
  QrCode,
  Volume1,
} from "lucide-react";
import { GuessInput } from "@/components/GuessInput";
import { VinylPlayer } from "@/components/VinylPlayer";
import { GoogleAuthButton } from "@/components/GoogleAuthButton";
import { SocialShareModal } from "@/components/SocialShareModal";
import { RoomQrCodeModal } from "@/components/RoomQrCodeModal";
import { AudioWaveformVisualizer } from "@/components/AudioWaveformVisualizer";
import { ArtistSelector } from "@/components/game/ArtistSelector";
import { useAuth } from "@/lib/auth-context";
import { sfx } from "@/lib/sound-fx";
import confetti from "canvas-confetti";

const AVATARS = ["👑", "🎧", "🎤", "🎸", "🎹", "🥁", "🎷", "⚡", "🕶️", "🚀"];

/**
 * Deterministic avatar from a name: the same name always yields the same
 * emoji, so players recognise each other without picking anything.
 */
function autoAvatarFor(name: string): string {
  const n = (name || "").trim().toLowerCase();
  if (!n) return "🎧";
  let h = 0;
  for (let i = 0; i < n.length; i++) {
    h = (h * 31 + n.charCodeAt(i)) % 100000;
  }
  return AVATARS[h % AVATARS.length];
}
const REACTION_EMOJIS = ["🔥", "😂", "😱", "👏", "👑", "💀"];
const MEME_SOUNDS = [
  { id: "airhorn", label: "Horn", icon: "🎺", title: "Airhorn" },
  { id: "drumroll", label: "Drum", icon: "🥁", title: "Drumroll" },
  { id: "zonk", label: "Zonk", icon: "💀", title: "Sad Zonk" },
  { id: "laugh", label: "Haha", icon: "🤡", title: "Laugh" },
  { id: "applause", label: "Clap", icon: "👏", title: "Applause" },
];
const FUN_NICKNAMES = [
  "Raja Musik",
  "Koplo Master",
  "Sepuh Galau",
  "Sultan Melodi",
  "Telinga Emas",
  "Dewa Trivia",
  "Bintang Pensi",
  "Pujangga Nada",
];

interface FloatingReaction {
  id: string;
  emoji: string;
  playerName: string;
  x: number;
}

export default function MultiplayerPage() {
  // Connection states
  const [socket, setSocket] = useState<Socket | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const emit = (type: string, data: any = {}) => {
    if (socketRef.current) {
      socketRef.current.emit(type, { type, ...data });
    }
  };
  const [isConnected, setIsConnected] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Player info
  const [playerName, setPlayerName] = useState("");
  const avatar = autoAvatarFor(playerName);
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [view, setView] = useState<"menu" | "create" | "join" | "room" | "game">("menu");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Room config (Create)
  const [selectedMode, setSelectedMode] = useState("heardle");
  const [selectedFilterType, setSelectedFilterType] = useState<"category" | "artists">("category");
  const [selectedCategory, setSelectedCategory] = useState("Semua Playlist");
  const [selectedArtists, setSelectedArtists] = useState<string[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState("easy");
  const [selectedAudioProfile, setSelectedAudioProfile] = useState("normal");
  const [maxRounds, setMaxRounds] = useState(5);

  // Live Room State
  const [room, setRoom] = useState<any>(null);
  const [myPlayerId, setMyPlayerId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem("tebak_lagu_multi_session");
        if (raw) {
          const sess = JSON.parse(raw);
          return sess.playerId || "";
        }
      } catch {}
    }
    return "";
  });
  const [copied, setCopied] = useState(false);

  // In-Game Playback State
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [isAudioBuffering, setIsAudioBuffering] = useState(false);
  const [showSocialModal, setShowSocialModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [roundKickoff, setRoundKickoff] = useState<number | null>(null);
  const [showPlayerSheet, setShowPlayerSheet] = useState(false);
  const [showStickerSheet, setShowStickerSheet] = useState(false);
  const [activeSfxAlert, setActiveSfxAlert] = useState<{ id: string; text: string } | null>(null);
  const [buzzCountdown, setBuzzCountdown] = useState<number>(0);
  const [maxAllowedSeconds, setMaxAllowedSeconds] = useState<number>(15);
  const [screenFlash, setScreenFlash] = useState<"buzz" | "correct" | "wrong" | null>(null);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [cooldownTick, setCooldownTick] = useState<number>(0);
  const [lastRoundWinner, setLastRoundWinner] = useState<{ name: string; points: number; streak: number } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const buzzTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sliceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // YouTube Audio Engine — persistent singleton
  const ytEngine = useYouTubeEngine({
    onError: (msg) => console.warn("[YT Multiplayer]", msg),
  });

  const playAudioRef = useRef<(customRoom?: any) => void>(() => {});
  const pauseAudioRef = useRef<() => void>(() => {});

  useEffect(() => {
    const timer = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Close any open sheet when the view changes, otherwise a full-screen
  // overlay stays mounted and swallows every tap (looks like the nav is stuck).
  useEffect(() => {
    setShowPlayerSheet(false);
    setShowStickerSheet(false);
    setShowExitConfirm(false);
  }, [view, room?.status]);

  const { user } = useAuth();

  // ── Audio Unlock (mobile autoplay policy) ────────────────────────────────
  // Multiplay audio has to fire on its own — there is no per-player play
  // button by design. Mobile browsers only allow unmuted playback after a real
  // user gesture somewhere in the page, so burn that gesture on the first tap
  // (create/join/name field) with a silent clip. After that every round can
  // auto-play.
  useEffect(() => {
    const unlock = () => {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        // A zero-length silent buffer keeps this gesture-only and inaudible.
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0;
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.01);
        void ctx.resume();
      } catch {}
    };

    const events = ["pointerdown", "touchstart", "keydown", "click"] as const;
    for (const e of events) window.addEventListener(e, unlock, { once: true, passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, unlock);
    };
  }, []);

  // Auto-detect room code from URL query (?room=CODE) for instant QR / Invite join
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlRoom = params.get("room") || params.get("code");
      if (urlRoom) {
        setRoomCodeInput(urlRoom.toUpperCase().trim());
        setView("join");
      }
    }
  }, []);

  // Load saved name or auto-sync with logged in Google User
  useEffect(() => {
    if (user && user.name) {
      setPlayerName(user.name);
    } else {
      try {
        const saved = localStorage.getItem("tebak_lagu_multi_name");
        if (saved) {
          setPlayerName(saved);
        } else {
          const randomName = FUN_NICKNAMES[Math.floor(Math.random() * FUN_NICKNAMES.length)];
          setPlayerName(randomName);
        }
      } catch {
        setPlayerName("Raja Musik");
      }
    }
  }, [user]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sfx.enabled = next;
  };

  const stopAndResetAudio = () => {
    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    // YouTube deck must be silenced too, otherwise the clue keeps playing over
    // the guess, the countdown and the result screen.
    ytEngine.pause();
    setIsPlayingAudio(false);
    setIsAudioBuffering(false);
  };

  const pauseAudioLocal = () => {
    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    // Same for the YouTube path.
    ytEngine.pause();
    setIsPlayingAudio(false);
    setIsAudioBuffering(false);
  };

  const playAudioLocal = (customRoom?: any) => {
    const r = customRoom || room;
    if (!r?.currentSongClue) return;

    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }

    const profile = r.audioProfile || "normal";
    // The server owns the sequence; mirror whatever slice it says is active.
    const sliceIndex = (r.clueIndex || r.clueStage || 1) - 1;
    const maxDuration = Array.isArray(r.cluePlayDurations) && r.cluePlayDurations.length
      ? Number(r.cluePlayDurations[sliceIndex]) || 5
      : 5;

    if (r.mode === "tts") {
      if (!audioRef.current) return;
      const clues = r.currentSongClue?.lyricsClues || [];
      const fullLyrics = clues.join(". \n");
      const speedParam = profile === "fast" ? "1.25" : profile === "bass" ? "0.8" : "1";
      const langParam = r.currentSongClue?.lang || "id";
      const ttsUrl = `/api/tts?text=${encodeURIComponent(fullLyrics || "Dengarkan lirik")}&speed=${speedParam}&lang=${langParam}`;
      if (audioRef.current.src !== ttsUrl) {
        audioRef.current.src = ttsUrl;
      }
    } else {
      // Tiers are cumulative: each one starts at the song's vocal start and
      // plays for longer, so later tiers simply contain everything the earlier
      // ones revealed.
      const clue = r.currentSongClue;
      const startAt = clue?.youtubeStartSecond ?? 20;

      // ── YouTube path ─────────────────────────────────────────
      if (clue?.hasYoutube && clue?.youtubeId) {
        // Use play() (not unmuteAndPlay) so a fresh video is loaded, then
        // seeked and unmuted. unmuteAndPlay() only works on an already-loaded
        // video and silently no-ops on a new one, which left multiplayer
        // rounds silent.
        ytEngine.play({
          youtubeId: clue.youtubeId,
          startSecond: startAt,
        });
        setIsPlayingAudio(true);
        sliceTimerRef.current = setTimeout(() => {
          ytEngine.pause();
          setIsPlayingAudio(false);
        }, maxDuration * 1000);
        return;
      }

      // ── Fallback: HTML5 audio ─────────────────────────────────
      if (!audioRef.current) return;
      const previewUrl = clue?.previewUrl || "";
      if (audioRef.current.src !== previewUrl) {
        audioRef.current.src = previewUrl;
      }
      audioRef.current.currentTime = startAt;

      sliceTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlayingAudio(false);
        }
      }, maxDuration * 1000);
    }

    if (!audioRef.current) return;
    if (profile === "fast") audioRef.current.playbackRate = 1.3;
    else if (profile === "bass") audioRef.current.playbackRate = 0.85;
    else audioRef.current.playbackRate = 1.0;

    setIsAudioBuffering(true);
    audioRef.current
      .play()
      .then(() => {
        setIsAudioBuffering(false);
        setIsPlayingAudio(true);
      })
      .catch((err) => {
        console.warn("Audio autoplay blocked by browser policy:", err);
        setIsAudioBuffering(false);
        setIsPlayingAudio(false);
      });
  };

  useEffect(() => {
    playAudioRef.current = playAudioLocal;
    pauseAudioRef.current = pauseAudioLocal;
  });

  const handleToggleRoomAudio = () => {
    if (!socketRef.current || !room) return;
    const nextAction = isPlayingAudio ? "pause" : "play";
    emit("toggle_room_audio", { action: nextAction });
  };

  // Session storage key
  const SESSION_KEY = "tebak_lagu_multi_session";

  // Initialize Socket.IO connection with native auto-reconnect, dual-transport, & session recovery
  useEffect(() => {
    let activeSocket: Socket | null = null;
    let isUnmounted = false;

    function connect() {
      if (isUnmounted) return;
      if (activeSocket && activeSocket.connected) return;

      const s = io({
        path: "/socket.io",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 2000,
        timeout: 10000,
      });

      activeSocket = s;
      socketRef.current = s;
      setSocket(s);

      s.on("connect", () => {
        setIsConnected(true);
        setErrorMsg(null);

        // Attempt session recovery
        try {
          const raw = sessionStorage.getItem(SESSION_KEY);
          if (raw) {
            const sess = JSON.parse(raw);
            if (sess.roomCode && sess.playerId) {
              s.emit("reconnect", {
                type: "reconnect",
                roomCode: sess.roomCode,
                playerId: sess.playerId,
                playerName: sess.playerName,
              });
            }
          }
        } catch {}
      });

      s.on("disconnect", (reason) => {
        setIsConnected(false);
      });

      s.on("connect_error", (err) => {
        console.warn("Socket.IO connect error:", err.message);
      });

      // Unified event dispatcher for all server messages
      s.onAny((eventType, rawData) => {
        try {
          const data = typeof rawData === "string" ? JSON.parse(rawData) : (rawData || {}); if (!data.type) data.type = eventType;

          if (data.type === "ping") {
            try {
              
            } catch (e) {}
            return;
          }

          if (data.type === "state_synced") {
            setRoom(data.room);
            if (data.playerId) setMyPlayerId(data.playerId);
            if (data.room.status === "lobby") {
              setView("room");
            } else {
              setView("game");
            }
            return;
          }

          if (data.type === "room_created" || data.type === "room_joined" || data.type === "reconnected") {
            sfx.playClick();
            const confirmedPlayerId = data.playerId || myPlayerId;
            setMyPlayerId(confirmedPlayerId);
            setRoom(data.room);
            try {
              sessionStorage.setItem(
                SESSION_KEY,
                JSON.stringify({
                  roomCode: data.roomCode,
                  playerId: confirmedPlayerId,
                  playerName: playerName,
                  avatar: autoAvatarFor(playerName),
                })
              );
            } catch {}
            if (data.room.status === "lobby") {
              setView("room");
            } else {
              setView("game");
            }
          } else if (data.type === "reconnect_failed") {
            // Do not delete immediately if mid-game, attempt re-sync with roomCode
            try {
              const raw = sessionStorage.getItem(SESSION_KEY);
              if (raw) {
                const sess = JSON.parse(raw);
                if (sess.roomCode) {
                  s.emit("join_room", {
                    type: "join_room",
                    roomCode: sess.roomCode,
                    playerName: sess.playerName || playerName,
                    playerId: sess.playerId
                  });
                  return;
                }
              }
            } catch {}
            sessionStorage.removeItem(SESSION_KEY);
          } else if (
            data.type === "room_updated" ||
            data.type === "player_joined" ||
            data.type === "player_left" ||
            data.type === "player_connection_change" ||
            data.type === "skip_vote_updated" ||
            data.type === "next_round_vote_updated"
          ) {
            sfx.playClick();
            setRoom(data.room);
          } else if (data.type === "next_round_tick") {
            setRoom(data.room);
          } else if (data.type === "clue_extended") {
            sfx.playGong();
            setRoom(data.room);

            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([60, 40, 90]);
            }

            // Cut the running clue, then start the longer one — otherwise the two
            // play on top of each other.
            pauseAudioRef.current();
            setTimeout(() => {
              playAudioRef.current(data.room);
            }, 250);
          } else if (data.type === "clue_phase") {
            setRoom(data.room);

            if (data.phase === "playing") {
              // Fresh slice of audio
              sfx.playGong();
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([40, 30, 60]);
              }
              pauseAudioRef.current();
              setTimeout(() => playAudioRef.current(data.room), 120);
            } else {
              // Silence: cut the audio dead
              pauseAudioRef.current();
            }
          } else if (data.type === "round_started") {
            stopAndResetAudio();
            setRoom(data.room);
            setView("game");
            setBuzzCountdown(0);
            setLastRoundWinner(null);
            setRoundKickoff(3); // 3-second tension countdown!

            // Preload audio immediately in background so first click plays with 0ms lag!
            setTimeout(() => {
              const r = data.room;
              if (!r) return;

              // ── YouTube cue (muted preload) ───────────────────
              const clue = r.currentSongClue;
              if (clue?.hasYoutube && clue?.youtubeId && r.mode !== "tts") {
                ytEngine.cue({
                  youtubeId: clue.youtubeId,
                  startSecond: clue.youtubeStartSecond ?? 20,
                });
                return;
              }

              // ── Fallback: HTML5 preload ───────────────────────
              if (!audioRef.current) return;
              if (r.mode === "tts") {
                const clues = r.currentSongClue?.allLyricsClues || r.currentSongClue?.lyricsClues || [];
                const fullLyrics = clues.join(". \n");
                const speedParam = r.audioProfile === "fast" ? "1.25" : r.audioProfile === "bass" ? "0.8" : "1";
                const langParam = r.currentSongClue?.lang || "id";
                audioRef.current.src = `/api/tts?text=${encodeURIComponent(fullLyrics || "Dengarkan lirik")}&speed=${speedParam}&lang=${langParam}`;
              } else {
                audioRef.current.src = r.currentSongClue?.previewUrl || "";
                audioRef.current.currentTime = r.currentSongClue?.startSecond || 0;
              }
              audioRef.current.preload = "auto";
              audioRef.current.load();
            }, 100);
          } else if (data.type === "room_audio_sync") {
            if (data.action === "play") {
              playAudioRef.current(data.room || room);
            } else {
              pauseAudioRef.current();
            }
          } else if (data.type === "player_buzzed") {
            sfx.playBuzzer();
            if (typeof navigator !== "undefined" && navigator.vibrate) {
              navigator.vibrate([100]);
            }
            pauseAudioRef.current();
            setScreenFlash("buzz");
            setTimeout(() => setScreenFlash(null), 300);

            setRoom(data.room);
            const allowed = data.secondsAllowed || 15;
            setMaxAllowedSeconds(allowed);
            setBuzzCountdown(allowed);

            if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
            buzzTimerRef.current = setInterval(() => {
              setBuzzCountdown((prev) => {
                if (prev <= 1) {
                  if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
                  return 0;
                }
                if (prev <= 4) {
                  sfx.playTick(true);
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate([25]);
                  }
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
            if (data.resumeAudio) {
              setTimeout(() => playAudioRef.current(data.room), 250);
            }
          } else if (data.type === "guess_result") {
            setRoom(data.room);
            setBuzzCountdown(0);
            if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);

            if (data.isCorrect) {
              pauseAudioRef.current();
              sfx.playCorrect();
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([40, 50, 120]);
              }
              setScreenFlash("correct");
              setTimeout(() => setScreenFlash(null), 400);

              setLastRoundWinner({
                name: data.guesserName,
                points: data.pointsGained || 250,
                streak: data.streak || 1,
              });

              confetti({
                particleCount: 75,
                spread: 80,
                origin: { y: 0.6 },
                colors: ["#22c55e", "#eab308", "#38bdf8", "#fafafa"],
              });
            } else {
              sfx.playWrong();
              if (typeof navigator !== "undefined" && navigator.vibrate) {
                navigator.vibrate([180]);
              }
              setScreenFlash("wrong");
              setTimeout(() => setScreenFlash(null), 350);
              // Silence the clue first, then let the server resume it — otherwise
              // the audio stacks on itself when a wrong guess reopens the buzzer.
              pauseAudioRef.current();
              if (data.resumeAudio) {
                setTimeout(() => playAudioRef.current(data.room), 400);
              }
            }
          } else if (data.type === "round_revealed") {
            // Stop the clue first — otherwise it keeps playing under the reveal.
            pauseAudioRef.current();
            setRoom(data.room);
            setBuzzCountdown(0);
            if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);

            // Celebration: play the full hook of the revealed song.
            const revealed = data.room?.revealedSong;
            if (revealed?.hasYoutube && revealed?.youtubeId) {
              ytEngine.play({
                youtubeId: revealed.youtubeId,
                startSecond: revealed.youtubeStartSecond ?? 20,
              });
              setIsPlayingAudio(true);
            } else if (audioRef.current && revealed?.previewUrl) {
              audioRef.current.src = revealed.previewUrl;
              audioRef.current.currentTime = revealed.startSecond || 0;
              audioRef.current.playbackRate = 1.0;
              audioRef.current.play().then(() => setIsPlayingAudio(true)).catch(() => {});
            }
          } else if (data.type === "left_room_success") {
            try {
              sessionStorage.removeItem(SESSION_KEY);
            } catch {}
            setRoom(null);
            setView("menu");
            stopAndResetAudio();
            setBuzzCountdown(0);
            if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
          } else if (data.type === "game_over") {
            stopAndResetAudio();
            sfx.playCorrect();
            setRoom(data.room);
            sessionStorage.removeItem(SESSION_KEY);
            confetti({
              particleCount: 120,
              spread: 90,
              origin: { y: 0.5 },
            });

            // Auto-submit score to Leaderboard
            try {
              const myP = data.room?.players?.find((p: any) => p.id === myPlayerId);
              if (myP && myP.score > 0) {
                fetch("/api/leaderboard", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    user_id: user?.id || null,
                    player_name: myP.name || user?.name || playerName,
                    player_avatar: user?.avatar || "",
                    mode: "multiplayer",
                    category: data.room?.category || "Semua Playlist",
                    difficulty: data.room?.difficulty || "easy",
                    score: myP.score,
                  }),
                }).catch(() => {});
              }
            } catch (e) {}
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
          } else if (data.type === "room_sfx") {
            // Trigger sound effects for entire room
            if (data.sfxId === "airhorn") sfx.playAirhorn();
            else if (data.sfxId === "drumroll") sfx.playDrumRoll();
            else if (data.sfxId === "zonk") sfx.playSadTrombone();
            else if (data.sfxId === "laugh") sfx.playCartoonLaugh();
            else if (data.sfxId === "applause") sfx.playApplause();

            const soundObj = MEME_SOUNDS.find((m) => m.id === data.sfxId);
            const alertText = `${soundObj?.icon || "🔊"} ${data.playerName || "Pemain"} membunyikan ${soundObj?.title || "SFX"}!`;
            setActiveSfxAlert({ id: Date.now().toString(), text: alertText });
            setTimeout(() => setActiveSfxAlert(null), 2400);
          } else if (data.type === "error") {
            sfx.playWrong();
            setErrorMsg(data.message);
          }
        } catch (err) {
          console.error("Socket.IO Message Error:", err);
        }
      });
    }

    connect();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        if (!activeSocket || !activeSocket.connected) {
          activeSocket?.connect();
        } else {
          try {
            const raw = sessionStorage.getItem(SESSION_KEY);
            if (raw) {
              const sess = JSON.parse(raw);
              if (sess.roomCode) {
                activeSocket.emit("sync_state", { type: "sync_state", roomCode: sess.roomCode });
              }
            }
          } catch {}
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      isUnmounted = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (activeSocket) activeSocket.disconnect();
    };
  }, []);

  // Round Kickoff Countdown Timer (3.. 2.. 1.. DENGARKAN!)
  useEffect(() => {
    if (roundKickoff === null) return;
    if (roundKickoff > 0) {
      sfx.playTick(true);
      const timer = setTimeout(() => {
        setRoundKickoff(roundKickoff - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (roundKickoff === 0) {
      sfx.playGong();
      const timer = setTimeout(() => {
        setRoundKickoff(null);
        playAudioRef.current();
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [roundKickoff]);

  const savePlayerName = (name: string) => {
    setPlayerName(name);
    try {
      localStorage.setItem("tebak_lagu_multi_name", name);
    } catch {}
  };

  const handleCreateRoom = () => {
    if (!socketRef.current || !playerName.trim()) return;
    sfx.playClick();
    savePlayerName(playerName.trim());
    emit("create_room", {
        playerName: playerName.trim(),
        avatar: autoAvatarFor(playerName),
        mode: selectedMode,
        filterType: selectedFilterType,
        category: selectedCategory,
        selectedArtists,
        difficulty: selectedDifficulty,
        audioProfile: selectedAudioProfile,
        maxRounds,
      });
  };

  const handleJoinRoom = () => {
    if (!socketRef.current || !playerName.trim() || !roomCodeInput.trim()) return;
    sfx.playClick();
    savePlayerName(playerName.trim());
    emit("join_room", {
        roomCode: roomCodeInput.trim().toUpperCase(),
        playerName: playerName.trim(),
        avatar: autoAvatarFor(playerName),
      });
  };

  const handleToggleReady = () => {
    if (!socketRef.current || !room) return;
    sfx.playClick();
    emit("toggle_ready");
  };

  const handleStartGame = () => {
    if (!socketRef.current || !room) return;
    sfx.playGong();
    emit("start_game");
  };

  const handleExitRoom = () => {
    sfx.playClick();
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {}
    if (socketRef.current) {
      emit("leave_room");
    }
    setRoom(null);
    setView("menu");
    setIsPlayingAudio(false);
    setBuzzCountdown(0);
    if (audioRef.current) audioRef.current.pause();
    if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);
    setShowExitConfirm(false);
  };

  const myPlayer =
    room?.players?.find((p: any) => p.id === myPlayerId) ||
    room?.players?.find((p: any) => p.name.trim().toLowerCase() === playerName.trim().toLowerCase());
  const isHost = myPlayer?.isHost;
  const isMyTurnToGuess =
    room?.buzzedPlayer?.id === myPlayerId ||
    (room?.buzzedPlayer?.id && myPlayer?.id && room.buzzedPlayer.id === myPlayer.id);

  const isCooldown = (myPlayer?.buzzCooldownUntil || 0) > Date.now();
  const cooldownSeconds = Math.max(0, Math.ceil(((myPlayer?.buzzCooldownUntil || 0) - Date.now()) / 1000));

  const handleBuzz = () => {
    if (!socketRef.current || !socketRef.current?.connected || !room || room.status !== "playing") return;
    if (isCooldown) {
      sfx.playWrong();
      return;
    }
    sfx.playBuzzer();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([90]);
    }
    emit("buzz", {
      roomCode: room.code,
      playerId: myPlayerId || myPlayer?.id,
      playerName: myPlayer?.name || playerName
    });
  };

  const handleGuess = (title: string, artist: string) => {
    if (!socketRef.current || !socketRef.current?.connected || !room || room.status !== "buzzed") return;
    emit("submit_guess", {
        roomCode: room.code,
        playerId: myPlayerId || myPlayer?.id,
        playerName: myPlayer?.name || playerName,
        title,
        artist,
      });
  };

  const handleNextRound = () => {
    if (!socketRef.current || !socketRef.current?.connected || !room) return;
    sfx.playClick();
    stopAndResetAudio();
    emit("next_round", {
      roomCode: room.code,
      playerId: myPlayerId || myPlayer?.id
    });
  };

  const handleSkipRound = () => {
    if (!socketRef.current || !socketRef.current?.connected || !room) return;
    sfx.playWrong();
    emit("skip_round", {
      roomCode: room.code,
      playerId: myPlayerId || myPlayer?.id
    });
  };

  const handleForfeitBuzz = () => {
    if (!socketRef.current || !socketRef.current?.connected || !room) return;
    sfx.playWrong();
    emit("forfeit_buzz", {
      roomCode: room.code,
      playerId: myPlayerId || myPlayer?.id
    });
  };

  const sendReaction = (emoji: string) => {
    if (!socketRef.current || !room) return;
    emit("reaction", {
        emoji,
      });
  };

  const sendSfx = (sfxId: string) => {
    if (!socketRef.current || !room) return;
    emit("trigger_sfx", {
        sfxId,
      });
  };

  const copyRoomCode = () => {
    if (!room) return;
    sfx.playClick();
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleAudioPlay = () => {
    handleToggleRoomAudio();
  };

  // Sorted players for leaderboard
  const sortedPlayers = room?.players ? [...room.players].sort((a: any, b: any) => b.score - a.score) : [];

  return (
    <div
      className={`min-h-[100dvh] bg-background text-zinc-100 flex flex-col gap-2 p-2.5 pb-4 max-w-md mx-auto select-none relative transition-colors duration-200 ${
        screenFlash === "buzz"
          ? "ring-4 ring-amber-500 bg-amber-950/20"
          : screenFlash === "correct"
          ? "ring-4 ring-emerald-500 bg-emerald-950/20"
          : screenFlash === "wrong"
          ? "ring-4 ring-rose-500 bg-rose-950/20"
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

        {/* Floating Active SFX Soundboard Notification */}
        {activeSfxAlert && (
          <div className="absolute top-16 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none animate-bounce">
            <div className="bg-surface/95 backdrop-blur-md border border-accent/40 rounded-full px-4 py-1.5 shadow-2xl flex items-center gap-2">
              <span className="text-xs font-bold text-white font-mono">{activeSfxAlert.text}</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Header */}
      <header className="w-full flex items-center justify-between pb-2 border-b border-surfaceBorder z-10">
        {view === "room" || view === "game" ? (
          <button
            onClick={() => {
              sfx.playClick();
              setShowExitConfirm(true);
            }}
            className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition py-1.5 px-2.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 active:scale-95 cursor-pointer font-semibold"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Keluar</span>
          </button>
        ) : (
          <Link
            href="/"
            onClick={() => sfx.playClick()}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition py-1.5 px-2.5 rounded-lg hover:bg-surfaceRaised active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Solo Mode</span>
          </Link>
        )}

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
        <main className="flex-1 flex flex-col gap-3 py-2">
          {/* Compact hero — no giant logo block eating the fold */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-accent/20 to-emerald-500/10 border border-accent/30 flex items-center justify-center text-accent shadow-md shadow-accent/10 shrink-0">
              <Zap className="w-5 h-5 fill-accent" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
                Multiplayer Room
              </h2>
              <p className="text-[11px] text-muted leading-tight">
                Adu buzzer real-time. Siapa cepat, dapat poin.
              </p>
            </div>
            <div className="ml-auto shrink-0">
              <GoogleAuthButton />
            </div>
          </div>

          {/* Nickname only — the avatar is derived from the name */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-3 flex items-center gap-2.5 shadow-sm">
            <span
              className="w-10 h-10 rounded-xl bg-surfaceRaised border border-surfaceBorder flex items-center justify-center text-xl shrink-0"
              title="Avatar otomatis dari nickname"
            >
              {autoAvatarFor(playerName)}
            </span>
            <input
              type="text"
              value={playerName}
              onChange={(e) => savePlayerName(e.target.value)}
              placeholder="Nickname kamu..."
              maxLength={16}
              className="flex-1 min-w-0 bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-accent"
            />
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 mt-auto">
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
        <main className="flex-1 flex flex-col gap-5 py-4">
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
                  { id: "heardle", label: "Time Slice (Heardle) ⏱️" },
                  { id: "tts", label: "Robot Speech (TTS) 🤖" },
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

            {/* Playlist atau Pilih Penyanyi */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-mutedDark font-semibold">
                  PILIH LAGU DARI
                </label>
                <div className="flex items-center gap-1 bg-surfaceRaised p-0.5 rounded-xl border border-surfaceBorder">
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setSelectedFilterType("category");
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedFilterType === "category"
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    🎵 Playlist
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      sfx.playClick();
                      setSelectedFilterType("artists");
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                      selectedFilterType === "artists"
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "text-zinc-400 hover:text-white"
                    }`}
                  >
                    🎤 Pilih Penyanyi
                  </button>
                </div>
              </div>

              {selectedFilterType === "category" ? (
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "Semua Playlist", label: "Semua Playlist 🔀" },
                    { id: "Galau Hits", label: "Galau Hits 💔" },
                    { id: "Nostalgia 2000s", label: "Nostalgia 2000s 🎸" },
                    { id: "Anthem Tongkrongan", label: "Tongkrongan 🍻" },
                    { id: "Pop Jawa & Koplo", label: "Jawa & Koplo 💃" },
                    { id: "Western Hits", label: "Western Hits 🌎" },
                    { id: "Rap", label: "Rap 🎤" },
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
              ) : (
                <ArtistSelector
                  selectedArtists={selectedArtists}
                  onChange={setSelectedArtists}
                />
              )}
            </div>

            {/* Tingkat Kesulitan / Popularitas */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>TINGKAT KESULITAN</span>
                <span className="text-accent font-bold">
                  {selectedDifficulty === "easy"
                    ? "Mudah (Mega Hits) 🟢"
                    : selectedDifficulty === "medium"
                    ? "Sedang (Populer) 🟡"
                    : selectedDifficulty === "hard"
                    ? "Sulit (Sepuh) 🔴"
                    : "Campur (Semua) 🔀"}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: "easy", label: "Mudah (Mega Hits) 🟢", desc: "Lagu viral & hits sejuta umat" },
                  { id: "medium", label: "Sedang (Populer) 🟡", desc: "Hits radio & single album" },
                  { id: "hard", label: "Sulit (Sepuh) 🔴", desc: "Deep cuts & b-side buat sepuh" },
                  { id: "all", label: "Campur (Semua) 🔀", desc: "Koleksi lengkap acak" },
                ].map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedDifficulty(d.id);
                    }}
                    className={`py-2 px-3 rounded-xl text-left transition flex flex-col ${
                      selectedDifficulty === d.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">{d.label}</span>
                    <span className="text-[10px] opacity-75 font-mono">{d.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tipe Suara / Audio Profile */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-mono text-mutedDark font-semibold flex items-center justify-between">
                <span>TIPE SUARA / AUDIO PROFILE</span>
                <span className="text-accent font-bold">
                  {selectedAudioProfile === "normal"
                    ? "Datar / Robotik 🤖"
                    : selectedAudioProfile === "bass"
                    ? "Bass Booster 🔊"
                    : "Cepat / Chipmunk ⚡"}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "normal", label: "Datar 🤖", desc: "Monotone" },
                  { id: "bass", label: "Bass 🔊", desc: "Berat & Low" },
                  { id: "fast", label: "Cepat ⚡", desc: "Chipmunk" },
                ].map((ap) => (
                  <button
                    key={ap.id}
                    onClick={() => {
                      sfx.playClick();
                      setSelectedAudioProfile(ap.id);
                    }}
                    className={`py-2 px-2 rounded-xl text-center transition flex flex-col items-center ${
                      selectedAudioProfile === ap.id
                        ? "bg-zinc-100 text-zinc-950 shadow-sm"
                        : "bg-surfaceRaised border border-surfaceBorder text-muted hover:text-white"
                    }`}
                  >
                    <span className="text-xs font-semibold">{ap.label}</span>
                    <span className="text-[9px] opacity-75 font-mono">{ap.desc}</span>
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
              disabled={selectedFilterType === "artists" && selectedArtists.length === 0}
              className="w-full mt-2 bg-accent hover:bg-green-500 disabled:opacity-40 disabled:pointer-events-none text-zinc-950 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md shadow-accent/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {selectedFilterType === "artists" && selectedArtists.length === 0
                  ? "Pilih Minimal 1 Penyanyi 🎤"
                  : "Buka Room Sekarang"}
              </span>
            </button>
          </div>
        </main>
      )}

      {/* ======================================================== */}
      {/* 3. JOIN ROOM VIEW */}
      {/* ======================================================== */}
      {view === "join" && (
        <main className="flex-1 flex flex-col gap-5 py-4">
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
        <main className="flex-1 flex flex-col gap-5 py-4">
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

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl bg-accent/15 border border-accent/30 hover:bg-accent/25 text-accent text-xs font-mono font-semibold transition active:scale-95 cursor-pointer"
                title="Buka QR Code untuk di-scan teman"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Code</span>
              </button>

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
          </div>

          {/* Players in Room — compact bar, detail in modal */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-3 flex flex-col gap-2.5 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-mutedDark font-semibold shrink-0">
                {room.players.length}/8 PEMAIN
              </span>
              <button
                onClick={() => setShowPlayerSheet(true)}
                className="flex items-center gap-1 text-[10px] font-mono text-accent hover:text-white px-2 py-1 rounded-lg bg-accentDim border border-accent/20 transition"
              >
                <Users className="w-3 h-3" />
                <span>Detail</span>
              </button>
            </div>

            {/* Avatar row — compact preview */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {room.players.map((p: any) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-1 px-1.5 py-1 rounded-lg text-[11px] border ${
                    p.isReady
                      ? "bg-emerald-500/10 border-emerald-500/25 text-white"
                      : "bg-surfaceRaised border-surfaceBorder text-muted"
                  }`}
                >
                  <span className="text-base">{p.avatar}</span>
                  <span className="max-w-[70px] truncate">{p.name}</span>
                  {p.isHost && <Crown className="w-2.5 h-2.5 text-amber-400 shrink-0" />}
                </div>
              ))}
            </div>

            {/* Config summary — one line */}
            <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-mono text-muted pt-1 border-t border-surfaceBorder/50">
              <span className="text-accent font-semibold">
                🎯 {room.filterType === "artists" && room.selectedArtists?.length > 0
                  ? `${room.selectedArtists.length} Artis`
                  : room.category || "Semua Playlist"}
              </span>
              <span>·</span>
              <span className="text-emerald-400 font-semibold">
                {room.difficulty === "easy"
                  ? "🟢 Mudah"
                  : room.difficulty === "medium"
                  ? "🟡 Sedang"
                  : room.difficulty === "hard"
                  ? "🔴 Sulit"
                  : "🔀 Campur"}
              </span>
              <span>·</span>
              <span className="text-cyan-400 font-semibold">
                {room.audioProfile === "fast"
                  ? "⚡ Cepat"
                  : room.audioProfile === "bass"
                  ? "🔊 Bass"
                  : "🤖 Datar"}
              </span>
              <span>·</span>
              <span>{room.maxRounds} Ronde</span>
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
        <main className="flex-1 flex flex-col gap-3 py-2 w-full">
          {/* Compact Status Bar: round + score pills + details button */}
          <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2 flex items-center justify-between gap-2 shadow-sm">
            <span className="font-mono text-muted font-bold text-[11px] shrink-0">
              {room.currentRound}/{room.maxRounds}
            </span>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1 min-w-0 justify-center">
              {sortedPlayers.map((p: any, idx: number) => (
                <button
                  key={p.id}
                  onClick={() => setShowPlayerSheet(true)}
                  className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono text-[10px] border shrink-0 transition ${
                    p.id === myPlayerId
                      ? "bg-zinc-800 border-accent/40 text-white font-bold"
                      : "bg-surface border-surfaceBorder text-muted"
                  }`}
                >
                  {idx === 0 && <Crown className="w-2.5 h-2.5 text-amber-400" />}
                  <span>{p.avatar}</span>
                  <span className="font-semibold">{p.score}</span>
                  {p.streak >= 2 && <span className="text-amber-400">🔥{p.streak}</span>}
                  <span className="text-red-400">
                    {p.lives !== undefined ? (p.lives > 0 ? "♥".repeat(p.lives) : "☠") : "♥♥♥"}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPlayerSheet(true)}
              className="shrink-0 p-1.5 rounded-lg bg-surface border border-surfaceBorder text-muted hover:text-white transition"
              title="Detail pemain & info ronde"
            >
              <Users className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ========================================================= */}
          {/* 🌟 UNIFIED HERO ARENA DECK (VINYL + CLEAN TIMELINE) */}
          {/* ========================================================= */}
          {(room.status === "playing" || room.status === "buzzed") && (() => {
            const phase = room.cluePhase || "playing";
            const clueIndex = room.clueIndex || 1;
            const totalClues = room.totalClues || 3;
            const secondsLeft = Math.max(0, room.clueSecondsLeft || 0);
            const isPlaying = phase === "playing";
            const isSilence = phase === "silence" || phase === "final_silence";

            // How long the current phase should last, for the progress ring.
            const playDurations = Array.isArray(room.cluePlayDurations) && room.cluePlayDurations.length
              ? room.cluePlayDurations
              : [5, 9, 15];
            const finalSil = Number(room.clueFinalSilenceSeconds) || 30;
            const gap = Number(room.clueGapSeconds) || 5;
            const phaseTotal = isPlaying
              ? playDurations[clueIndex - 1] ?? 5
              : phase === "final_silence"
              ? finalSil
              : gap;
            const phasePct = Math.max(
              0,
              Math.min(100, (secondsLeft / Math.max(1, phaseTotal)) * 100)
            );

            return (
              <div className="bg-surface border border-surfaceBorder rounded-2xl p-3 flex flex-col items-center gap-3 text-center shadow-lg relative overflow-hidden w-full">
                {/* Phase banner */}
                <div className="w-full flex items-center justify-between text-xs font-mono px-0.5">
                  <div className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-full text-zinc-300 font-bold text-[11px]">
                    <span>{room.mode === "tts" ? "🤖 Robot TTS" : "🎧 Time Slice"}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-accent font-extrabold">
                      Clue {Math.min(clueIndex, totalClues)}/{totalClues}
                    </span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono font-bold text-xs transition-colors ${
                      secondsLeft <= 3
                        ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
                        : isSilence
                        ? "bg-zinc-800/60 border-zinc-700 text-zinc-400"
                        : "bg-surfaceRaised border-surfaceBorder text-amber-400"
                    }`}
                  >
                    {isSilence ? <VolumeX className="w-3.5 h-3.5" /> : <Timer className="w-3.5 h-3.5" />}
                    <span>{secondsLeft}s</span>
                  </div>
                </div>

                {/* Vinyl + phase ring */}
                <div className="flex items-center justify-center gap-3">
                  <VinylPlayer
                    isPlaying={isPlayingAudio}
                    coverUrl={room.status === "revealed" ? room.revealedSong?.albumCover : undefined}
                    label=""
                    size="sm"
                    hideTag
                  />
                  <div className="flex flex-col items-start gap-1.5">
                    <AudioWaveformVisualizer
                      isPlaying={isPlayingAudio}
                      variant="emerald"
                      barCount={18}
                      height={18}
                      className="w-24 opacity-90"
                    />
                    <span className="text-[10px] font-mono text-mutedDark leading-tight">
                      {isPlaying
                        ? `Memutar ${phaseTotal}s`
                        : phase === "final_silence"
                        ? "Hening akhir"
                        : "Hening"}
                    </span>
                  </div>
                </div>

                {/* Big phase call-out */}
                <div
                  key={`${phase}-${clueIndex}`}
                  className={`clue-phase-banner animate-clue-in ${
                    phase === "final_silence" ? "clue-phase-glow" : ""
                  }`}
                >
                  {isPlaying ? (
                    <>
                      <span className="text-2xl">🎵</span>
                      <span className="text-sm font-black text-emerald-300">
                        CLUE {clueIndex}
                      </span>
                    </>
                  ) : phase === "final_silence" ? (
                    <>
                      <span className="text-2xl">🤫</span>
                      <span className="text-sm font-black text-zinc-300">
                        HENING — BERSIAP!
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl">🔇</span>
                      <span className="text-sm font-black text-zinc-400">HENING</span>
                    </>
                  )}
                </div>

                {/* Clue progress bars — one per clue, filling as each plays */}
                <div className="grid grid-cols-3 gap-1.5 w-full max-w-xs">
                  {Array.from({ length: totalClues }).map((_, i) => {
                    const n = i + 1;
                    const done = n < clueIndex || (n === clueIndex && !isPlaying && phase !== "final_silence");
                    const active = n === clueIndex && isPlaying;
                    return (
                      <div
                        key={n}
                        className={`h-1.5 rounded-full overflow-hidden border transition ${
                          done
                            ? "border-emerald-500/40 bg-emerald-500/30"
                            : active
                            ? "border-emerald-400/50 bg-surfaceRaised"
                            : "border-surfaceBorder bg-surfaceRaised/60"
                        }`}
                        title={`Clue ${n}: ${playDurations[i] ?? 5}s`}
                      >
                        {active && (
                          <div
                            className="h-full bg-emerald-400 transition-all duration-1000 ease-linear"
                            style={{ width: `${phasePct}%` }}
                          />
                        )}
                        {done && <div className="h-full bg-emerald-500/60" />}
                      </div>
                    );
                  })}
                </div>

                {/* Nyerah */}
                <div className="flex items-center justify-center w-full pt-2 border-t border-surfaceBorder/60">
                  <button
                    onClick={handleSkipRound}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition active:scale-95 cursor-pointer ${
                      room.skipVotes?.includes(myPlayerId)
                        ? "bg-red-500/20 text-red-300 border-red-500/50 font-bold"
                        : "bg-surfaceRaised hover:bg-zinc-800 border-surfaceBorder text-muted hover:text-red-400 hover:border-red-500/40"
                    }`}
                    title="Nyatakan ronde ini hangus"
                  >
                    <span>🏳️</span>
                    <span>Nyerah</span>
                  </button>
                </div>

                {/* Hidden native audio element */}
                <audio
                  ref={audioRef}
                  preload="auto"
                  onWaiting={() => setIsAudioBuffering(true)}
                  onPlaying={() => {
                    setIsAudioBuffering(false);
                    setIsPlayingAudio(true);
                  }}
                  onPause={() => {
                    setIsPlayingAudio(false);
                    setIsAudioBuffering(false);
                  }}
                  onEnded={() => {
                    setIsPlayingAudio(false);
                    setIsAudioBuffering(false);
                  }}
                  onError={() => {
                    setIsPlayingAudio(false);
                    setIsAudioBuffering(false);
                  }}
                />
              </div>
            );
          })()}

          {/* ======================================================== */}
          {/* THE GIANT 3D ARCADE BUZZER (Playing State) */}
          {/* ======================================================== */}
          {room.status === "playing" && (
            <div className="flex flex-col items-center justify-center py-2 gap-2">
              <button
                onClick={handleBuzz}
                disabled={(myPlayer?.lives ?? 3) <= 0 || isCooldown}
                className={`w-28 h-28 rounded-full text-white font-black text-2xl tracking-wider flex flex-col items-center justify-center select-none transition-all ${
                  (myPlayer?.lives ?? 3) <= 0
                    ? "bg-zinc-800 border-4 border-zinc-700 opacity-40 cursor-not-allowed text-zinc-500 shadow-none"
                    : isCooldown
                    ? "bg-amber-950/40 border-4 border-amber-500/60 text-amber-300 cursor-not-allowed shadow-lg shadow-amber-500/10 animate-pulse"
                    : "btn-buzzer-3d cursor-pointer active:scale-95 animate-pulse"
                }`}
              >
                <span>
                  {(myPlayer?.lives ?? 3) <= 0
                    ? "HABIS!"
                    : isCooldown
                    ? `${cooldownSeconds}s`
                    : "BUZZ!"}
                </span>
                <span className="text-[9px] font-mono font-bold tracking-widest uppercase opacity-90 mt-0.5">
                  {(myPlayer?.lives ?? 3) <= 0
                    ? "NYAWA 0/3"
                    : isCooldown
                    ? "TUNGGU"
                    : `NYAWA ${myPlayer?.lives ?? 3}/3`}
                </span>
              </button>
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
                <div className="w-full">
                  <GuessInput
                    onGuess={handleGuess}
                    onSkip={handleForfeitBuzz}
                    disabled={false}
                    guesses={[]}
                    maxGuesses={1}
                  />
                </div>
              ) : (
                <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl p-3 text-center w-full">
                  <p className="text-xs font-bold text-white">
                    Menunggu tebakan {room.buzzedPlayer?.name}...
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ======================================================== */}
          {/* REVEALED / ROUND OVER */}
          {/* ======================================================== */}
          {room.status === "revealed" && (
            <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 flex flex-col items-center gap-3 text-center shadow-lg animate-fade-in relative overflow-hidden">
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                RONDE {room.currentRound} SELESAI
              </span>

              {/* Album Cover & Track Details */}
              <div className="flex items-center gap-3.5 bg-surfaceRaised/80 border border-surfaceBorder p-3 rounded-2xl w-full text-left">
                {room.revealedSong?.albumCover ? (
                  <img
                    src={room.revealedSong.albumCover}
                    alt={room.revealedSong.title}
                    className="w-16 h-16 rounded-xl object-cover shadow-md shrink-0 border border-surfaceBorder"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-surfaceBorder flex items-center justify-center text-zinc-500 shrink-0 text-2xl">
                    💿
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-black text-white truncate">
                    {room.revealedSong?.title}
                  </h3>
                  <p className="text-xs text-muted truncate mt-0.5">
                    {room.revealedSong?.artist}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-[11px] font-mono text-zinc-400">
                    <span>{room.revealedSong?.year || "Musik"}</span>
                    <span>•</span>
                    <span className="text-accent">{room.revealedSong?.category}</span>
                  </div>
                </div>
              </div>

              {/* Round Winner Banner */}
              {lastRoundWinner ? (
                <div className="w-full bg-emerald-500/15 border border-emerald-500/30 rounded-xl p-2.5 text-center text-xs font-mono text-emerald-300 font-bold flex items-center justify-center gap-1.5 animate-bounce">
                  <span>🏆</span>
                  <span>{lastRoundWinner.name} berhasil menebak! (+{lastRoundWinner.points} PTS)</span>
                  {lastRoundWinner.streak >= 2 && <span>🔥{lastRoundWinner.streak}x</span>}
                </div>
              ) : (
                <div className="w-full bg-zinc-800/80 border border-zinc-700/40 rounded-xl p-2.5 text-center text-xs font-mono text-zinc-400 font-medium">
                  💀 Tidak ada yang berhasil menebak! Ronde ini hangus.
                </div>
              )}

              {/* 5-Second Auto Advance Countdown Indicator */}
              <div className="w-full bg-surfaceRaised border border-surfaceBorder rounded-xl p-2.5 flex flex-col gap-1.5 font-mono text-xs">
                <div className="flex items-center justify-between text-zinc-300">
                  <span className="flex items-center gap-1.5 text-[11px]">
                    <Timer className="w-3.5 h-3.5 text-accent animate-pulse" />
                    <span>Lanjut otomatis dalam:</span>
                  </span>
                  <span className="text-accent font-bold text-sm">
                    {room.nextRoundCountdown !== null && room.nextRoundCountdown !== undefined
                      ? `${room.nextRoundCountdown}s`
                      : "5s"}
                  </span>
                </div>
                <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-accent h-full transition-all duration-1000"
                    style={{
                      width: `${Math.max(0, Math.min(100, ((room.nextRoundCountdown ?? 5) / 5) * 100))}%`,
                    }}
                  />
                </div>
              </div>
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

              {/* Share Podium Button */}
              <button
                onClick={() => setShowSocialModal(true)}
                className="w-full mt-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 text-xs transition active:scale-95 cursor-pointer shadow-sm"
              >
                <Share2 className="w-4 h-4" />
                <span>Bagikan Hasil Mabar (WA / IG / TikTok)</span>
              </button>

              {isHost ? (
                <button
                  onClick={handleStartGame}
                  className="w-full mt-1 bg-accent hover:bg-green-500 text-zinc-950 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition active:scale-95 text-sm shadow-md cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Main Lagi dengan Teman</span>
                </button>
              ) : (
                <p className="text-xs text-muted font-mono mt-1">
                  Menunggu Host memulai game baru...
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 w-full mt-1">
                <Link
                  href="/leaderboard"
                  className="py-2.5 px-3 rounded-xl border border-surfaceBorder bg-surfaceRaised hover:bg-zinc-800 text-xs font-semibold text-amber-400 hover:text-amber-300 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Trophy className="w-3.5 h-3.5" />
                  <span>Peringkat</span>
                </Link>

                <button
                  onClick={handleExitRoom}
                  className="py-2.5 px-3 rounded-xl border border-surfaceBorder bg-surfaceRaised hover:bg-zinc-800 text-xs font-semibold text-muted hover:text-white transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Keluar</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Reaction & Meme Soundboard — one button, opens a modal */}
          <div className="mt-1 flex justify-center">
            <button
              onClick={() => {
                sfx.playClick();
                setShowStickerSheet(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surfaceRaised/60 border border-surfaceBorder text-xs font-semibold text-muted hover:text-white hover:border-accent/40 transition active:scale-95 cursor-pointer"
            >
              <Smile className="w-3.5 h-3.5 text-accent" />
              <span>Reaksi</span>
            </button>
          </div>
        </main>
      )}

      {/* FIXED STICKY ACTION BAR FOR ALL PLAYERS (AUTO COUNTDOWN & MANUAL FAST-FORWARD) */}
      {view === "game" && room?.status === "revealed" && (
        <div className="fixed bottom-2 left-3 right-3 max-w-md mx-auto z-50">
          <button
            onClick={handleNextRound}
            className={`w-full font-black py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 text-base shadow-2xl cursor-pointer border ${
              isHost
                ? "bg-accent hover:bg-green-500 text-zinc-950 border-green-400/40 shadow-accent/50"
                : room.nextRoundVotes?.includes(myPlayerId)
                ? "bg-surfaceRaised border-accent/40 text-accent font-bold"
                : "bg-accent hover:bg-green-500 text-zinc-950 border-green-400/40 shadow-accent/50"
            }`}
          >
            <span>
              {room.currentRound >= room.maxRounds
                ? "Lihat Podium Juara 🏆"
                : isHost
                ? `Lanjut Langsung (${room.nextRoundCountdown ?? 5}s) ➔`
                : room.nextRoundVotes?.includes(myPlayerId)
                ? `✓ Menunggu Pemain (${room.nextRoundVotes?.length || 0}/${
                    room.players?.filter((p: any) => !p.isDisconnected).length || 1
                  }) · ${room.nextRoundCountdown ?? 5}s`
                : `Siap Lanjut (${room.nextRoundCountdown ?? 5}s) ➔`}
            </span>
          </button>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirm && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-5 max-w-xs w-full flex flex-col items-center gap-4 text-center shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 text-2xl">
              🚪
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Keluar dari Room?</h4>
              <p className="text-xs text-muted mt-1">
                Kamu akan meninggalkan game dan posisimu di room ini akan dilepas.
              </p>
            </div>
            <div className="flex items-center gap-2 w-full mt-1">
              <button
                onClick={() => setShowExitConfirm(false)}
                className="flex-1 py-2.5 rounded-xl bg-surfaceRaised border border-surfaceBorder text-xs font-semibold text-zinc-300 hover:text-white transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleExitRoom}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white shadow-md shadow-red-600/30 transition cursor-pointer"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="w-full text-center py-2 text-[11px] text-mutedDark font-mono z-10">
        Tebak Lagu Multiplayer · Real-Time WebSockets
      </footer>

      {/* Social Share Modal */}
      <SocialShareModal
        isOpen={showSocialModal}
        onClose={() => setShowSocialModal(false)}
        title="Bagikan Hasil Mabar Tebak Lagu"
        score={room?.players?.find((p: any) => p.id === myPlayerId)?.score}
        modeTitle={`Multiplayer Room (${room?.players?.length || 2} Pemain)`}
        shareUrl="https://tebak-lagu-live.fly.dev/multiplayer"
      />

      {/* Room QR Code Modal */}
      {room && (
        <RoomQrCodeModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          roomCode={room.code}
        />
      )}

      {/* Round Kickoff Tension Countdown Overlay */}
      {roundKickoff !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="text-xs font-mono text-emerald-400 font-bold tracking-widest uppercase">
              RONDE {room?.currentRound} DARI {room?.maxRounds}
            </span>
            <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-300 font-black text-5xl shadow-2xl shadow-emerald-500/40 animate-pulse">
              {roundKickoff > 0 ? roundKickoff : "🎧"}
            </div>
            <h3 className="text-xl font-black text-white mt-1">
              {roundKickoff > 0 ? "PASANG TELINGAMU!" : "DENGARKAN & TEBAK!"}
            </h3>
            <p className="text-xs text-muted max-w-xs">
              {room?.mode === "tts"
                ? "Robot akan segera membacakan bait lirik secara serentak..."
                : "Cuplikan musik akan berputar serentak di semua perangkat!"}
            </p>
          </div>
        </div>
      )}

      {/* Emoji & SFX Modal */}
      {showStickerSheet && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowStickerSheet(false)}
        >
          <div
            className="w-full max-w-xs bg-surface border border-surfaceBorder rounded-2xl p-5 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Smile className="w-4 h-4 text-accent" />
                Reaksi
              </h3>
              <button
                onClick={() => setShowStickerSheet(false)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <span className="text-[10px] font-mono text-mutedDark uppercase tracking-wider">
                Emoji
              </span>
              <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      sendReaction(emoji);
                      setShowStickerSheet(false);
                    }}
                    className="text-2xl p-1.5 rounded-xl hover:bg-surfaceRaised hover:scale-125 active:scale-90 transition cursor-pointer"
                    title={`Kirim ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-mono text-mutedDark uppercase tracking-wider flex items-center gap-1">
                <Volume1 className="w-3 h-3" />
                SFX
              </span>
              <div className="grid grid-cols-3 gap-1.5 mt-2">
                {MEME_SOUNDS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => {
                      sendSfx(s.id);
                      setShowStickerSheet(false);
                    }}
                    className="py-2 px-1 rounded-xl bg-surfaceRaised border border-surfaceBorder hover:border-accent/40 text-[11px] font-mono font-medium text-zinc-300 hover:text-white flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer"
                    title={s.title}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Player & Round Info Sheet */}
      {showPlayerSheet && room && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowPlayerSheet(false)}
        >
          <div
            className="w-full sm:max-w-md bg-surface border border-surfaceBorder rounded-t-3xl sm:rounded-3xl p-5 shadow-2xl flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surfaceBorder">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-accent" />
                {view === "room" ? "Pemain Room" : "Pemain & Info Ronde"}
              </h3>
              <button
                onClick={() => setShowPlayerSheet(false)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Round config summary — game only; the lobby already shows it inline */}
            {view === "game" && (
              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2">
                <span className="text-mutedDark block text-[10px]">PLAYLIST</span>
                <span className="text-accent font-bold">
                  {room.filterType === "artists" && room.selectedArtists?.length > 0
                    ? `${room.selectedArtists.length} Artis`
                    : room.category || "Semua Playlist"}
                </span>
              </div>
              <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2">
                <span className="text-mutedDark block text-[10px]">KESULITAN</span>
                <span className="text-emerald-400 font-bold">
                  {room.difficulty === "easy"
                    ? "🟢 Mudah"
                    : room.difficulty === "medium"
                    ? "🟡 Sedang"
                    : room.difficulty === "hard"
                    ? "🔴 Sulit"
                    : "🔀 Campur"}
                </span>
              </div>
              <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2">
                <span className="text-mutedDark block text-[10px]">SUARA</span>
                <span className="text-cyan-400 font-bold">
                  {room.audioProfile === "fast"
                    ? "⚡ Cepat"
                    : room.audioProfile === "bass"
                    ? "🔊 Bass"
                    : "🤖 Datar"}
                </span>
              </div>
              <div className="bg-surfaceRaised border border-surfaceBorder rounded-xl px-3 py-2">
                <span className="text-mutedDark block text-[10px]">RONDE</span>
                <span className="text-zinc-200 font-bold">
                  {room.currentRound} / {room.maxRounds}
                </span>
              </div>
              </div>
            )}

            {/* Player list with full detail */}
            <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
              {sortedPlayers.map((p: any, idx: number) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between bg-surfaceRaised/70 border rounded-xl px-3 py-2 ${
                    p.id === myPlayerId ? "border-accent/40" : "border-surfaceBorder"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0">{p.avatar}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                        {p.isHost && <Crown className="w-3 h-3 text-amber-400 shrink-0" />}
                        {idx === 0 && view === "game" && (
                          <span className="text-[9px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/30 px-1 rounded font-bold">
                            #1
                          </span>
                        )}
                        {p.id === myPlayerId && (
                          <span className="text-[9px] font-mono text-mutedDark">(Kamu)</span>
                        )}
                      </div>
                      {p.streak >= 2 && (
                        <span className="text-[10px] text-amber-400 font-mono">
                          🔥 Streak {p.streak}x
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {view === "room" ? (
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
                          p.isReady
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-zinc-800 text-zinc-500"
                        }`}
                      >
                        {p.isReady ? "Siap ✓" : "Menunggu..."}
                      </span>
                    ) : (
                      <>
                        <span className="text-xs font-mono font-bold text-zinc-200">
                          {p.score}
                        </span>
                        <span className="text-[10px] text-red-400">
                          {p.lives !== undefined ? (p.lives > 0 ? "♥".repeat(p.lives) : "☠") : "♥♥♥"}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Disconnect Reconnecting Overlay */}
      {!isConnected && (view === "room" || view === "game") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-surface border border-surfaceBorder rounded-3xl p-6 max-w-xs w-full text-center flex flex-col items-center gap-3.5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base">Menghubungkan Kembali...</h3>
              <p className="text-xs text-muted mt-1 leading-relaxed">
                Koneksi terputus sejenak. Menyambungkan ulang ke room tanpa membatalkan permainan...
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
