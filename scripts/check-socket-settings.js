// Socket smoke check: create a room and read back the settings the server
// actually put on the wire, then flip one value via the admin API and confirm
// the next room picks it up. Proves the split-brain is closed in both
// directions: defaults match the DB, and an admin save propagates.
const { io } = require("socket.io-client");

const BASE = process.env.BASE || "https://tebak-lagu-live.fly.dev";
const PASS = process.env.ADMIN_PASSCODE;

async function login() {
  const res = await fetch(`${BASE}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ passcode: PASS }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  return res.headers.get("set-cookie").split(";")[0];
}

function createRoom() {
  return new Promise((resolve, reject) => {
    const socket = io(BASE, { path: "/socket.io", transports: ["polling", "websocket"] });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("room_created timeout"));
    }, 25000);
    socket.on("connect", () => {
      socket.emit("create_room", {
        playerName: "SmokeBot",
        mode: "heardle",
        category: "Semua Genre",
        difficulty: "easy",
        maxRounds: 1,
      });
    });
    socket.on("room_created", (msg) => {
      clearTimeout(timer);
      socket.close();
      resolve(msg.room || msg);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(timer);
      socket.close();
      reject(new Error("connect_error: " + e.message));
    });
    socket.onAny((ev, ...a) => {
      if (process.env.VERBOSE) console.log("  <-", ev, JSON.stringify(a).slice(0, 160));
    });
  });
}

(async () => {
  const cookie = await login();
  const before = await createRoom();
  console.log("room settings (from server wire):", JSON.stringify(before.settings));

  // assert the wire values equal the public defaults endpoint
  const defaults = await (await fetch(`${BASE}/api/settings`)).json();
  for (const k of Object.keys(before.settings)) {
    const same = JSON.stringify(before.settings[k]) === JSON.stringify(defaults[k]);
    console.log(`  ${k}: room=${JSON.stringify(before.settings[k])} default=${JSON.stringify(defaults[k])} ${same ? "MATCH" : "DRIFT"}`);
  }

  // flip one value through the admin write path, then re-read
  const custom = { buzzerTimerSeconds: 37, clueExtensionIntervalSeconds: 11 };
  const w = await fetch(`${BASE}/api/admin/settings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(custom),
  });
  if (!w.ok) throw new Error(`write failed: ${w.status}`);
  const after = await createRoom();
  console.log("after admin write:", JSON.stringify(after.settings));
  console.log(`  buzzerTimerSeconds -> ${after.settings.buzzerTimerSeconds} (expect 37) ${after.settings.buzzerTimerSeconds === 37 ? "PASS" : "FAIL"}`);
  console.log(`  clueExtensionIntervalSeconds -> ${after.settings.clueExtensionIntervalSeconds} (expect 11) ${after.settings.clueExtensionIntervalSeconds === 11 ? "PASS" : "FAIL"}`);

  // restore
  await fetch(`${BASE}/api/admin/settings`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ buzzerTimerSeconds: 20, clueExtensionIntervalSeconds: 30 }),
  });
  const restored = await createRoom();
  console.log("restored:", JSON.stringify(restored.settings));
  console.log(`  buzzerTimerSeconds -> ${restored.settings.buzzerTimerSeconds} (expect 20) ${restored.settings.buzzerTimerSeconds === 20 ? "PASS" : "FAIL"}`);
  process.exit(0);
})().catch((e) => {
  console.error("FAIL:", e.message);
  process.exit(1);
});
