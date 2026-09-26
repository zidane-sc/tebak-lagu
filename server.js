const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// Database connection (LibSQL / SQLite persistent engine)
const { db, initDb, getRandomSong, getMatchSongsQueue, getCatalogStats } = require("./src/lib/db-server.js");
initDb().then(async () => {
  const stats = await getCatalogStats();
  console.log(`> Database Connected: ${stats.total} persistent songs ready in SQLite.`);
}).catch((err) => {
  console.error("> Database init error:", err);
});

// -------------------------------------------------------------
// MULTIPLAYER ROOM STATE MANAGER
// -------------------------------------------------------------
const rooms = new Map(); // roomCode -> RoomState
const clientMeta = new WeakMap(); // ws -> { id, roomCode, name }

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

function broadcast(room, payload, excludeWs = null) {
  const msg = JSON.stringify(payload);
  for (const player of room.players) {
    if (player.ws && player.ws.readyState === WebSocket.OPEN && player.ws !== excludeWs) {
      player.ws.send(msg);
    }
  }
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
    clueSecondsLeft: room.clueSecondsLeft !== undefined ? room.clueSecondsLeft : 30,
    skipVotes: room.skipVotes ? Array.from(room.skipVotes) : [],
    clueVotes: room.clueVotes ? Array.from(room.clueVotes) : [],
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
    })),
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
  room.currentRound += 1;
  room.status = "playing";
  room.skipVotes = new Set();
  room.clueVotes = new Set();
  room.nextRoundVotes = new Set();
  room.nextRoundCountdown = null;
  room.clueStage = 1;
  room.clueSecondsLeft = 10; // Snappy 10s per stage!
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
    playerLives[p.id] = 3; // 3 lives per round per player
  }
  room.buzzState = {
    buzzedPlayerId: null,
    buzzedPlayerName: null,
    buzzTimer: null,
    lockedOutPlayerIds: [],
    playerLives,
  };

  // Stage timer: 10s (Tahap 1) -> 10s (Tahap 2) -> 10s (Tahap 3) -> 15s (Tahap 4) -> Hangus! (~45 detik total)
  room.stageTimer = setInterval(() => {
    if (room.status === "playing") {
      room.clueSecondsLeft -= 1;

      if (room.clueSecondsLeft <= 0) {
        if (room.clueStage === 1) {
          room.clueStage = 2;
          room.clueSecondsLeft = 10;
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 2,
            secondsLeft: 10,
            message: "💡 Tahap 2: Clue diperpanjang!",
            room: getSanitizedRoom(room),
          });
        } else if (room.clueStage === 2) {
          room.clueStage = 3;
          room.clueSecondsLeft = 10;
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 3,
            secondsLeft: 10,
            message: "💡 Tahap 3: Clue dibuka lebih lengkap!",
            room: getSanitizedRoom(room),
          });
        } else if (room.clueStage === 3) {
          room.clueStage = 4;
          room.clueSecondsLeft = 15; // Tahap terakhir 15 detik!
          room.clueVotes = new Set();
          broadcast(room, {
            type: "clue_extended",
            stage: 4,
            secondsLeft: 15,
            message: "🚨 Tahap Terakhir (15s)! Segera Buzz sebelum hangus!",
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

  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === "/ws") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    ws.isAlive = true;
    ws.on("pong", () => {
      ws.isAlive = true;
    });

    let playerId = "p_" + Math.random().toString(36).substring(2, 9);
    clientMeta.set(ws, { id: playerId, roomCode: null, name: "" });

    ws.on("message", async (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const meta = clientMeta.get(ws);

        if (data.type === "pong") {
          ws.isAlive = true;
          return;
        }
        if (data.type === "ping") {
          ws.isAlive = true;
          try {
            ws.send(JSON.stringify({ type: "pong" }));
          } catch (e) {}
          return;
        }

        // 1. CREATE ROOM
        if (data.type === "create_room") {
          const roomCode = generateRoomCode();
          const player = {
            id: playerId,
            name: data.playerName || "Player 1",
            avatar: data.avatar || "👑",
            score: 0,
            isReady: true,
            ws,
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

          ws.send(
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
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Room code "${code}" tidak ditemukan!`,
              })
            );
            return;
          }

          if (room.players.length >= 8) {
            ws.send(
              JSON.stringify({
                type: "error",
                message: `Room "${code}" sudah penuh (maksimal 8 pemain)!`,
              })
            );
            return;
          }

          const isMidGame = room.status !== "lobby";
          const player = {
            id: playerId,
            name: data.playerName || `Pemain ${room.players.length + 1}`,
            avatar: data.avatar || "🎧",
            score: 0,
            isReady: isMidGame ? true : false,
            ws,
          };

          room.players.push(player);
          if (room.buzzState) {
            if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
            room.buzzState.playerLives[playerId] = 3;
          }

          meta.roomCode = code;
          meta.name = player.name;

          ws.send(
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
            ws
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
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "playing") return;

          // Check if this player is in penalty cooldown
          if (room.buzzCooldowns && room.buzzCooldowns[playerId] && room.buzzCooldowns[playerId] > Date.now()) {
            const secLeft = Math.ceil((room.buzzCooldowns[playerId] - Date.now()) / 1000);
            ws.send(
              JSON.stringify({
                type: "buzz_rejected",
                message: `Kamu terkena penalti cooldown (${secLeft}s)! Beri kesempatan pemain lain.`,
              })
            );
            return;
          }

          // Check if this player has lives remaining in this round
          if (!room.buzzState.playerLives) room.buzzState.playerLives = {};
          if (room.buzzState.playerLives[playerId] === undefined) {
            room.buzzState.playerLives[playerId] = 3;
          }

          if (room.buzzState.playerLives[playerId] <= 0) {
            ws.send(
              JSON.stringify({
                type: "buzz_rejected",
                message: "Nyawa tebakanmu sudah habis di ronde ini (0/3)!",
              })
            );
            return;
          }

          const player = room.players.find((p) => p.id === playerId);
          if (!player) return;

          // Lockout others!
          room.status = "buzzed";
          room.buzzState.buzzedPlayerId = playerId;
          room.buzzState.buzzedPlayerName = player.name;

          // Start 15-second guess countdown
          if (room.buzzState.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
          room.buzzState.buzzTimer = setTimeout(() => {
            handleBuzzTimeout(room);
          }, 15000);

          broadcast(room, {
            type: "player_buzzed",
            buzzedPlayerId: playerId,
            buzzedPlayerName: player.name,
            secondsAllowed: 15,
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
            // Correct Guess! +100 Points
            player.score += 100;

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
              pointsGained: 100,
            });
          } else {
            // Wrong Guess! Deduct 1 life
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
            ws.send(JSON.stringify({ type: "error", message: "Hanya Host room yang dapat mengontrol audio secara manual!" }));
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

        // 10b. VOTE ADVANCE CLUE (Buka clue selanjutnya tanpa nunggu 30 detik!)
        else if (data.type === "vote_advance_clue" || data.type === "advance_clue") {
          const room = rooms.get(meta.roomCode);
          if (!room || (room.status !== "playing" && room.status !== "buzzed")) return;
          if (room.clueStage >= 4) return; // Sudah tahap maksimal

          if (!room.clueVotes) room.clueVotes = new Set();
          if (room.clueVotes.has(playerId)) {
            room.clueVotes.delete(playerId);
          } else {
            room.clueVotes.add(playerId);
          }

          const activePlayers = room.players.filter((p) => !p.isDisconnected);
          const threshold = Math.max(1, Math.ceil(activePlayers.length / 2));
          const isHost = room.hostId === playerId;

          if (isHost || room.clueVotes.size >= threshold) {
            room.clueVotes = new Set();
            room.clueStage += 1;
            room.clueSecondsLeft = room.clueStage === 4 ? 90 : 30;

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
              message: `${meta.name} vote buka clue (${room.clueVotes.size}/${threshold})`,
              room: getSanitizedRoom(room),
            });
          }
        }

        // 11. RECONNECT SESSION (Saat HP unlock / switch tab kembali)
        else if (data.type === "reconnect") {
          const code = (data.roomCode || "").toUpperCase().trim();
          const room = rooms.get(code);

          if (room) {
            const player = room.players.find((p) => p.id === data.playerId);
            if (player) {
              if (player.disconnectTimeout) {
                clearTimeout(player.disconnectTimeout);
                player.disconnectTimeout = null;
              }
              player.isDisconnected = false;
              player.ws = ws;
              playerId = player.id; // UPDATE CLOSURE ID
              meta.id = player.id;
              meta.roomCode = code;
              meta.name = player.name;

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

              ws.send(
                JSON.stringify({
                  type: "reconnected",
                  roomCode: code,
                  playerId: player.id,
                  room: getSanitizedRoom(room),
                })
              );

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
                ws
              );
              return;
            }
          }

          ws.send(JSON.stringify({ type: "reconnect_failed" }));
        }

        // 11b. SYNC CURRENT ROOM STATE (Tab focus / phone unlock resync)
        else if (data.type === "sync_state") {
          const code = (data.roomCode || meta.roomCode || "").toUpperCase().trim();
          const room = rooms.get(code);
          if (room) {
            ws.send(
              JSON.stringify({
                type: "state_synced",
                room: getSanitizedRoom(room),
              })
            );
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

          meta.roomCode = null;
          ws.send(JSON.stringify({ type: "left_room_success" }));
        }
      } catch (err) {
        console.error("WS Parse Error:", err);
      }
    });

    ws.on("close", () => {
      const meta = clientMeta.get(ws);
      if (meta && meta.roomCode) {
        const room = rooms.get(meta.roomCode);
        if (room) {
          const player = room.players.find((p) => p.id === playerId);
          if (player) {
            player.isDisconnected = true;
            player.ws = null;

            broadcast(room, {
              type: "player_connection_change",
              playerId,
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

  // Heartbeat ping interval every 15s to detect dead mobile sockets
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate();
      }
      ws.isAlive = false;
      try {
        ws.ping();
        ws.send(JSON.stringify({ type: "ping" }));
      } catch (e) {}
    });
  }, 15000);

  server.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  server.listen(port, () => {
    console.log(`> Tebak Lagu Multiplayer Server ready on http://${hostname}:${port}`);
  });
});
