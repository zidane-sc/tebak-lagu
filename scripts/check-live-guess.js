// End-to-end guess check against a running server.
//
//   BASE=https://... ADMIN_PASSCODE=... node scripts/check-live-guess.js
//
// The unit tests pin the rules; this pins the wiring, over a real socket. It
// plays two rounds in two rooms: a correct guess scored by the real server, and
// a wrong guess that costs a real life.
//
// Reading the answer from round one's reveal is deliberate. The server does not
// send the title while a round is live — that would spoil it — so the reveal is
// the only way for a script to submit a guaranteed-correct guess.
//
// Advancing to a second round needs a quorum of ready votes, which a one-bot
// room cannot produce, so the second scenario uses a second room instead.
const assert = require("assert");
const { io } = require("socket.io-client");

const BASE = process.env.BASE || "https://tebak-lagu-live.fly.dev";
const PASS = process.env.ADMIN_PASSCODE;
if (!PASS) {
  console.error("set ADMIN_PASSCODE");
  process.exit(2);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// One heardle round is kickoff 4s + clues 5+9+15 + two 5s gaps + a 30s buzzer
// window, so a reveal takes well over a minute.
const ROUND_MS = 150000;

async function login() {
  const res = await fetch(`${BASE}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passcode: PASS }),
  });
  if (!res.ok) throw new Error(`login failed ${res.status}`);
  return res.headers.get("set-cookie").split(";")[0];
}

function joinRoom(name, maxRounds = 1) {
  const events = [];
  const socket = io(BASE, { path: "/socket.io", transports: ["polling", "websocket"] });
  socket.onAny((ev, payload) => events.push({ ev, payload }));

  const created = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${name}: no room_created`)), 45000);
    socket.on("connect", () => {
      socket.emit("create_room", {
        playerName: name,
        mode: "heardle",
        category: "Semua Genre",
        difficulty: "easy",
        maxRounds,
      });
    });
    socket.on("room_created", (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });

  return { socket, events, created, name };
}

function waitAfter(rec, ev, from = 0, ms = ROUND_MS) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + ms;
    const tick = () => {
      const hit = rec.events.slice(from).find((e) => e.ev === ev);
      if (hit) return resolve(hit.payload);
      if (Date.now() > deadline) return reject(new Error(`${rec.name}: no "${ev}"`));
      setTimeout(tick, 150);
    };
    tick();
  });
}

const waitFor = (rec, ev, ms = ROUND_MS) => waitAfter(rec, ev, 0, ms);

const buzz = (rec) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${rec.name}: buzz not acknowledged`)), 25000);
    rec.socket.once("player_buzzed", (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
    rec.socket.emit("buzz", {});
  });

const lifeOf = (payload, name) =>
  payload?.room?.players?.find((p) => p.name === name)?.lives;

(async () => {
  // The socket needs no auth, but the session proves this is the guarded deploy.
  await login();

  // ── 1. A correct guess is scored by the real server ────────────────────────
  const a = joinRoom("Alfa", 2);
  const room = await a.created;
  const settings = room.room?.settings;
  assert.ok(settings?.playerLivesPerRound, "room must carry its tuning");
  const lives = settings.playerLivesPerRound;
  console.log(`  room settings: lives=${lives} buzzer=${settings.buzzerTimerSeconds}s`);

  a.socket.emit("start_game", {});
  const seen = a.events.length;
  const revealed = await waitAfter(a, "round_revealed", seen);
  const answer = revealed.room?.revealedSong;
  assert.ok(answer?.title, "round_revealed must name the answer");
  console.log(`  round 1 answer: "${answer.title}" — ${answer.artist}`);

  a.socket.emit("next_round", {});
  await waitAfter(a, "round_started", seen);
  const mark = a.events.length;
  await buzz(a);
  a.socket.emit("submit_guess", { title: answer.title, artist: "" });

  const result = await waitAfter(a, "guess_result", mark);
  assert.strictEqual(result.isCorrect, true, `the exact title must score: "${answer.title}"`);
  assert.ok(result.pointsGained > 0, `a correct guess must score, got ${result.pointsGained}`);
  assert.ok(result.basePoints > 0, "basePoints must be set");
  assert.strictEqual(lifeOf(result, "Alfa"), lives, "a correct guess must not cost a life");
  console.log(
    `  correct guess -> ${result.pointsGained} pts (base ${result.basePoints} + speed ${result.speedBonus}, streak ${result.streak}), lives still ${lives}`
  );
  a.socket.close();

  // ── 2. A wrong guess costs exactly one life ────────────────────────────────
  const b = joinRoom("Bravo", 1);
  const bRoom = await b.created;
  const bLives = bRoom.room.settings.playerLivesPerRound;
  b.socket.emit("start_game", {});
  await waitAfter(b, "round_started");
  const bMark = b.events.length;
  await buzz(b);
  b.socket.emit("submit_guess", { title: "zzz not a real song title zzz", artist: "" });

  const wrong = await waitAfter(b, "guess_result", bMark);
  assert.strictEqual(wrong.isCorrect, false, "a nonsense guess must be wrong");
  assert.strictEqual(lifeOf(wrong, "Bravo"), bLives - 1, "a wrong guess must cost exactly one life");
  console.log(`  wrong guess -> lives ${bLives} -> ${lifeOf(wrong, "Bravo")}`);
  b.socket.close();

  // ── 3. The rejection message ──────────────────────────────────────────────
  // Reachable only by a player who has spent every life, and spending them all
  // needs several buzzes in one round, which a single-bot room cannot drive:
  // the first wrong guess hands the buzzer back only after a forfeit the server
  // accepts, and the room then ends the round. The message is built from
  // room.playerLivesPerRound, which check-buzz-lives.js covers as a unit.

  console.log("\nall live guess assertions passed");
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
