"use client";

import { io, Socket } from "socket.io-client";

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
import { useAuth } from "@/lib/auth-context";
import { HummingSynth } from "@/lib/audio-synth";
import { sfx } from "@/lib/sound-fx";
import confetti from "canvas-confetti";

const AVATARS = ["👑", "🎧", "🎤", "🎸", "🎹", "🥁", "🎷", "⚡", "🕶️", "🚀"];
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
  const [avatar, setAvatar] = useState("👑");
  const [roomCodeInput, setRoomCodeInput] = useState("");
  const [view, setView] = useState<"menu" | "create" | "join" | "room" | "game">("menu");
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // Room config (Create)
  const [selectedMode, setSelectedMode] = useState("heardle");
  const [selectedCategory, setSelectedCategory] = useState("Semua Genre");
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
  const synthRef = useRef<HummingSynth | null>(null);

  const playAudioRef = useRef<(customRoom?: any) => void>(() => {});
  const pauseAudioRef = useRef<() => void>(() => {});

  useEffect(() => {
    const timer = setInterval(() => setCooldownTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    synthRef.current = new HummingSynth();
    return () => {
      synthRef.current?.stop();
    };
  }, []);

  const { user } = useAuth();

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
    if (synthRef.current) synthRef.current.stop();
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
    if (synthRef.current) synthRef.current.stop();
    setIsPlayingAudio(false);
    setIsAudioBuffering(false);
  };

  const playAudioLocal = (customRoom?: any) => {
    const r = customRoom || room;
    if (!r?.currentSongClue || !audioRef.current) return;

    if (sliceTimerRef.current) {
      clearTimeout(sliceTimerRef.current);
      sliceTimerRef.current = null;
    }

    const profile = r.audioProfile || "normal";

    if (r.mode === "tts") {
      const clues = r.currentSongClue?.lyricsClues || [];
      const fullLyrics = clues.join(". \n");
      const speedParam = profile === "fast" ? "1.25" : profile === "bass" ? "0.8" : "1";
      const langParam = r.currentSongClue?.lang || "id";
      const ttsUrl = `/api/tts?text=${encodeURIComponent(fullLyrics || "Dengarkan lirik")}&speed=${speedParam}&lang=${langParam}`;
      if (audioRef.current.src !== ttsUrl) {
        audioRef.current.src = ttsUrl;
      }
    } else {
      const stageLimits = [5, 5, 9, 18, 30];
      const maxDuration = stageLimits[r.clueStage || 1] || 5;

      const previewUrl = r.currentSongClue?.previewUrl || "";
      if (audioRef.current.src !== previewUrl) {
        audioRef.current.src = previewUrl;
      }

      if (r.currentSongClue?.startSecond) {
        audioRef.current.currentTime = r.currentSongClue.startSecond;
      }

      sliceTimerRef.current = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
          setIsPlayingAudio(false);
        }
      }, maxDuration * 1000);
    }

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
                  avatar: avatar,
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

            // Seamlessly auto-play the newly unlocked clue audio for all devices
            setTimeout(() => {
              playAudioRef.current(data.room);
            }, 250);
          } else if (data.type === "round_started") {
            stopAndResetAudio();
            setRoom(data.room);
            setView("game");
            setBuzzCountdown(0);
            setLastRoundWinner(null);
            setRoundKickoff(3); // 3-second tension countdown!

            // Preload audio immediately in background so first click plays with 0ms lag!
            setTimeout(() => {
              if (audioRef.current && data.room) {
                const r = data.room;
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
              }
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
              if (data.resumeAudio) {
                setTimeout(() => playAudioRef.current(data.room), 400);
              }
            }
          } else if (data.type === "round_revealed") {
            setRoom(data.room);
            setBuzzCountdown(0);
            if (buzzTimerRef.current) clearInterval(buzzTimerRef.current);

            // Celebration: play the full hook of the revealed song!
            if (audioRef.current && data.room?.revealedSong?.previewUrl) {
              audioRef.current.src = data.room.revealedSong.previewUrl;
              audioRef.current.currentTime = data.room.revealedSong.startSecond || 0;
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
                    category: data.room?.category || "Semua Genre",
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
        avatar,
        mode: selectedMode,
        category: selectedCategory,
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
        avatar,
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
    if (synthRef.current) synthRef.current.stop();
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

  const handleAdvanceClue = () => {
    if (!socketRef.current || !socketRef.current?.connected || !room) return;
    sfx.playClick();
    emit("vote_advance_clue", {
      roomCode: room.code,
      playerId: myPlayerId || myPlayer?.id,
      playerName: myPlayer?.name || playerName
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
      className={`min-h-[100dvh] overflow-y-auto pb-28 bg-background text-zinc-100 flex flex-col justify-between p-4 max-w-lg mx-auto select-none relative transition-colors duration-200 ${
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
      <header className="w-full flex items-center justify-between pb-3.5 border-b border-surfaceBorder z-10">
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

          {/* User Auth Bar */}
          <div className="flex items-center justify-between bg-surface border border-surfaceBorder rounded-2xl p-3 px-4 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-muted uppercase">Status:</span>
              <span className="text-xs font-semibold text-white">
                {user ? user.name : "Tamu (Guest)"}
              </span>
            </div>
            <GoogleAuthButton />
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

          {/* Players in Room */}
          <div className="bg-surface border border-surfaceBorder rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-mutedDark font-semibold">
              <span>PEMAIN TERGABUNG ({room.players.length}/8)</span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                <span className="text-accent font-semibold">🎯 {room.category || "Semua Genre"}</span>
                <span>•</span>
                <span className="text-emerald-400 font-semibold">
                  {room.difficulty === "easy"
                    ? "🟢 Mudah"
                    : room.difficulty === "medium"
                    ? "🟡 Sedang"
                    : room.difficulty === "hard"
                    ? "🔴 Sulit"
                    : "🔀 Campur"}
                </span>
                <span>•</span>
                <span className="text-cyan-400 font-semibold">
                  {room.audioProfile === "fast"
                    ? "⚡ Cepat"
                    : room.audioProfile === "bass"
                    ? "🔊 Bass"
                    : "🤖 Datar"}
                </span>
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
                🎯 {room.category || "Semua Genre"} ·{" "}
                {room.difficulty === "easy"
                  ? "🟢 Mudah"
                  : room.difficulty === "medium"
                  ? "🟡 Sedang"
                  : room.difficulty === "hard"
                  ? "🔴 Sulit"
                  : "🔀 Campur"}{" "}
                ·{" "}
                {room.audioProfile === "fast"
                  ? "⚡ Cepat"
                  : room.audioProfile === "bass"
                  ? "🔊 Bass"
                  : "🤖 Datar"}
              </span>
            </div>

            {/* Score Strip with Rank badges, Streaks and Lives */}
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
                  {p.streak >= 2 && (
                    <span className="text-[10px] text-amber-400 font-bold bg-amber-500/15 px-1 rounded border border-amber-500/30" title={`Win streak ${p.streak}x berturut-turut!`}>
                      🔥{p.streak}x
                    </span>
                  )}
                  <span className="text-[10px] text-red-400 ml-0.5">
                    {p.lives !== undefined ? (p.lives > 0 ? "❤️".repeat(p.lives) : "💀") : "❤️❤️❤️"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 🌟 UNIFIED HERO ARENA DECK (VINYL + CLEAN TIMELINE) */}
          {/* ========================================================= */}
          {(room.status === "playing" || room.status === "buzzed") && (() => {
            const currentStage = room.clueStage || 1;
            const maxSecondsForStage = currentStage === 4 ? 15 : 10;
            const secondsLeft = room.clueSecondsLeft !== undefined ? room.clueSecondsLeft : maxSecondsForStage;
            const stageProgressPct = Math.max(0, Math.min(100, (secondsLeft / maxSecondsForStage) * 100));

            return (
              <div className="bg-surface border border-surfaceBorder rounded-3xl p-4 sm:p-5 flex flex-col items-center gap-3.5 text-center shadow-lg relative overflow-hidden w-full">
                {/* Header: Subtle Stage & Countdown Pill */}
                <div className="w-full flex items-center justify-between text-xs font-mono px-0.5">
                  <div className="flex items-center gap-1.5 bg-surfaceRaised border border-surfaceBorder px-2.5 py-1 rounded-full text-zinc-300 font-bold text-[11px]">
                    <span>{room.mode === "tts" ? "🤖 Robot TTS" : "🎧 Heardle"}</span>
                    <span className="text-zinc-500">·</span>
                    <span className="text-accent font-extrabold">Tahap {currentStage}/4</span>
                  </div>

                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border font-mono font-bold text-xs transition-colors ${
                      secondsLeft <= 3
                        ? "bg-red-500/15 border-red-500/40 text-red-400 animate-pulse"
                        : "bg-surfaceRaised border-surfaceBorder text-amber-400"
                    }`}
                  >
                    <Timer className="w-3.5 h-3.5" />
                    <span>{secondsLeft}s</span>
                  </div>
                </div>

                {/* Spinning Vinyl Record Deck */}
                <div className="py-0.5">
                  <VinylPlayer
                    isPlaying={isPlayingAudio}
                    coverUrl={room.status === "revealed" ? room.revealedSong?.albumCover : undefined}
                    label={
                      isPlayingAudio
                        ? room.mode === "tts"
                          ? "Robot Sedang Membacakan Lirik..."
                          : "Audio Clue Sedang Berputar..."
                        : "Audio Clue Siap"
                    }
                    size="sm"
                  />
                </div>

                {/* Sleek Waveform Visualizer */}
                <AudioWaveformVisualizer
                  isPlaying={isPlayingAudio}
                  variant="emerald"
                  barCount={28}
                  height={24}
                  className="w-full max-w-xs opacity-90 my-0"
                />

                {/* 4 Clean Segmented Stage Pills (NO TEXT SPOILERS) */}
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2 w-full max-w-sm mt-0.5">
                  {[1, 2, 3, 4].map((stageNum) => {
                    const isCurrent = currentStage === stageNum;
                    const isUnlocked = currentStage >= stageNum;
                    const label =
                      room.mode === "tts"
                        ? `Bait ${stageNum}`
                        : stageNum === 1
                        ? "5s"
                        : stageNum === 2
                        ? "9s"
                        : stageNum === 3
                        ? "18s"
                        : "30s";

                    return (
                      <div
                        key={stageNum}
                        className={`relative h-8 rounded-xl flex items-center justify-center font-mono text-[11px] font-bold transition-all duration-300 overflow-hidden border ${
                          isCurrent
                            ? "border-emerald-400 bg-zinc-900 text-emerald-300 shadow-md shadow-emerald-500/20"
                            : isUnlocked
                            ? "border-emerald-700/60 bg-emerald-950/40 text-emerald-400"
                            : "border-surfaceBorder bg-surfaceRaised/60 text-zinc-600"
                        }`}
                        title={`Tahap ${stageNum}: ${label}`}
                      >
                        {/* Smooth active countdown fill inside current pill */}
                        {isCurrent && (
                          <div
                            className="absolute inset-0 bg-emerald-500/20 transition-all duration-1000 ease-linear"
                            style={{ width: `${stageProgressPct}%` }}
                          />
                        )}
                        <span className="relative z-10 flex items-center gap-1 select-none">
                          {isUnlocked ? (
                            isCurrent ? (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            ) : (
                              <span className="text-[10px]">✓</span>
                            )
                          ) : (
                            <span className="text-[9px]">🔒</span>
                          )}
                          <span>{label}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Action Toolbar: Replay + Host + Voting */}
                <div className="flex items-center justify-between w-full pt-2.5 border-t border-surfaceBorder/60 gap-2 flex-wrap">
                  {/* Left: Replay & Host audio controls */}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => playAudioLocal()}
                      disabled={isAudioBuffering}
                      className="flex items-center gap-1 bg-surfaceRaised hover:bg-zinc-800 border border-surfaceBorder text-zinc-300 px-2.5 py-1 rounded-lg text-xs font-medium transition active:scale-95 cursor-pointer shadow-sm"
                      title="Dengarkan ulang clue di ponselmu"
                    >
                      {isAudioBuffering ? (
                        <Loader2 className="w-3 h-3 text-accent animate-spin" />
                      ) : isPlayingAudio ? (
                        <Volume2 className="w-3 h-3 text-accent animate-pulse" />
                      ) : (
                        <RotateCcw className="w-3 h-3 text-accent" />
                      )}
                      <span className="text-[11px]">{isPlayingAudio ? "Berputar" : "Ulang"}</span>
                    </button>

                    {isHost && (
                      <button
                        onClick={handleToggleRoomAudio}
                        disabled={isAudioBuffering}
                        className="flex items-center gap-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2.5 py-1 rounded-lg text-xs font-medium transition active:scale-95 cursor-pointer"
                        title="Kontrol Host: Jeda / Lanjut audio room"
                      >
                        {isPlayingAudio ? (
                          <Pause className="w-3 h-3 text-amber-400" />
                        ) : (
                          <Play className="w-3 h-3 fill-current text-amber-400" />
                        )}
                        <span className="text-[11px]">{isPlayingAudio ? "Jeda" : "Putar"}</span>
                      </button>
                    )}
                  </div>

                  {/* Right: Buka Clue & Nyerah Buttons */}
                  <div className="flex items-center gap-1.5">
                    {currentStage < 4 && (() => {
                      const activeCount = Math.max(1, room.players?.filter((p: any) => !p.isDisconnected).length || 1);
                      const requiredVotes =
                        room.clueVotesRequired ||
                        (activeCount <= 2 ? activeCount : Math.floor(activeCount / 2) + 1);
                      const hasVoted =
                        room.clueVotes?.includes(myPlayerId) ||
                        (myPlayer?.id && room.clueVotes?.includes(myPlayer.id));
                      const currentVotes = room.clueVotes?.length || 0;

                      return (
                        <button
                          onClick={handleAdvanceClue}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition active:scale-95 cursor-pointer ${
                            hasVoted
                              ? "bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold animate-pulse"
                              : "bg-surfaceRaised hover:bg-zinc-800 border-surfaceBorder text-muted hover:text-amber-400"
                          }`}
                          title={
                            activeCount <= 2
                              ? "Butuh persetujuan kedua pemain untuk membuka clue"
                              : "Butuh >50% persetujuan pemain"
                          }
                        >
                          <span>💡</span>
                          <span className="text-[11px]">
                            {hasVoted
                              ? `Menunggu (${currentVotes}/${requiredVotes})`
                              : `Buka Clue (${currentVotes}/${requiredVotes})`}
                          </span>
                        </button>
                      );
                    })()}

                    <button
                      onClick={handleSkipRound}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition active:scale-95 cursor-pointer ${
                        room.skipVotes?.includes(myPlayerId)
                          ? "bg-red-500/20 text-red-300 border-red-500/50 font-bold"
                          : "bg-surfaceRaised hover:bg-zinc-800 border-surfaceBorder text-muted hover:text-red-400"
                      }`}
                    >
                      <span>🏳️</span>
                      <span className="text-[11px]">
                        {room.skipVotes?.includes(myPlayerId) ? "Batal" : "Nyerah"}{" "}
                        ({room.skipVotes?.length || 0}/
                        {room.players?.filter((p: any) => !p.isDisconnected).length || 1})
                      </span>
                    </button>
                  </div>
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
            <div className="flex flex-col items-center justify-center py-4 gap-3">
              <button
                onClick={handleBuzz}
                disabled={(myPlayer?.lives ?? 3) <= 0 || isCooldown}
                className={`w-44 h-44 rounded-full text-white font-black text-3xl tracking-wider flex flex-col items-center justify-center select-none transition-all ${
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
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase opacity-90 mt-1">
                  {(myPlayer?.lives ?? 3) <= 0
                    ? "NYAWA (0/3)"
                    : isCooldown
                    ? "PENALTI SALAH"
                    : "TEKAN JIKA TAHU"}
                </span>
              </button>
              <p className="text-xs text-muted font-mono text-center mt-1">
                {(myPlayer?.lives ?? 3) <= 0
                  ? "💀 Nyawamu di ronde ini sudah habis! Menunggu ronde selanjutnya..."
                  : isCooldown
                  ? `⏳ Penalti salah tebak! Tunggu ${cooldownSeconds} detik sebelum boleh buzz lagi.`
                  : "⚡ Tekan tombol buzzer di atas begitu kamu tahu lagunya!"}
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
                    onSkip={handleForfeitBuzz}
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

          {/* Quick Reaction & Meme Soundboard Bar */}
          <div className="flex flex-col gap-1.5 mt-1 bg-surfaceRaised/60 border border-surfaceBorder rounded-2xl p-2 px-3">
            {/* Emojis */}
            <div className="flex items-center justify-center gap-2">
              <span className="text-[10px] font-mono text-mutedDark">Emoji:</span>
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="text-lg p-0.5 hover:scale-125 active:scale-90 transition-transform cursor-pointer"
                  title={`Kirim ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Meme Soundboard Buttons */}
            <div className="flex items-center justify-center gap-1.5 pt-1 border-t border-surfaceBorder/40">
              <span className="text-[10px] font-mono text-accent font-semibold flex items-center gap-0.5">
                <Volume1 className="w-3 h-3" />
                <span>SFX:</span>
              </span>
              {MEME_SOUNDS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => sendSfx(s.id)}
                  className="px-2 py-1 rounded-lg bg-surface border border-surfaceBorder hover:border-accent/40 text-[11px] font-mono font-medium text-zinc-300 hover:text-white flex items-center gap-1 transition active:scale-95 cursor-pointer shadow-sm"
                  title={s.title}
                >
                  <span>{s.icon}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* FIXED STICKY ACTION BAR FOR ALL PLAYERS (AUTO COUNTDOWN & MANUAL FAST-FORWARD) */}
      {view === "game" && room?.status === "revealed" && (
        <div className="fixed bottom-3 left-4 right-4 max-w-lg mx-auto z-50">
          <button
            onClick={handleNextRound}
            className={`w-full font-black py-4 px-4 rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 text-base shadow-2xl cursor-pointer border ${
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
