// Web Speech API Engine for Robot TTS Mode
// Monotone flat pitch reading for maximum comedy and challenge

export class TtsEngine {
  private synth: SpeechSynthesis | null = null;
  private isSpeaking: boolean = false;

  constructor() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      this.synth = window.speechSynthesis;
    }
  }

  public speak(
    text: string,
    onStart?: () => void,
    onEnd?: () => void
  ) {
    if (!this.synth) {
      alert("Browser kamu belum mendukung Web Speech API.");
      return;
    }

    this.stop();

    // Clean text
    const cleanText = text.replace(/['"“”]/g, "").trim();
    const utterance = new SpeechSynthesisUtterance(cleanText);

    // Flat, robotic settings
    utterance.rate = 0.88; // Slightly slow & deliberate
    utterance.pitch = 1.0; // Flat monotone
    utterance.lang = "id-ID"; // Indonesian voice

    // Try finding an Indonesian voice if available
    const voices = this.synth.getVoices();
    const idVoice = voices.find(
      (v) => v.lang.startsWith("id") || v.lang.includes("ID")
    );
    if (idVoice) {
      utterance.voice = idVoice;
    }

    utterance.onstart = () => {
      this.isSpeaking = true;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      if (onEnd) onEnd();
    };

    this.synth.speak(utterance);
  }

  public stop() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }

  public get active(): boolean {
    return this.isSpeaking;
  }
}
