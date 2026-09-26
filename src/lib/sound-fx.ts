// Procedural Arcade & Music Game Sound Effects Engine (Web Audio API)
// Zero external mp3 dependencies, instant 0ms latency, 100% synthesized

class GameSoundEngine {
  private ctx: AudioContext | null = null;
  public enabled: boolean = true;

  private init() {
    if (!this.ctx && typeof window !== "undefined") {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  // Tactile Mechanical Arcade Button Click
  public playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // Alias for skip action
  public playSkip() {
    this.playClick();
  }

  // HUGE GAME-SHOW RED BUZZER HIT!
  public playBuzzer() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Dual detuned sawtooth oscillators for heavy dramatic game-show buzz
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    osc1.type = "sawtooth";
    osc2.type = "sawtooth";

    osc1.frequency.setValueAtTime(155.56, now); // Eb3
    osc2.frequency.setValueAtTime(150.0, now);  // Detuned

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.45);

    gain.gain.setValueAtTime(0.5, now);
    gain.gain.setValueAtTime(0.45, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.52);
    osc2.stop(now + 0.52);
  }

  // Triumphant Arcade Win Fanfare
  public playCorrect() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // High energy ascending arpeggio (C5 -> E5 -> G5 -> C6 -> E6)
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.35, now + idx * 0.07 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.45);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.46);
    });
  }

  // Sad Low Thud for Wrong Guess
  public playWrong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const notes = [185, 130]; // D#3 -> C3 drop
    notes.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + idx * 0.16);

      gain.gain.setValueAtTime(0.3, now + idx * 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.16 + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.16);
      osc.stop(now + idx * 0.16 + 0.3);
    });
  }

  // Tension Tick for 7s Countdown
  public playTick(isUrgent: boolean = false) {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(isUrgent ? 1200 : 880, now);

    gain.gain.setValueAtTime(isUrgent ? 0.25 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Floating Emoji Reaction Pop
  public playPop() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1400, now + 0.07);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // Next Round Gong
  public playGong() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(329.63, now); // E4
    osc.frequency.exponentialRampToValueAtTime(164.81, now + 1.2);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.25);
  }

  // -------------------------------------------------------------
  // MEME & PARTY SOUNDBOARD ENGINE (Procedural Web Audio API)
  // -------------------------------------------------------------

  // 🎺 Classic Stadium Airhorn (3 rapid blasts)
  public playAirhorn() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const freqs = [466.16, 554.37, 622.25]; // Bb4, Db5, Eb5 brass chord
    const blasts = [0, 0.14, 0.28]; // 3 quick pulses

    blasts.forEach((delay) => {
      const now = (this.ctx?.currentTime || 0) + delay;
      freqs.forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.98, now + 0.11);

        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0.16, now + 0.09);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
      });
    });
  }

  // 💀 Iconic Sad Trombone (Wah-wah-wah-waaah Zonk)
  public playSadTrombone() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [
      { freq: 293.66, dur: 0.28, delay: 0 },    // D4
      { freq: 277.18, dur: 0.28, delay: 0.3 },  // Db4
      { freq: 261.63, dur: 0.28, delay: 0.6 },  // C4
      { freq: 246.94, dur: 0.7, delay: 0.9, slide: 220 }, // B3 slide down to A3
    ];

    notes.forEach((n) => {
      if (!this.ctx) return;
      const startTime = now + n.delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(n.freq, startTime);
      if (n.slide) {
        osc.frequency.linearRampToValueAtTime(n.slide, startTime + n.dur);
      }

      gain.gain.setValueAtTime(0.25, startTime);
      gain.gain.setValueAtTime(0.2, startTime + n.dur - 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + n.dur);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + n.dur + 0.02);
    });
  }

  // 🥁 Suspenseful Drum Roll into Crash
  public playDrumRoll() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const count = 18;
    for (let i = 0; i < count; i++) {
      const hitTime = now + (i * 0.045);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(140 + (i * 3), hitTime);
      gain.gain.setValueAtTime(0.05 + (i * 0.015), hitTime);
      gain.gain.exponentialRampToValueAtTime(0.001, hitTime + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(hitTime);
      osc.stop(hitTime + 0.045);
    }

    // Final Cymbal Splash
    const crashTime = now + (count * 0.045);
    const crashOsc = this.ctx.createOscillator();
    const crashGain = this.ctx.createGain();
    crashOsc.type = "sine";
    crashOsc.frequency.setValueAtTime(800, crashTime);
    crashGain.gain.setValueAtTime(0.25, crashTime);
    crashGain.gain.exponentialRampToValueAtTime(0.001, crashTime + 0.5);

    crashOsc.connect(crashGain);
    crashGain.connect(this.ctx.destination);

    crashOsc.start(crashTime);
    crashOsc.stop(crashTime + 0.55);
  }

  // 🤡 Cheerful Cartoon Laugh (Wobble Giggles)
  public playCartoonLaugh() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const giggles = [0, 0.12, 0.24, 0.36];

    giggles.forEach((delay, idx) => {
      if (!this.ctx) return;
      const startTime = now + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sine";
      const baseFreq = 520 + (idx % 2 === 0 ? 80 : 0);
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.3, startTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.9, startTime + 0.1);

      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.11);
    });
  }

  // 👏 Crowd Applause & Cheers
  public playApplause() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    for (let i = 0; i < 22; i++) {
      const clapTime = now + (Math.random() * 0.6);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(400 + Math.random() * 600, clapTime);
      gain.gain.setValueAtTime(0.12, clapTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.08);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(clapTime);
      osc.stop(clapTime + 0.09);
    }
  }
}

export const sfx = new GameSoundEngine();
