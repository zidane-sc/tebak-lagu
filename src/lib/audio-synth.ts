// Web Audio API Synthesizer for Humming / Melody Mode
// Zero external audio assets required, multiple timbre options

export type SynthTimbre = "humming" | "chiptune" | "synth" | "flute";

export class HummingSynth {
  private ctx: AudioContext | null = null;
  private isPlaying: boolean = false;
  private timeouts: NodeJS.Timeout[] = [];
  public timbre: SynthTimbre = "humming";

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
  }

  public playMelody(
    notes: Array<{ note: number; duration: number }>,
    onProgress?: (index: number) => void,
    onComplete?: () => void
  ) {
    this.stop();
    this.initCtx();
    if (!this.ctx) return;

    this.isPlaying = true;
    let startTime = this.ctx.currentTime + 0.1;
    let accumulatedMs = 100;

    notes.forEach((item, index) => {
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      // Configure timbre
      if (this.timbre === "chiptune") {
        osc.type = "square";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(2200, startTime);
      } else if (this.timbre === "synth") {
        osc.type = "sawtooth";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1400, startTime);
      } else if (this.timbre === "flute") {
        osc.type = "sine";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1800, startTime);
      } else {
        // Default warm throat humming
        osc.type = "triangle";
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(1100, startTime);
      }

      osc.frequency.setValueAtTime(item.note, startTime);

      // ADSR Envelope
      const dur = item.duration;
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.04);
      gain.gain.setValueAtTime(0.3, startTime + dur - 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + dur);

      const t = setTimeout(() => {
        if (this.isPlaying && onProgress) {
          onProgress(index);
        }
      }, accumulatedMs);
      this.timeouts.push(t);

      startTime += dur + 0.05;
      accumulatedMs += Math.round((dur + 0.05) * 1000);
    });

    const endTimeout = setTimeout(() => {
      this.isPlaying = false;
      if (onComplete) onComplete();
    }, accumulatedMs);
    this.timeouts.push(endTimeout);
  }

  public stop() {
    this.isPlaying = false;
    this.timeouts.forEach((t) => clearTimeout(t));
    this.timeouts = [];
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {}
      this.ctx = null;
    }
  }

  public get active(): boolean {
    return this.isPlaying;
  }
}
