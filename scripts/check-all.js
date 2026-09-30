// Runs every assert-based self-check. No framework, no runner — each script
// exits non-zero on failure, so this only has to notice that.
//
//   npm test
//
// ponytail: tsx is invoked via npx rather than added as a devDependency. It
// is only needed for check-admin-guard.js, which loads a .ts module; promote it
// to a real dependency if that ever changes.
//
// The runner is resolved to an absolute path: `npx` is a shell function on some
// systems and execFileSync does not go through a shell, so a bare "npx" fails
// with ENOENT even though the same command works in a terminal.
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

function resolveRunner(runner) {
  if (runner !== "npx tsx") return runner;
  // npx cache dir, e.g. ~/.npm/_npx/<hash>/node_modules/.bin/tsx
  const npxRoot = path.join(os.homedir(), ".npm", "_npx");
  if (!fs.existsSync(npxRoot)) return "npx";
  for (const dir of fs.readdirSync(npxRoot)) {
    const bin = path.join(npxRoot, dir, "node_modules", ".bin", "tsx");
    if (fs.existsSync(bin)) return bin;
  }
  return "npx";
}

const checks = [
  ["check-admin-guard.js", "npx tsx"],
  ["check-game-settings.js", "node"],
  ["check-health-probe.js", "node"],
  ["check-yt-scoring.js", "node"],
  ["check-clue-phase.js", "node"],
  ["verify-clue-phase-parity.js", "node"],
  ["check-catalogue-restore.js", "node"],
  ["verify-recovery.js", "node"],
  ["check-vocal-offset.js", "node"],
  ["check-guess-matcher.js", "node"],
  ["check-buzz-lives.js", "node"],
  ["check-song-artists.js", "node"],
  ["check-session-guard.js", "node"],
];


let failed = 0;
for (const [file, runner] of checks) {
  const full = path.join(__dirname, file);
  try {
    const bin = resolveRunner(runner);
    const argv = bin === "npx" ? ["tsx", full] : [full];
    const out = execFileSync(bin, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    process.stdout.write(`  ok   ${file} — ${out.trim().split("\n").pop()}\n`);
  } catch (err) {
    failed++;
    process.stdout.write(`  FAIL ${file}\n`);
    const detail = (err.stdout || "") + (err.stderr || "");
    process.stdout.write(detail.split("\n").slice(0, 6).map((l) => "         " + l).join("\n") + "\n");
  }
}

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log(`\nall ${checks.length} self-checks passed`);
