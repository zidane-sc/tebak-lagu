const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database connection (LibSQL / SQLite persistent engine)
const { db, initDb, getRandomSong, getMatchSongsQueue, getCatalogStats, getSettingsFromDb } = require("./src/lib/db-server.js");
initDb().then(async () => {
  const stats = await getCatalogStats();
  console.log(`> Database Connected: ${stats.total} persistent songs ready in SQLite.`);
}).catch((err) => {
  console.error("> Database init error:", err);
});

// -------------------------------------------------------------
// MULTIPLAYER ROOM STATE MANAGER (Socket.IO Real-time Engine)
// -------------------------------------------------------------
const rooms = new Map(); // roomCode -> RoomState
const clientMeta = new WeakMap(); // socket -> { id, roomCode, name }
let io; // Global Socket.IO Server Instance

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcast(room, payload, excludeSocket = null) {
  if (!io || !room || !room.code) return;
  const data = typeof payload === "string" ? JSON.parse(payload) : (payload || {});
  const eventName = data.type || "game_message";
  if (excludeSocket && excludeSocket.to) {
    excludeSocket.to(room.code).emit(eventName, data);
  } else {
    io.to(room.code).emit(eventName, data);
  }
}

function sendTo(socket, payload) {
  if (!socket) return;
  const data = typeof payload === "string" ? JSON.parse(payload) : (payload || {});
  const eventName = data.type || "game_message";
  socket.emit(eventName, data);
}

// In-memory preview URL cache for fast resolution
const songPreviewCache = new Map();

async function resolvePreviewUrl(song) {
  if (song.previewFallback) return song.previewFallback;
  if (songPreviewCache.has(song.id)) return songPreviewCache.get(song.id);

  const q = song.searchQuery || `${song.title} ${song.artist}`;
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&entity=song&limit=1`;
    const res = await fetch(url, { headers: { "User-Agent": "TebakLagu/2.0" } });
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results[0] && data.results[0].previewUrl) {
        songPreviewCache.set(song.id, data.results[0].previewUrl);
        return data.results[0].previewUrl;
      }
    }
  } catch (e) {}

  return null;
}

// In-memory lyrics cache for fast resolution
const lyricsCache = new Map();

async function resolveLyrics(song) {
  // If song already has rich curated lyrics that don't contain dummy text
  if (
    song.lyricsClues &&
    song.lyricsClues.length > 0 &&
    !song.lyricsClues[0].toLowerCase().includes("tebak judul lagu")
  ) {
    return song.lyricsClues;
  }

  const cacheKey = `${song.title.toLowerCase().trim()}::${song.artist.toLowerCase().trim()}`;
  if (lyricsCache.has(cacheKey)) {
    return lyricsCache.get(cacheKey);
  }

  try {
    const url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(
      song.artist
    )}&track_name=${encodeURIComponent(song.title)}`;
    const res = await fetch(url, { headers: { "User-Agent": "TebakLagu/3.0" } });
    if (res.ok) {
      const data = await res.json();
      const rawText = data.plainLyrics || data.syncedLyrics || "";
      if (rawText) {
        // Strip timestamps: [00:12.34]
        const cleanLines = rawText
          .split("\n")
          .map((l) => l.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, "").trim())
          .filter((l) => l.length > 5 && !l.startsWith("[") && !l.endsWith("]"));

        // Filter out lines that give away the title or artist directly
        const titleWords = song.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const nonRevealing = cleanLines.filter((l) => {
          const lLow = l.toLowerCase();
          return (
            !titleWords.some((w) => lLow.includes(w)) &&
            !lLow.includes(song.artist.toLowerCase())
          );
        });

        const targetLines = nonRevealing.length >= 2 ? nonRevealing : cleanLines;

        if (targetLines.length >= 2) {
          const clues = [];
          for (let i = 0; i < Math.min(6, targetLines.length); i += 2) {
            if (targetLines[i + 1]) {
              clues.push(`${targetLines[i]}\n${targetLines[i + 1]}`);
            } else {
              clues.push(targetLines[i]);
            }
          }
          if (clues.length > 0) {
            lyricsCache.set(cacheKey, clues);
            return clues;
          }
        }
      }
    }
  } catch (e) {
    console.log("LRCLIB fetch error:", e.message);
  }

  return null;
}

function getSanitizedRoom(room) {
  const activePlayers = room.players.filter((p) => !p.isDisconnected);
  const totalActive = Math.max(1, activePlayers.length);
  const clueVotesRequired = totalActive <= 2
    ? totalActive
    : Math.floor(totalActive / 2) + 1;

  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    category: room.category,
    difficulty: room.difficulty || "easy",
    audioProfile: room.audioProfile || "normal",
    maxRounds: room.maxRounds,
    currentRound: room.currentRound,
    status: room.status,
    nextRoundCountdown: room.nextRoundCountdown !== undefined ? room.nextRoundCountdown : null,
    nextRoundVotes: room.nextRoundVotes ? Array.from(room.nextRoundVotes) : [],
    clueStage: room.clueStage || 1,
    clueSecondsLeft: room.clueSecondsLeft !== undefined ? room.clueSecondsLeft : 10,
    skipVotes: room.skipVotes ? Array.from(room.skipVotes) : [],
    clueVotes: room.clueVotes ? Array.from(room.clueVotes) : [],
    clueVotesRequired,
    playerLives: room.buzzState ? (room.buzzState.playerLives || {}) : {},
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isReady: p.isReady,
      isHost: p.id === room.hostId,
      isDisconnected: !!p.isDisconnected,
      lives:
        room.buzzState && room.buzzState.playerLives && room.buzzState.playerLives[p.id] !== undefined
          ? room.buzzState.playerLives[p.id]
          : 3,
      buzzCooldownUntil: room.buzzCooldowns && room.buzzCooldowns[p.id] ? room.buzzCooldowns[p.id] : 0,
      streak: p.streak || 0,
    })),
    settings: {
      clueExtensionIntervalSeconds: room.clueExtensionIntervalSeconds || 10,
      finalStageSeconds: room.finalStageSeconds || 15,
      buzzerTimerSeconds: room.buzzerTimerSeconds || 15,
      playerLivesPerRound: room.playerLivesPerRound || 3,
      heardleDurations: room.heardleDurations || [5, 9, 18, 30],
    },
    buzzedPlayer: room.buzzState?.buzzedPlayerId
      ? {
          id: room.buzzState.buzzedPlayerId,
          name: room.buzzState.buzzedPlayerName,
        }
      : null,
    currentSongClue: room.currentSong
      ? {
          category: room.currentSong.category,
          year: room.currentSong.year,
          lang: room.currentSong.lang || (room.currentSong.category === "Western Hits" ? "en" : "id"),
          lyricsClues: (room.currentSong.lyricsClues || []).slice(0, room.clueStage || 1),
          allLyricsClues: room.currentSong.lyricsClues,
          clueStage: room.clueStage || 1,
          previewUrl: room.currentSong.previewResolved || room.currentSong.previewUrl,
          searchQuery: room.currentSong.searchQuery,
          startSecond: room.currentSong.startSecond || 0,
        }
      : null,
    revealedSong: room.status === "revealed" || room.status === "game_over" ? room.currentSong : null,
  };
}

function advanceToNextRound(room) {
  if (room.autoNextTimer) {
    clearInterval(room.autoNextTimer);
    room.autoNextTimer = null;
  }
  room.nextRoundCountdown = null;
  room.nextRoundVotes = new Set();

  if (room.currentRound >= room.maxRounds) {
    room.status = "game_over";
    broadcast(room, {
      type: "game_over",
      room: getSanitizedRoom(room),
    });
  } else {
    startRound(room);
  }
}

function triggerRoundRevealed(room, initialPayload) {
  room.status = "revealed";

  if (room.currentSong?.id && !initialPayload.isCorrect) {
    db.execute({
      sql: "UPDATE songs SET times_failed = times_failed + 1 WHERE id = ?;",
      args: [room.currentSong.id],
    }).catch(() => {});
  }
  if (room.stageTimer) {
    clearInterval(room.stageTimer);
    room.stageTimer = null;
  }
  if (room.buzzState?.buzzTimer) {
    clearTimeout(room.buzzState.buzzTimer);
    room.buzzState.buzzTimer = null;
  }
  if (room.autoNextTimer) {
    clearInterval(room.autoNextTimer);
    room.autoNextTimer = null;
  }

  room.nextRoundCountdown = 5;
  room.nextRoundVotes = new Set();

  broadcast(room, {
    ...initialPayload,
    room: getSanitizedRoom(room),
  });

  // 5-second auto countdown to advance
  room.autoNextTimer = setInterval(() => {
    room.nextRoundCountdown = (room.nextRoundCountdown !== undefined ? room.nextRoundCountdown : 5) - 1;
    if (room.nextRoundCountdown <= 0) {
      clearInterval(room.autoNextTimer);
      room.autoNextTimer = null;
      advanceToNextRound(room);
    } else {
      broadcast(room, {
        type: "next_round_tick",
        countdown: room.nextRoundCountdown,
        room: getSanitizedRoom(room),
      });
    }
  }, 1000);
}

async function startRound(room) {
  // Load dynamic server configuration from SQLite!
  const settings = await getSettingsFromDb();
  room.clueExtensionIntervalSeconds = Number(settings.clueExtensionIntervalSeconds) || 10;
  room.finalStageSeconds = Number(settings.finalStageSeconds) || 15;
  room.buzzerTimerSeconds = Number(settings.buzzerTimerSeconds) || 15;
  room.playerLivesPerRound = Number(settings.playerLivesPerRound) || 3;
  room.heardleDurations = Array.isArray(settings.heardleDurations) ? settings.heardleDurations : [5, 9, 18, 30];

  room.currentRound += 1;
  room.status = "playing";
  room.skipVotes = new Set();
  room.clueVotes = new Set();
  room.nextRoundVotes = new Set();
  room.nextRoundCountdown = null;
  room.clueStage = 1;
  room.clueSecondsLeft = room.clueExtensionIntervalSeconds;
  room.buzzCooldowns = {};

  if (room.autoNextTimer) {
    clearInterval(room.autoNextTimer);
    room.autoNextTimer = null;
  }
  if (room.stageTimer) {
    clearInterval(room.stageTimer);
    room.stageTimer = null;
  }

  const playerLives = {};
  for (const p of room.players) {
    playerLives[p.id] = room.playerLivesPerRound;
  }
  room.buzzState = {
    buzzedPlayerId: null,
    buzzedPlayerName: null,
    buzzTimer: null,
    lockedOutPlayerIds: [],
    playerLives,
  };

  // Stage timer: respects dynamic server settings!
  room.stageTimer = setInterval(() => {
    if (room.status === "playing") {
      room.clueSecondsLeft -= 1;

      if (room.clueSecondsLeft <= 0) {
        if (room.clueStage === 1) {
          room.clueStage = 2;
          room.clueSecondsLeft = room.clueExtensionIntervalSeconds;
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 2,
            secondsLeft: room.clueSecondsLeft,
            message: "💡 Tahap 2: Clue diperpanjang!",
            room: getSanitizedRoom(room),
          });
        } else if (room.clueStage === 2) {
          room.clueStage = 3;
          room.clueSecondsLeft = room.clueExtensionIntervalSeconds;
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 3,
            secondsLeft: room.clueSecondsLeft,
            message: "💡 Tahap 3: Clue dibuka lebih lengkap!",
            room: getSanitizedRoom(room),
          });
        } else if (room.clueStage === 3) {
          room.clueStage = 4;
          room.clueSecondsLeft = room.finalStageSeconds;
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 4,
            secondsLeft: room.clueSecondsLeft,
            message: `🚨 Tahap Terakhir (${room.clueSecondsLeft}s)! Segera Buzz sebelum hangus!`,
            room: getSanitizedRoom(room),
          });
        } else if (room.clueStage === 4) {
          // Waktu ronde habis -> Ronde Hangus!
          triggerRoundRevealed(room, {
            type: "round_revealed",
            message: `Waktu habis (45 detik)! Tidak ada yang berhasil menjawab. Ronde ini hangus! Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
          });
        }
      }
    }
  }, 1000);

  // Pick next song from pre-rolled match queue (zero lag, 100% distinct, zero duplicates!)
  let chosenSong = null;
  if (room.matchQueue && room.matchQueue[room.currentRound - 1]) {
    chosenSong = room.matchQueue[room.currentRound - 1];
  } else {
    chosenSong = await getRandomSong(room.category, room.difficulty, room.mode);
  }

  // Ensure TTS has valid real lyrics (never dummy text)
  if (room.mode === "tts" && (!chosenSong.lyricsClues || chosenSong.lyricsClues.length < 2)) {
    let lyrics = await resolveLyrics(chosenSong);
    if (lyrics && lyrics.length > 0) {
      chosenSong.lyricsClues = lyrics;
    } else {
      // Fallback to guaranteed lyrics song
      const safeSong = await getRandomSong(room.category, room.difficulty, "tts");
      if (safeSong?.lyricsClues?.length >= 2) {
        chosenSong = safeSong;
      }
    }
  }

  chosenSong.lang = chosenSong.category === "Western Hits" ? "en" : "id";

  // Resolve preview URL in background or cache
  const preview = await resolvePreviewUrl(chosenSong);
  chosenSong.previewResolved = preview || chosenSong.previewUrl;

  room.currentSong = chosenSong;

  if (chosenSong?.id) {
    db.execute({
      sql: "UPDATE songs SET times_played = times_played + 1 WHERE id = ?;",
      args: [chosenSong.id],
    }).catch(() => {});
  }

  broadcast(room, {
    type: "round_started",
    autoPlay: true,
    room: getSanitizedRoom(room),
  });
}

function handleBuzzTimeout(room) {
  if (!room.buzzState.buzzedPlayerId) return;

  const penaltyPlayerId = room.buzzState.buzzedPlayerId;
  const penaltyPlayerName = room.buzzState.buzzedPlayerName;

  const penaltyPlayer = room.players.find((p) => p.id === penaltyPlayerId);
  if (penaltyPlayer) penaltyPlayer.streak = 0;

  if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
  const currentLives =
    room.buzzState.playerLives[penaltyPlayerId] !== undefined
      ? room.buzzState.playerLives[penaltyPlayerId]
      : 3;
  const newLives = Math.max(0, currentLives - 1);
  room.buzzState.playerLives[penaltyPlayerId] = newLives;

  if (!room.buzzCooldowns) room.buzzCooldowns = {};
  if (newLives > 0) {
    room.buzzCooldowns[penaltyPlayerId] = Date.now() + 5000; // 5-second penalty
  }

  if (newLives <= 0 && !room.buzzState.lockedOutPlayerIds.includes(penaltyPlayerId)) {
    room.buzzState.lockedOutPlayerIds.push(penaltyPlayerId);
  }

  room.buzzState.buzzedPlayerId = null;
  room.buzzState.buzzedPlayerName = null;
  if (room.buzzState.buzzTimer) {
    clearTimeout(room.buzzState.buzzTimer);
    room.buzzState.buzzTimer = null;
  }

  // Check if ALL active players have exhausted all 3 lives
  const allOut =
    room.players.length > 0 &&
    room.players.every((p) => (room.buzzState.playerLives[p.id] || 0) <= 0);

  if (allOut) {
    // Round over, reveal song (Hangus!)
    triggerRoundRevealed(room, {
      type: "round_revealed",
      message: `Semua pemain kehabisan nyawa! Ronde ini hangus. Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
    });
  } else {
    // Resume buzzer for anyone who still has lives!
    room.status = "playing";
    const msg =
      newLives > 0
        ? `Waktu ${penaltyPlayerName} habis! Sisa nyawa ${penaltyPlayerName}: ${newLives}/3. Buzzer terbuka kembali!`
        : `Waktu ${penaltyPlayerName} habis dan nyawanya habis (0/3)! Pemain lain silakan memencet Buzzer!`;
    broadcast(room, {
      type: "buzz_resumed",
      resumeAudio: true,
      message: msg,
      room: getSanitizedRoom(room),
    });
  }
}

// -------------------------------------------------------------
// SERVER INIT
// -------------------------------------------------------------
app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error occurred handling", req.url, err);
      res.statusCode = 500;
      res.end("internal server error");
    }
  });

  io = new Server(server, {
    path: "/socket.io",
    cors: { origin: "*" },
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000,
      skipMiddlewares: true,
    },
    pingInterval: 10000,
    pingTimeout: 5000,
    transports: ["websocket", "polling"],
  });

  io.on("connection", (socket) => {
    let playerId = "p_" + Math.random().toString(36).substring(2, 9);
    clientMeta.set(socket, { id: playerId, roomCode: null, name: "" });

    const handleEvent = async (type, rawData = {}) => {
      try {
        const data = typeof rawData === "string" ? JSON.parse(rawData) : (rawData || {});
        const meta = clientMeta.get(socket) || { id: playerId, roomCode: null, name: "" };
        data.type = type || data.type;

        // 1. CREATE ROOM
        if (data.type === "create_room") {
          const roomCode = generateRoomCode();
          const player = {
            id: playerId,
            name: data.playerName || "Player 1",
            avatar: data.avatar || "👑",
            score: 0,
            isReady: true,
            socket, socketId: socket.id, ws: socket,
          };

          const room = {
            code: roomCode,
            hostId: playerId,
            mode: data.mode || "heardle",
            category: data.category || "Semua Genre",
            difficulty: data.difficulty || "easy",
            audioProfile: data.audioProfile || "normal",
            maxRounds: data.maxRounds || 5,
            currentRound: 0,
            status: "lobby",
            players: [player],
            currentSong: null,
            buzzState: {
              buzzedPlayerId: null,
              buzzedPlayerName: null,
              buzzTimer: null,
              lockedOutPlayerIds: [],
            },
          };

          rooms.set(roomCode, room);
          meta.roomCode = roomCode;
          meta.name = player.name;
          socket.join(roomCode);

          sendTo(socket, 
            JSON.stringify({
              type: "room_created",
              roomCode,
              playerId,
              room: getSanitizedRoom(room),
            })
          );
        }

        // 2. JOIN ROOM
        else if (data.type === "join_room") {
          const code = (data.roomCode || "").toUpperCase().trim();
          const room = rooms.get(code);

          if (!room) {
            sendTo(socket, {
                type: "error",
                message: `Room code "${code}" tidak ditemukan!`,
              });
            return;
          }

          // Check if player is rejoining an existing slot (e.g. after refresh or disconnect)
          const existingPlayer = room.players.find(
            (p) => (data.playerId && p.id === data.playerId) ||
                   (data.playerName && p.name.trim().toLowerCase() === data.playerName.trim().toLowerCase())
          );

          if (existingPlayer) {
            if (existingPlayer.disconnectTimeout) {
              clearTimeout(existingPlayer.disconnectTimeout);
              existingPlayer.disconnectTimeout = null;
            }
            existingPlayer.isDisconnected = false;
            existingPlayer.socket = socket; existingPlayer.socketId = socket.id; existingPlayer.ws = socket;
            playerId = existingPlayer.id;
            meta.id = existingPlayer.id;
            meta.roomCode = code;
            meta.name = existingPlayer.name;
            socket.join(code);

            if (!room.buzzState) room.buzzState = { playerLives: {} };
            if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
            if (room.buzzState.playerLives[existingPlayer.id] === undefined) {
              room.buzzState.playerLives[existingPlayer.id] = 3;
            }
            if (room.buzzState.lockedOutPlayerIds && room.buzzState.playerLives[existingPlayer.id] > 0) {
              room.buzzState.lockedOutPlayerIds = room.buzzState.lockedOutPlayerIds.filter(id => id !== existingPlayer.id);
            }

            sendTo(socket, {
                type: "room_joined",
                roomCode: code,
                playerId: existingPlayer.id,
                room: getSanitizedRoom(room),
              });

            broadcast(
              room,
              {
                type: "player_connection_change",
                playerId: existingPlayer.id,
                playerName: existingPlayer.name,
                isConnected: true,
                message: `${existingPlayer.name} kembali ke room! ⚡`,
                room: getSanitizedRoom(room),
              },
              socket
            );
            return;
          }

          if (room.players.length >= 8) {
            sendTo(socket, {
                type: "error",
                message: `Room "${code}" sudah penuh (maksimal 8 pemain)!`,
              });
            return;
          }

          const isMidGame = room.status !== "lobby";
          const player = {
            id: playerId,
            name: data.playerName || `Pemain ${room.players.length + 1}`,
            avatar: data.avatar || "🎧",
            score: 0,
            isReady: isMidGame ? true : false,
            socket, socketId: socket.id, ws: socket,
          };

          room.players.push(player);
          if (room.buzzState) {
            if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
            room.buzzState.playerLives[playerId] = 3;
          }

          meta.roomCode = code;
          meta.name = player.name;
          socket.join(code);

          sendTo(socket, 
            JSON.stringify({
              type: "room_joined",
              roomCode: code,
              playerId,
              room: getSanitizedRoom(room),
            })
          );

          broadcast(
            room,
            {
              type: "player_joined",
              player: {
                id: player.id,
                name: player.name,
                avatar: player.avatar,
                score: player.score,
                isReady: player.isReady,
                isHost: false,
                lives: 3,
              },
              room: getSanitizedRoom(room),
            },
            socket
          );
        }

        // 3. TOGGLE READY
        else if (data.type === "toggle_ready") {
          const room = rooms.get(meta.roomCode);
          if (!room) return;

          const player = room.players.find((p) => p.id === playerId);
          if (player) {
            player.isReady = !player.isReady;
            broadcast(room, {
              type: "room_updated",
              room: getSanitizedRoom(room),
            });
          }
        }

        // 4. START GAME (Host Only)
        else if (data.type === "start_game") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.hostId !== playerId) return;

          // If game was over or replaying, reset scores and round counter!
          room.currentRound = 0;
          for (const p of room.players) {
            p.score = 0;
          }

          // Pre-roll distinct songs queue for the entire match (100% unique, zero duplicates!)
          try {
            const queue = await getMatchSongsQueue(room.category, room.difficulty, room.maxRounds || 5, room.mode);
            room.matchQueue = queue;

            // Pre-resolve lyrics for TTS mode in background
            if (room.mode === "tts") {
              for (let i = 0; i < room.matchQueue.length; i++) {
                const s = room.matchQueue[i];
                let lyrics = await resolveLyrics(s);
                if (lyrics && lyrics.length >= 2) {
                  s.lyricsClues = lyrics;
                }
              }
            }
          } catch (e) {
            console.error("Error pre-rolling match songs:", e);
          }

          startRound(room);
        }

        // 5. BUZZ IN! (Siapa cepat dia dapat)
        else if (data.type === "buzz") {
          const roomCode = (data.roomCode || meta.roomCode || "").toUpperCase().trim();
          const room = rooms.get(roomCode);
          if (!room || room.status !== "playing") return;

          // Determine the player accurately across reconnections
          const callerId = data.playerId || meta.id || playerId;
          let player = room.players.find((p) => p.id === callerId || p.socket === socket || p.socketId === socket.id);
          if (!player && data.playerName) {
            player = room.players.find((p) => p.name.trim().toLowerCase() === data.playerName.trim().toLowerCase());
          }
          if (!player) return;

          // Ensure player socket and status are active
          player.socket = socket; player.socketId = socket.id; player.ws = socket;
          player.isDisconnected = false;
          meta.roomCode = room.code;
          meta.id = player.id;
          playerId = player.id;

          // Check if this player is in penalty cooldown
          if (room.buzzCooldowns && room.buzzCooldowns[player.id] && room.buzzCooldowns[player.id] > Date.now()) {
            const secLeft = Math.ceil((room.buzzCooldowns[player.id] - Date.now()) / 1000);
            sendTo(socket, {
                type: "buzz_rejected",
                message: `Kamu terkena penalti cooldown (${secLeft}s)! Beri kesempatan pemain lain.`,
              });
            return;
          }

          // Check if this player has lives remaining in this round
          if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
          if (room.buzzState.playerLives[player.id] === undefined) {
            room.buzzState.playerLives[player.id] = 3;
          }

          if (room.buzzState.playerLives[player.id] <= 0) {
            sendTo(socket, {
                type: "buzz_rejected",
                message: "Nyawa tebakanmu sudah habis di ronde ini (0/3)!",
              });
            return;
          }

          // Ensure player is un-lockedout if lives > 0
          if (room.buzzState.lockedOutPlayerIds && room.buzzState.playerLives[player.id] > 0) {
            room.buzzState.lockedOutPlayerIds = room.buzzState.lockedOutPlayerIds.filter(id => id !== player.id);
          }

          // Lockout others!
          room.status = "buzzed";
          room.buzzState.buzzedPlayerId = player.id;
          room.buzzState.buzzedPlayerName = player.name;

          // Start guess countdown based on server settings
          const allowedSec = room.buzzerTimerSeconds || 15;
          if (room.buzzState.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
          room.buzzState.buzzTimer = setTimeout(() => {
            handleBuzzTimeout(room);
          }, allowedSec * 1000);

          broadcast(room, {
            type: "player_buzzed",
            buzzedPlayerId: player.id,
            buzzedPlayerName: player.name,
            secondsAllowed: allowedSec,
            room: getSanitizedRoom(room),
          });
        }

        // 6. SUBMIT GUESS
        else if (data.type === "submit_guess") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "buzzed" || room.buzzState.buzzedPlayerId !== playerId) return;

          if (room.buzzState.buzzTimer) {
            clearTimeout(room.buzzState.buzzTimer);
            room.buzzState.buzzTimer = null;
          }

          const player = room.players.find((p) => p.id === playerId);
          const cleanStr = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "").trim();

          const guessTitle = cleanStr(data.title);
          const guessArtist = cleanStr(data.artist);
          const targetTitle = cleanStr(room.currentSong?.title);
          const targetArtist = cleanStr(room.currentSong?.artist);

          const isMatch =
            (guessTitle && targetTitle && (guessTitle.includes(targetTitle) || targetTitle.includes(guessTitle))) ||
            (guessTitle && targetArtist && guessTitle.includes(targetArtist) && targetTitle.length < 5);

          if (isMatch) {
            // Dynamic Scoring Engine:
            // Base points: Stage 1 = 500 | Stage 2 = 350 | Stage 3 = 200 | Stage 4 = 100
            const stagePointsMap = { 1: 500, 2: 350, 3: 200, 4: 100 };
            const basePoints = stagePointsMap[room.clueStage || 1] || 250;

            // Speed bonus: up to 150 points based on fast buzz reaction
            const speedBonus = Math.max(20, Math.min(150, Math.round(((room.clueSecondsLeft || 10) / 10) * 150)));

            // Streak multiplier: 2 in a row = 1.2x | 3+ in a row = 1.5x
            if (!player.streak) player.streak = 0;
            player.streak += 1;
            const multiplier = player.streak >= 3 ? 1.5 : player.streak === 2 ? 1.2 : 1.0;

            const totalPoints = Math.round((basePoints + speedBonus) * multiplier);
            player.score += totalPoints;

            if (room.currentSong?.id) {
              db.execute({
                sql: "UPDATE songs SET times_guessed = times_guessed + 1 WHERE id = ?;",
                args: [room.currentSong.id],
              }).catch(() => {});
            }

            triggerRoundRevealed(room, {
              type: "guess_result",
              isCorrect: true,
              guesserName: player.name,
              guesserId: player.id,
              pointsGained: totalPoints,
              basePoints,
              speedBonus,
              streak: player.streak,
              clueStage: room.clueStage,
            });
          } else {
            // Wrong Guess! Deduct 1 life & reset streak
            player.streak = 0;
            if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
            const currentLives =
              room.buzzState.playerLives[playerId] !== undefined
                ? room.buzzState.playerLives[playerId]
                : 3;
            const newLives = Math.max(0, currentLives - 1);
            room.buzzState.playerLives[playerId] = newLives;

            if (!room.buzzCooldowns) room.buzzCooldowns = {};
            if (newLives > 0) {
              room.buzzCooldowns[playerId] = Date.now() + 5000; // 5-second penalty
            }

            if (newLives <= 0 && !room.buzzState.lockedOutPlayerIds.includes(playerId)) {
              room.buzzState.lockedOutPlayerIds.push(playerId);
            }

            room.buzzState.buzzedPlayerId = null;
            room.buzzState.buzzedPlayerName = null;

            // Check if all players have exhausted all 3 lives
            const allOut =
              room.players.length > 0 &&
              room.players.every((p) => (room.buzzState.playerLives[p.id] || 0) <= 0);

            if (allOut) {
              // Hangus!
              triggerRoundRevealed(room, {
                type: "guess_result",
                isCorrect: false,
                guesserName: player.name,
                message: `Tebakan ${player.name} salah dan semua pemain kehabisan nyawa! Ronde ini hangus. Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
              });
            } else {
              // Reopen buzzer!
              room.status = "playing";
              const msg =
                newLives > 0
                  ? `Tebakan ${player.name} belum tepat! Sisa nyawa ${player.name}: ${newLives}/3. Buzzer terbuka kembali!`
                  : `Tebakan ${player.name} belum tepat dan nyawanya habis (0/3)! Pemain lain silakan Buzzer!`;
              broadcast(room, {
                type: "guess_result",
                isCorrect: false,
                guesserName: player.name,
                resumeAudio: true,
                message: msg,
                room: getSanitizedRoom(room),
              });
            }
          }
        }

        // 7. NEXT ROUND (Vote or Host fast-forward)
        else if (data.type === "next_round") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "revealed") return;

          if (!room.nextRoundVotes) room.nextRoundVotes = new Set();
          room.nextRoundVotes.add(playerId);

          const activePlayers = room.players.filter((p) => !p.isDisconnected);
          const totalRequired = Math.max(1, activePlayers.length);

          // If Host clicks OR all active players voted, advance immediately!
          if (room.hostId === playerId || room.nextRoundVotes.size >= totalRequired) {
            advanceToNextRound(room);
          } else {
            broadcast(room, {
              type: "next_round_vote_updated",
              votesCount: room.nextRoundVotes.size,
              totalRequired,
              room: getSanitizedRoom(room),
            });
          }
        }

        // 8. LIVE REACTION EMOJI (Float on screen)
        else if (data.type === "reaction") {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          broadcast(room, {
            type: "player_reaction",
            playerId,
            playerName: meta.name,
            emoji: data.emoji || "🔥",
          });
        }

        // 8.5. LIVE SFX SOUNDBOARD REACTION (Airhorn, Drumroll, Laugh, Zonk, Applause)
        else if (data.type === "trigger_sfx") {
          const room = rooms.get(meta.roomCode);
          if (!room) return;
          broadcast(room, {
            type: "room_sfx",
            playerId,
            playerName: meta.name,
            sfxId: data.sfxId,
          });
        }

        // 8.6. SYNCHRONIZED ROOM AUDIO (HANYA HOST YANG DAPAT MENGONTROL MANUAL!)
        else if (data.type === "toggle_room_audio") {
          const room = rooms.get(meta.roomCode);
          if (!room || (room.status !== "playing" && room.status !== "buzzed")) return;
          if (room.hostId !== playerId) {
            sendTo(socket, { type: "error", message: "Hanya Host room yang dapat mengontrol audio secara manual!" });
            return;
          }
          broadcast(room, {
            type: "room_audio_sync",
            action: data.action || "play",
            senderId: playerId,
            senderName: meta.name,
          });
        }

        // 9. VOTE SKIP ROUND (Seluruh player harus vote skip agar ronde diskip)
        else if (data.type === "skip_round" || data.type === "vote_skip") {
          const room = rooms.get(meta.roomCode);
          if (!room || (room.status !== "playing" && room.status !== "buzzed")) return;

          if (!room.skipVotes) room.skipVotes = new Set();

          // Toggle vote
          if (room.skipVotes.has(playerId)) {
            room.skipVotes.delete(playerId);
          } else {
            room.skipVotes.add(playerId);
          }

          const activePlayers = room.players.filter((p) => !p.isDisconnected);
          const totalRequired = Math.max(1, activePlayers.length);
          const currentVotes = room.skipVotes.size;

          if (currentVotes >= totalRequired) {
            // Semua player setuju skip!
            triggerRoundRevealed(room, {
              type: "round_revealed",
              message: `Semua pemain (${currentVotes}/${totalRequired}) setuju skip! Ronde dilewati. Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
            });
          } else {
            broadcast(room, {
              type: "skip_vote_updated",
              votesCount: currentVotes,
              totalRequired,
              voters: Array.from(room.skipVotes),
              message: `${meta.name} vote lewati ronde (${currentVotes}/${totalRequired} setuju)`,
              room: getSanitizedRoom(room),
            });
          }
        }

        // 10. FORFEIT BUZZ (Pemain yang buzz klik 'Nyerah' tanpa nunggu 20s)
        else if (data.type === "forfeit_buzz") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "buzzed" || room.buzzState.buzzedPlayerId !== playerId) return;
          handleBuzzTimeout(room);
        }

        // 10b. VOTE ADVANCE CLUE (Buka clue selanjutnya tanpa nunggu)
        else if (data.type === "vote_advance_clue" || data.type === "advance_clue") {
          const roomCode = (data.roomCode || meta.roomCode || "").toUpperCase().trim();
          const room = rooms.get(roomCode);
          if (!room || (room.status !== "playing" && room.status !== "buzzed")) return;
          if (room.clueStage >= 4) return; // Sudah tahap maksimal

          const voterId = data.playerId || meta.id || playerId;

          if (!room.clueVotes) room.clueVotes = new Set();
          if (room.clueVotes.has(voterId)) {
            room.clueVotes.delete(voterId);
          } else {
            room.clueVotes.add(voterId);
          }

          const activePlayers = room.players.filter((p) => !p.isDisconnected);
          const totalActive = Math.max(1, activePlayers.length);

          // Rule Zidane:
          // Jika 1 atau 2 pemain: butuh 100% persetujuan (keduanya harus vote!)
          // Jika lebih dari 2 pemain: baru pakai mekanisme mayoritas (> 50%)
          const threshold = totalActive <= 2
            ? totalActive
            : Math.floor(totalActive / 2) + 1;

          if (room.clueVotes.size >= threshold) {
            room.clueVotes = new Set();
            room.clueStage += 1;
            room.clueSecondsLeft = room.clueStage === 4 ? (room.finalStageSeconds || 15) : (room.clueExtensionIntervalSeconds || 10);

            broadcast(room, {
              type: "clue_extended",
              stage: room.clueStage,
              secondsLeft: room.clueSecondsLeft,
              message: `💡 Clue tahap ${room.clueStage}/4 dibuka!`,
              room: getSanitizedRoom(room),
            });
          } else {
            broadcast(room, {
              type: "clue_vote_updated",
              votesCount: room.clueVotes.size,
              totalRequired: threshold,
              message: `${meta.name || "Pemain"} vote buka clue (${room.clueVotes.size}/${threshold})`,
              room: getSanitizedRoom(room),
            });
          }
        }

        // 11. RECONNECT SESSION (Saat HP unlock / switch tab kembali)
        else if (data.type === "reconnect") {
          const code = (data.roomCode || meta.roomCode || "").toUpperCase().trim();
          const room = rooms.get(code);

          if (room) {
            let player = room.players.find((p) => p.id === data.playerId);
            if (!player && data.playerName) {
              player = room.players.find((p) => p.name.trim().toLowerCase() === data.playerName.trim().toLowerCase());
            }

            if (player) {
              if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
              }
              player.isDisconnected = false;
              player.socket = socket; player.socketId = socket.id; player.ws = socket;
              playerId = player.id; // UPDATE CLOSURE ID
              meta.id = player.id;
              meta.roomCode = code;
              meta.name = player.name;
              socket.join(code);

              // Ensure player lives are properly initialized and never undefined
              if (!room.buzzState) room.buzzState = { playerLives: {} };
              if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
              if (room.buzzState.playerLives[player.id] === undefined) {
                room.buzzState.playerLives[player.id] = 3;
              }
              // Un-lockout player on reconnect if they still have lives
              if (room.buzzState.lockedOutPlayerIds && room.buzzState.playerLives[player.id] > 0) {
                room.buzzState.lockedOutPlayerIds = room.buzzState.lockedOutPlayerIds.filter(id => id !== player.id);
              }
              // Clear penalty cooldown on reconnect if expired
              if (room.buzzCooldowns && room.buzzCooldowns[player.id] && room.buzzCooldowns[player.id] <= Date.now()) {
                delete room.buzzCooldowns[player.id];
              }

              sendTo(socket, {
                  type: "reconnected",
                  roomCode: code,
                  playerId: player.id,
                  room: getSanitizedRoom(room),
                });

              broadcast(
                room,
                {
                  type: "player_connection_change",
                  playerId: player.id,
                  playerName: player.name,
                  isConnected: true,
                  message: `${player.name} kembali online! ⚡`,
                  room: getSanitizedRoom(room),
                },
                socket
              );
              return;
            }
          }

          sendTo(socket, { type: "reconnect_failed" });
        }

        // 11b. SYNC CURRENT ROOM STATE (Tab focus / phone unlock resync)
        else if (data.type === "sync_state") {
          const code = (data.roomCode || meta.roomCode || "").toUpperCase().trim();
          const room = rooms.get(code);
          if (room) {
            sendTo(socket, {
                type: "state_synced",
                room: getSanitizedRoom(room),
              });
          }
        }

        // 12. LEAVE ROOM (Pemain keluar secara sadar / klik tombol Exit)
        else if (data.type === "leave_room") {
          const roomCode = meta.roomCode;
          if (!roomCode) return;
          const room = rooms.get(roomCode);
          if (room) {
            const player = room.players.find((p) => p.id === playerId);
            if (player && player.disconnectTimeout) {
              clearTimeout(player.disconnectTimeout);
              player.disconnectTimeout = null;
            }

            // If player was buzzing, release buzzer
            if (room.buzzState?.buzzedPlayerId === playerId) {
              handleBuzzTimeout(room);
            }

            // Remove player from room
            room.players = room.players.filter((p) => p.id !== playerId);
            if (room.buzzState?.playerLives) {
              delete room.buzzState.playerLives[playerId];
            }
            if (room.skipVotes) {
              room.skipVotes.delete(playerId);
            }

            if (room.players.length === 0) {
              if (room.buzzState?.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
              if (room.stageTimer) clearInterval(room.stageTimer);
              if (room.autoNextTimer) clearInterval(room.autoNextTimer);
              rooms.delete(roomCode);
            } else {
              if (room.hostId === playerId) {
                room.hostId = room.players[0].id;
              }
              broadcast(room, {
                type: "player_left",
                playerName: meta.name || "Seorang pemain",
                message: `${meta.name || "Pemain"} telah keluar dari room.`,
                room: getSanitizedRoom(room),
              });
            }
          }

          if (meta.roomCode) socket.leave(meta.roomCode);
          meta.roomCode = null;
          sendTo(socket, { type: "left_room_success" });
        }
      } catch (err) {
        console.error("Socket.IO Event Error:", err);
      }
    };

    socket.onAny(async (eventName, eventData) => {
      await handleEvent(eventName, eventData);
    });

    socket.on("disconnect", (reason) => {
      const meta = clientMeta.get(socket);
      if (meta && meta.roomCode) {
        const room = rooms.get(meta.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === playerId || p.socket === socket || p.socketId === socket.id);
          if (player) {
            player.isDisconnected = true;
            player.socket = null;

            // If this player was holding the buzzer when disconnected, release it immediately!
            if (room.buzzState?.buzzedPlayerId === player.id) {
              handleBuzzTimeout(room);
            }

            broadcast(room, {
              type: "player_connection_change",
              playerId: player.id,
              playerName: player.name,
              isConnected: false,
              room: getSanitizedRoom(room),
            });

            // 45-second grace period for mobile app-switching / screen-locking
            player.disconnectTimeout = setTimeout(() => {
              if (player.isDisconnected) {
                room.players = room.players.filter((p) => p.id !== playerId);
                if (room.buzzState?.playerLives) {
                  delete room.buzzState.playerLives[playerId];
                }
                if (room.skipVotes) {
                  room.skipVotes.delete(playerId);
                }

                if (room.players.length === 0) {
                  if (room.buzzState?.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
                  if (room.stageTimer) clearInterval(room.stageTimer);
                  if (room.autoNextTimer) clearInterval(room.autoNextTimer);
                  rooms.delete(meta.roomCode);
                } else {
                  if (room.hostId === playerId) {
                    room.hostId = room.players[0].id;
                  }
                  broadcast(room, {
                    type: "player_left",
                    playerName: meta.name,
                    room: getSanitizedRoom(room),
                  });
                }
              }
            }, 45000);
          }
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Tebak Lagu Multiplayer Server ready on http://${hostname}:${port}`);
  });
});
