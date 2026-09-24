# 🎵 Tebak Lagu · Audio Trivia & Real-Time Multiplayer Web App

A modern, mobile-first music trivia game built with **Next.js 14**, **Tailwind CSS**, **Web Audio API**, and **native WebSockets**. Features 4 distinct single-player modes and a live party multiplayer arena with a tactile 3D buzzer.

![Version](https://img.shields.io/badge/version-8.0-emerald)
![Framework](https://img.shields.io/badge/Next.js-14.2-black)
![Realtime](https://img.shields.io/badge/WebSockets-Live%20Buzzer-red)

---

## 🎮 Game Modes

1. **⏱️ Time Slice (Heardle Style):**
   * Guess the song from a **0.5-second random audio slice**.
   * Each incorrect guess or skip unlocks progressively longer snippets (`0.5s` → `1.5s` → `3.0s` → `6.0s` → `10.0s` → `15.0s`).
   * Spinning vinyl record deck with dynamic grooved animation.

2. **🤖 Robot Speech (Pure Blind Listening):**
   * Lyrics are read out in a completely flat, emotionless robotic voice without melody.
   * Text is intentionally hidden to test auditory recognition.
   * Toggle between **Datar (Flat)**, **Bass**, and **Cepat (Fast)** voice styles.

3. **🎵 Vocal Melody (Synthesizer):**
   * Synthesizes the vocal melody line without lyrics or original singing.
   * Toggle between **Humming (Warm Triangle)**, **Flute (Sine)**, **8-Bit Chiptune**, and **Sawtooth Synth**.

4. **🎸 Minus-One (Instrumental):**
   * Listen to the backing track and instrumentals without the main vocal lead.

---

## 🚨 Real-Time Multiplayer Arena

* **Private Room Codes:** Create a 4-letter room code (e.g. `EYWL`) and share it with friends or family.
* **Millisecond-Lock 3D Buzzer:** Players race to hit the physical 3D red buzzer. The first player to buzz in locks out others for 7 seconds to guess.
* **Instant Autocomplete Search:** Instant 0ms local match paired with asynchronous global music directory lookups.
* **Live Floating Reactions:** Send floating emoji reactions (`🔥`, `😂`, `😱`, `👏`, `👑`, `💀`) during matches.
* **Podium Ceremony:** Top 3 podium celebration (🥇 Gold, 🥈 Silver, 🥉 Bronze) at match conclusion.

---

## 🏗️ Tech Stack

* **Framework:** Next.js 14 (App Router, React 18, TypeScript)
* **Styling:** Tailwind CSS (Tactile dark-mode audio studio aesthetic)
* **Realtime Protocol:** WebSocket Server (`ws`) co-hosted on Node.js HTTP server
* **Audio Synthesis:** Web Audio API (`OscillatorNode`, `BiquadFilterNode`, `GainNode`)
* **TTS Pipeline:** Server-rendered Indonesian Robotic Voice stream (`/api/tts`)
* **Music Discovery:** Deezer API & Apple iTunes Search API (Zero storage footprint on server)

---

## 🚀 Getting Started

### Prerequisites
* Node.js 18+ or 20+
* npm or pnpm

### Installation
```bash
# Clone the repository
git clone https://github.com/zidane-sc/tebak-lagu.git
cd tebak-lagu

# Install dependencies
npm install

# Build production bundle
npm run build

# Start custom Node.js + WebSocket server
node server.js
```

Runs on `http://localhost:3000`.

---

## 📜 License
MIT © Zidane Sc
