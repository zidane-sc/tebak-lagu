const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer, WebSocket } = require("ws");

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// In-memory catalog cache for server-authoritative song picking
let SONGS_CATALOG = [];
try {
  const fs = require("fs");
  const path = require("path");
  const songsJsonPath = path.join(__dirname, "src/data/songs.json");
  if (fs.existsSync(songsJsonPath)) {
    SONGS_CATALOG = JSON.parse(fs.readFileSync(songsJsonPath, "utf-8"));
    console.log(`> Loaded massive catalog: ${SONGS_CATALOG.length} songs ready.`);
  }
} catch (e) {
  console.log("Note: Songs catalog loaded via fallback.", e.message);
}

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

function getSanitizedRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    mode: room.mode,
    category: room.category,
    maxRounds: room.maxRounds,
    currentRound: room.currentRound,
    status: room.status,
    playerLives: room.buzzState ? (room.buzzState.playerLives || {}) : {},
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      score: p.score,
      isReady: p.isReady,
      isHost: p.id === room.hostId,
      lives:
        room.buzzState && room.buzzState.playerLives && room.buzzState.playerLives[p.id] !== undefined
          ? room.buzzState.playerLives[p.id]
          : 3,
    })),
    buzzedPlayer: room.buzzState.buzzedPlayerId
      ? {
          id: room.buzzState.buzzedPlayerId,
          name: room.buzzState.buzzedPlayerName,
        }
      : null,
    currentSongClue: room.currentSong
      ? {
          category: room.currentSong.category,
          year: room.currentSong.year,
          lyricsClues: room.currentSong.lyricsClues,
          hummingMelody: room.currentSong.hummingMelody,
          previewUrl: room.currentSong.previewResolved || room.currentSong.previewFallback,
          searchQuery: room.currentSong.searchQuery,
          startSecond: room.currentSong.startSecond || 0,
        }
      : null,
    revealedSong: room.status === "revealed" || room.status === "game_over" ? room.currentSong : null,
  };
}

async function startRound(room) {
  room.currentRound += 1;
  room.status = "playing";
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

  // Pick song matching category
  const pool =
    room.category && room.category !== "Semua Genre"
      ? SONGS_CATALOG.filter((s) => s.category === room.category)
      : SONGS_CATALOG;
  const activePool = pool.length > 0 ? pool : SONGS_CATALOG;
  const chosenSong = activePool[Math.floor(Math.random() * activePool.length)];

  // Resolve preview URL in background or cache
  const preview = await resolvePreviewUrl(chosenSong);
  chosenSong.previewResolved = preview;

  room.currentSong = chosenSong;

  broadcast(room, {
    type: "round_started",
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
    room.status = "revealed";
    broadcast(room, {
      type: "round_revealed",
      message: `Semua pemain kehabisan nyawa! Ronde ini hangus. Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
      room: getSanitizedRoom(room),
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
    const playerId = "p_" + Math.random().toString(36).substring(2, 9);
    clientMeta.set(ws, { id: playerId, roomCode: null, name: "" });

    ws.on("message", (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        const meta = clientMeta.get(ws);

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

          startRound(room);
        }

        // 5. BUZZ IN! (Siapa cepat dia dapat)
        else if (data.type === "buzz") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "playing") return;

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

          // Start 20-second guess countdown (20 DETIK)
          if (room.buzzState.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
          room.buzzState.buzzTimer = setTimeout(() => {
            handleBuzzTimeout(room);
          }, 20000);

          broadcast(room, {
            type: "player_buzzed",
            buzzedPlayerId: playerId,
            buzzedPlayerName: player.name,
            secondsAllowed: 20,
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
            room.status = "revealed";

            broadcast(room, {
              type: "guess_result",
              isCorrect: true,
              guesserName: player.name,
              pointsGained: 100,
              room: getSanitizedRoom(room),
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
              room.status = "revealed";
              broadcast(room, {
                type: "guess_result",
                isCorrect: false,
                guesserName: player.name,
                message: `Tebakan ${player.name} salah dan semua pemain kehabisan nyawa! Ronde ini hangus. Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
                room: getSanitizedRoom(room),
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
                message: msg,
                room: getSanitizedRoom(room),
              });
            }
          }
        }

        // 7. NEXT ROUND (Host Only)
        else if (data.type === "next_round") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.hostId !== playerId) return;

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

        // 9. SKIP ROUND (Lewati ronde jika buntu / nyerah)
        else if (data.type === "skip_round") {
          const room = rooms.get(meta.roomCode);
          if (!room || (room.status !== "playing" && room.status !== "buzzed")) return;

          // Clear any active countdown timer
          if (room.buzzState.buzzTimer) {
            clearTimeout(room.buzzState.buzzTimer);
            room.buzzState.buzzTimer = null;
          }

          room.status = "revealed";
          broadcast(room, {
            type: "round_revealed",
            message: `Ronde dilewati! Jawabannya adalah: ${room.currentSong?.title} - ${room.currentSong?.artist}`,
            room: getSanitizedRoom(room),
          });
        }

        // 10. FORFEIT BUZZ (Pemain yang buzz klik 'Nyerah' tanpa nunggu 20s)
        else if (data.type === "forfeit_buzz") {
          const room = rooms.get(meta.roomCode);
          if (!room || room.status !== "buzzed" || room.buzzState.buzzedPlayerId !== playerId) return;
          handleBuzzTimeout(room);
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
          room.players = room.players.filter((p) => p.id !== playerId);
          if (room.players.length === 0) {
            if (room.buzzState.buzzTimer) clearTimeout(room.buzzState.buzzTimer);
            rooms.delete(meta.roomCode);
          } else {
            if (room.hostId === playerId) {
              room.hostId = room.players[0].id; // Reassign host
            }
            broadcast(room, {
              type: "player_left",
              playerName: meta.name,
              room: getSanitizedRoom(room),
            });
          }
        }
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Tebak Lagu Multiplayer Server ready on http://${hostname}:${port}`);
  });
});
