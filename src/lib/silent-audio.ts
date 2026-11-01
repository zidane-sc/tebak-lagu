// Generates a 3-second 8kHz 8-bit mono silent WAV buffer in pure JS.
// Duration > 0.95s is required by WebKit (iOS) to satisfy isElementLongEnoughForMainContent,
// ensuring the top-frame audio session takes precedence over any cross-origin iframes.
export function createSilentAudioBlob(): Blob {
  const durationSeconds = 3;
  const sampleRate = 8000;
  const numSamples = durationSeconds * sampleRate;
  const buffer = new ArrayBuffer(44 + numSamples);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  view.setUint32(4, 36 + numSamples, true);
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // fmt subchunk
  view.setUint32(12, 0x666d7420, false); // "fmt "
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true); // 8-bit

  // data subchunk
  view.setUint32(36, 0x64617461, false); // "data"
  view.setUint32(40, numSamples, true);

  // 8-bit PCM silence is 128 (0x80)
  new Uint8Array(buffer, 44).fill(128);

  return new Blob([buffer], { type: "audio/wav" });
}
